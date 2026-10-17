import type { Messenger } from "../execute.ts";
import { photon, projectPath } from "./client.ts";

/** Real iMessage sends. Simulated conversations never reach Photon. "Accepted" is what we record; delivery is asynchronous. */
export const photonMessenger: Messenger = {
  async send({ conversation, text, proposalId, idempotencyKey }) {
    if (conversation.platform !== "imessage") return { photonMessageId: null };
    if (!conversation.photon_space_id || !conversation.photon_agent_user_id) {
      throw new Error("Conversation has no Photon space or agent user to send from");
    }
    const sent = await photon().projects.sendMessage({
      path: projectPath(),
      headers: { "idempotency-key": idempotencyKey ?? `proposal:${proposalId}` },
      body: {
        spaceId: conversation.photon_space_id,
        senderId: conversation.photon_agent_user_id,
        content: { type: "text", format: "plain", text },
      },
    });
    return { photonMessageId: "id" in sent && typeof sent.id === "string" ? sent.id : null };
  },
};
