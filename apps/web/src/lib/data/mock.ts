import type { ReplyPayload, ReorderPayload } from "@boh/shared";
import { BUSINESS } from "@/lib/business";
import type { DataSnapshot, DataSource } from "@/lib/data/source";
import type { UiEvent, UiMessage, UiProposal } from "@/lib/data/types";
import {
  FIXTURE_CONVERSATIONS,
  FIXTURE_EVENTS,
  FIXTURE_FRICTION,
  FIXTURE_INGREDIENTS,
  FIXTURE_MESSAGES,
  FIXTURE_ORDERS,
  FIXTURE_PROPOSALS,
  FIXTURE_TRACE,
} from "@/mocks/fixtures";

function cloneSnapshot(): DataSnapshot {
  return {
    conversations: structuredClone(FIXTURE_CONVERSATIONS),
    messages: structuredClone(FIXTURE_MESSAGES),
    proposals: structuredClone(FIXTURE_PROPOSALS),
    orders: structuredClone(FIXTURE_ORDERS),
    ingredients: structuredClone(FIXTURE_INGREDIENTS),
    events: structuredClone(FIXTURE_EVENTS),
    friction: { ...FIXTURE_FRICTION },
    connection: "mock",
  };
}

function pushEvent(
  snap: DataSnapshot,
  partial: Omit<UiEvent, "id"> & { id?: string },
) {
  snap.events = [
    {
      id: partial.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...partial,
    },
    ...snap.events,
  ].slice(0, 80);
}

