import type { Json } from "@boh/shared";
import { db } from "./db.ts";

export type Actor =
  | "customer"
  | "owner"
  | "system"
  | "photon"
  | "square"
  | "agent:intake"
  | "agent:ops"
  | "agent:guard"
  | "agent:winback";

export interface Subject {
  type: string;
  id: string;
}

/** Appends one row to the audit log. Event types are listed in planning/ARCHITECTURE.md. */
export async function logEvent(actor: Actor, type: string, subject: Subject | null, data: Record<string, unknown> = {}) {
  const { error } = await db()
    .from("events")
    .insert({
      actor,
      type,
      subject_type: subject?.type ?? null,
      subject_id: subject?.id ?? null,
      data: data as Json,
    });
  if (error) throw new Error(`logEvent ${type} failed: ${error.message}`);
}
