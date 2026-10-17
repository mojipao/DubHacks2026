import type { Message } from "@photon-ai/api";
import { io } from "socket.io-client";
import { db } from "../db.ts";
import { env } from "../env.ts";
import { ingestInbound } from "../inbound.ts";
import { photon, projectPath } from "./client.ts";

export const photonStatus = { mode: "off" as "off" | "socket" | "poll", connected: false, cursor: 0, lastError: null as string | null };

interface ReceivedText {
  id: string;
  handle: string;
  text: string;
  spaceId: string;
  agentUserId: string;
}

/**
 * Pulls a received direct iMessage text out of a Photon message, or null for anything we ignore:
 * other platforms, our own sends, non-human senders, group spaces, non-text content.
 */
export function toReceivedText(raw: unknown): ReceivedText | null {
  const m = raw as Partial<Message> & Record<string, unknown>;
  if (m.platform !== "imessage" || m.status !== "received") return null;
  const sentBy = m.sentBy as { handle?: string; kind?: string } | undefined;
  // receivedBy is optional; addressedTo carries the same agent user when it's the one Photon fills in.
  const receivedBy = (m.receivedBy ?? m.addressedTo) as { id?: string } | undefined;
  const space = m.space as { id?: string; kind?: string } | undefined;
  const content = m.content as { type?: string; text?: string } | undefined;
  if (!m.id || !sentBy?.handle || !receivedBy?.id || !space?.id) return null;
  if (sentBy.kind && sentBy.kind !== "human") return null;
  if (space.kind && /group/i.test(space.kind)) return null;
  if (content?.type !== "text" || !content.text?.trim()) return null;
  return { id: String(m.id), handle: sentBy.handle, text: content.text, spaceId: space.id, agentUserId: receivedBy.id };
}

/** The message inside a `message.received` event: `event.data.object` (confirmed against a live delivery, API version 2026-07-01). */
function messageFromEvent(event: Record<string, unknown>): unknown {
  return (event.data as { object?: unknown } | undefined)?.object;
}

async function handle(raw: unknown) {
  const msg = toReceivedText(raw);
  if (!msg) return;
  await ingestInbound({
    platform: "imessage",
    handle: msg.handle,
    text: msg.text,
    photon: { spaceId: msg.spaceId, agentUserId: msg.agentUserId, messageId: msg.id },
  });
}

async function loadCursor(): Promise<number> {
  const { data } = await db().from("photon_cursor").select("seq").eq("id", 1).single();
  return Number(data?.seq ?? 0);
}

async function saveCursor(seq: number) {
  const { error } = await db().from("photon_cursor").update({ seq }).eq("id", 1);
  if (error) throw new Error(`save Photon cursor: ${error.message}`);
  photonStatus.cursor = seq;
}

/** Socket.IO event stream, following Photon's Node.js example: serial queue, cursor saved only after success. */
async function startSocket() {
  let cursor = await loadCursor();
  photonStatus.cursor = cursor;
  let epoch = 0;
  let pending = 0;
  let queue = Promise.resolve();

  const socket = io("https://api.photon.codes", {
    path: `/v1/projects/${env.PHOTON_PROJECT_ID}/events/ws`,
    addTrailingSlash: false,
    transports: ["websocket"],
    extraHeaders: { Authorization: `Bearer ${env.PHOTON_API_KEY}` },
    autoConnect: false,
  });

  socket.on("connect", () => {
    photonStatus.connected = true;
    socket.timeout(10_000).emit("subscribe", { startSeq: cursor }, (error: Error | null, result: { ok: boolean; error?: { code: string } }) => {
      if (error) socket.io.engine.close();
      else if (!result.ok) {
        photonStatus.lastError = result.error?.code ?? "subscribe failed";
        console.error("Photon subscribe failed", result.error);
      }
    });
  });
  socket.on("disconnect", () => {
    photonStatus.connected = false;
    epoch++;
  });
  socket.on("delivery", (event: Record<string, unknown>, { seq }: { seq: number }) => {
    const generation = epoch;
    if (++pending > 128) {
      pending--;
      epoch++;
      socket.io.engine.close();
      return;
    }
    queue = queue
      .then(async () => {
        if (generation !== epoch || seq <= cursor) return;
        if (event.type === "message.received") await handle(messageFromEvent(event));
        await saveCursor(seq);
        cursor = seq;
      })
      .catch((error) => {
        photonStatus.lastError = String(error);
        console.error("Photon event processing failed", error);
        if (generation === epoch) {
          epoch++;
          socket.io.engine.close();
        }
      })
      .finally(() => {
        pending--;
      });
  });
  socket.on("delivery_error", (error: { code: string; message: string }) => {
    photonStatus.lastError = error.code;
    console.error("Photon delivery_error", error.code, error.message);
  });
  socket.on("connect_error", (error) => {
    photonStatus.lastError = error.message;
    console.error("Photon connect_error", error.message);
  });
  socket.connect();
}

/** Fallback when the socket fights us: poll received iMessages every 2 s. The unique photon_message_id makes repeats harmless. */
function startPolling() {
  let since = new Date(Date.now() - 60_000).toISOString();
  let delay = 2000;
  const tick = async () => {
    try {
      let pageToken: string | undefined;
      do {
        const page = await photon().projects.listMessages({
          path: projectPath(),
          query: { direction: "received", order: "asc", platform: "imessage", createdSince: since, pageToken } as never,
        });
        for (const item of page.items) {
          await handle(item);
          const created = (item as { createdAt?: string }).createdAt;
          if (created && created > since) since = created;
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
      photonStatus.connected = true;
      delay = 2000;
    } catch (err) {
      photonStatus.connected = false;
      photonStatus.lastError = String(err);
      const retryAfter = (err as { status?: number; headers?: Headers }).status === 429 ? 10_000 : 0;
      delay = Math.max(retryAfter, Math.min(delay * 2, 30_000));
    }
    setTimeout(tick, delay);
  };
  void tick();
}

/** Only the demo host listens. Two listeners would answer every customer twice. */
export async function startPhotonInbound() {
  if (env.PHOTON_INBOUND === "on") {
    photonStatus.mode = "socket";
    await startSocket();
  } else if (env.PHOTON_INBOUND === "poll") {
    photonStatus.mode = "poll";
    startPolling();
  }
}

/** `startSeq: 0` subscribes live with no replay, so reset sets the cursor to 0 and old messages never come back. */
export { saveCursor as setPhotonCursor };