export function createMockSource(): DataSource {
  let snap = cloneSnapshot();
  const listeners = new Set<(patch: Partial<DataSnapshot>) => void>();

  const emit = (patch: Partial<DataSnapshot>) => {
    snap = { ...snap, ...patch };
    for (const l of listeners) l(patch);
  };

  const finishApprove = (ids: string[], via: "ui" | "imessage" = "ui") => {
    const at = new Date().toISOString();
    const proposals = snap.proposals.map((p) => {
      if (!ids.includes(p.id)) return p;
      return {
        ...p,
        status: "executed" as const,
        decidedAt: at,
        executedAt: at,
        approvedVia: via,
      };
    });

    for (const id of ids) {
      const p = proposals.find((x) => x.id === id);
      if (!p) continue;
      pushEvent(snap, {
        at,
        actor: "owner",
        type: "proposal.approved",
        subjectType: "proposal",
        subjectId: id,
        data: { via },
      });
      pushEvent(snap, {
        at,
        actor: "system",
        type: "proposal.executed",
        subjectType: "proposal",
        subjectId: id,
        data: {},
      });

      if (p.kind === "reply") {
        const payload = p.payload as ReplyPayload;
        const outbound: UiMessage = {
          id: `msg-out-${id}`,
          conversationId: p.conversationId ?? "",
          direction: "outbound",
          body: payload.text.replace(
            "{{payment_link}}",
            "https://square.link/u/mock-demo",
          ),
          status: "sent",
          createdAt: at,
          approvedByOwner: true,
        };
        snap.messages = [...snap.messages, outbound];
        snap.friction = {
          ...snap.friction,
          messagesHandled: snap.friction.messagesHandled + 1,
          ordersCreated: snap.friction.ordersCreated + payload.orders.length,
          ownerMinutesSaved:
            snap.friction.ownerMinutesSaved +
            (payload.orders.length >= 2 || p.riskFlags.includes("counteroffer")
              ? BUSINESS.minutesSaved.counteroffer
              : BUSINESS.minutesSaved.reply +
                payload.orders.length * BUSINESS.minutesSaved.order),
        };
        if (p.conversationId) {
          snap.conversations = snap.conversations.map((c) =>
            c.id === p.conversationId
              ? {
                  ...c,
                  lastMessageAt: at,
                  lastPreview: outbound.body.slice(0, 80),
                  hasPendingTicket: proposals.some(
                    (x) =>
                      x.conversationId === c.id &&
                      x.status === "pending" &&
                      x.id !== id,
                  ),
                }
              : c,
          );
        }
      }

      if (p.kind === "reorder") {
        const payload = p.payload as ReorderPayload;
        snap.ingredients = snap.ingredients.map((ing) => {
          const line = payload.lines.find((l) => l.ingredientId === ing.id);
          if (!line) return ing;
          return { ...ing, onOrder: ing.onOrder + line.qty };
        });
        snap.friction = {
          ...snap.friction,
          reordersDrafted: snap.friction.reordersDrafted,
          ownerMinutesSaved:
            snap.friction.ownerMinutesSaved + BUSINESS.minutesSaved.reorder,
        };
        pushEvent(snap, {
          at,
          actor: "system",
          type: "inventory.reordered",
          subjectType: "ingredient",
          subjectId: payload.lines[0]?.ingredientId ?? null,
          data: { supplier: payload.supplier },
        });
      }
    }

    emit({
      proposals,
      messages: snap.messages,
      conversations: snap.conversations,
      ingredients: snap.ingredients,
      events: snap.events,
      friction: snap.friction,
    });
  };

  return {
    mode: "mock",
    async load() {
      snap = cloneSnapshot();
      return structuredClone(snap);
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getTrace(triggerMessageId) {
      return FIXTURE_TRACE[triggerMessageId] ?? [];
    },
    async approve(id, opts) {
      const target = snap.proposals.find((p) => p.id === id);
      if (!target || target.status !== "pending") {
        throw Object.assign(new Error("Already handled"), { status: 409 });
      }

      const ids = [id];
      if (opts?.includeLinked) {
        for (const child of snap.proposals) {
          if (child.parentProposalId === id && child.status === "pending") {
            ids.push(child.id);
          }
        }
      }

      const proposals = snap.proposals.map((p) => {
        if (!ids.includes(p.id)) return p;
        if (p.kind === "reply" && opts?.editedText) {
          return {
            ...p,
            status: "executing" as const,
            payload: {
              ...(p.payload as ReplyPayload),
              text: opts.editedText,
            },
          };
        }
        return { ...p, status: "executing" as const };
      });
      emit({ proposals });
      snap.proposals = proposals;

      await new Promise((r) => setTimeout(r, 450));
      finishApprove(ids, "ui");
    },
    async reject(id, opts) {
      const at = new Date().toISOString();
      const ids = [id];
      if (opts?.includeLinked) {
        for (const child of snap.proposals) {
          if (child.parentProposalId === id && child.status === "pending") {
            ids.push(child.id);
          }
        }
      }
      const proposals = snap.proposals.map((p) =>
        ids.includes(p.id)
          ? {
              ...p,
              status: "rejected" as const,
              decidedAt: at,
              error: opts?.reason ?? null,
            }
          : p,
      );
      for (const pid of ids) {
        pushEvent(snap, {
          at,
          actor: "owner",
          type: "proposal.rejected",
          subjectType: "proposal",
          subjectId: pid,
          data: { reason: opts?.reason },
        });
      }
      snap.conversations = snap.conversations.map((c) => ({
        ...c,
        hasPendingTicket: proposals.some(
          (p) => p.conversationId === c.id && p.status === "pending",
        ),
      }));
      emit({
        proposals,
        events: snap.events,
        conversations: snap.conversations,
      });
    },
    async simulateInbound(input) {
      const at = new Date().toISOString();
      const convId =
        snap.conversations.find((c) => c.handle === input.handle)?.id ??
        `conv-${Date.now()}`;
      let conversations = snap.conversations;
      if (!conversations.some((c) => c.id === convId)) {
        conversations = [
          {
            id: convId,
            customerId: null,
            handle: input.handle,
            customerName: input.name ?? null,
            platform: "simulated",
            role: "customer",
            lastMessageAt: at,
            lastPreview: input.text,
            hasPendingTicket: true,
          },
          ...conversations,
        ];
      } else {
        conversations = conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessageAt: at,
                lastPreview: input.text,
                hasPendingTicket: true,
              }
            : c,
        );
      }

      const message: UiMessage = {
        id: `msg-sim-${Date.now()}`,
        conversationId: convId,
        direction: "inbound",
        body: input.text,
        status: "received",
        createdAt: at,
      };
      const messages = [...snap.messages, message];
      pushEvent(snap, {
        at,
        actor: "system",
        type: "message.received",
        subjectType: "message",
        subjectId: message.id,
        data: { handle: input.handle },
      });

      emit({ conversations, messages, events: snap.events });
      snap.conversations = conversations;
      snap.messages = messages;

      await new Promise((r) => setTimeout(r, 900));

      const lower = input.text.toLowerCase();
      let proposal: UiProposal;
      if (lower.includes("free") || lower.includes("ignore")) {
        proposal = {
          id: `prop-sim-${Date.now()}`,
          agent: "intake",
          kind: "reply",
          status: "pending",
          conversationId: convId,
          triggerMessageId: message.id,
          parentProposalId: null,
          title: "Decline unsafe ask",
          summary: "Guard catch on simulated inbound.",
          rationale: "Off-policy or injection language — decline, no order.",
          payload: {
            text: "We can't do that, but happy to take a regular order — what would you like?\n— Larch & Rye",
            orders: [],
          },
          evidence: [],
          reads: [{ table: "messages", id: message.id }],
          confidence: 0.9,
          riskFlags: ["injection_suspected", "off_policy", "new_customer"],
          shortCode: "S1",
          createdAt: new Date().toISOString(),
          decidedAt: null,
          executedAt: null,
          error: null,
          customerName: input.name ?? null,
          guardSummary:
            "Guard: asked to ignore instructions or for free items. Reply declines; no order.",
        };
        snap.friction = {
          ...snap.friction,
          guardCatches: snap.friction.guardCatches + 1,
          ownerMinutesSaved:
            snap.friction.ownerMinutesSaved + BUSINESS.minutesSaved.guardCatch,
        };
        pushEvent(snap, {
          at: proposal.createdAt,
          actor: "system",
          type: "guard.flagged",
          subjectType: "proposal",
          subjectId: proposal.id,
          data: { flags: proposal.riskFlags },
        });
      } else {
        proposal = {
          id: `prop-sim-${Date.now()}`,
          agent: "intake",
          kind: "reply",
          status: "pending",
          conversationId: convId,
          triggerMessageId: message.id,
          parentProposalId: null,
          title: "Simulated reply",
          summary: "Stub draft from phone simulator (mock mode).",
          rationale: "Mock intake drafted a confirm-and-clarify reply.",
          payload: {
            text: `Hi${input.name ? ` ${input.name.split(" ")[0]}` : ""} — we got your message and will confirm shortly.\n— Larch & Rye`,
            orders: [],
          },
          evidence: [
            {
              label: "Source",
              value: "Phone simulator (mock)",
              source: { table: "messages", id: message.id },
            },
          ],
          reads: [{ table: "messages", id: message.id }],
          confidence: 0.55,
          riskFlags: [],
          shortCode: "S2",
          createdAt: new Date().toISOString(),
          decidedAt: null,
          executedAt: null,
          error: null,
          customerName: input.name ?? null,
        };
      }

      pushEvent(snap, {
        at: proposal.createdAt,
        actor: "agent:intake",
        type: "proposal.created",
        subjectType: "proposal",
        subjectId: proposal.id,
        data: {},
      });

      emit({
        proposals: [proposal, ...snap.proposals],
        events: snap.events,
        friction: snap.friction,
      });
    },
  };
}
