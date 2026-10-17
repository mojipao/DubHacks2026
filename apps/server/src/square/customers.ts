import { square } from "./client.ts";

/** Finds the Square customer whose reference_id is our customer UUID, or creates one. Safe to rerun. */
export async function ensureSquareCustomer(c: { id: string; name: string; handle?: string | null }): Promise<string> {
  const found = await square().customers.search({ query: { filter: { referenceId: { exact: c.id } } }, limit: BigInt(1) });
  const existing = found.customers?.[0]?.id;
  if (existing) return existing;

  const [givenName, ...rest] = c.name.split(" ");
  const phone = c.handle && !c.handle.includes("@") ? c.handle : undefined;
  const email = c.handle?.includes("@") ? c.handle : undefined;
  const created = await square().customers.create({
    idempotencyKey: `customer:${c.id}`,
    givenName,
    familyName: rest.join(" ") || undefined,
    phoneNumber: phone,
    emailAddress: email,
    referenceId: c.id,
    note: "Synthetic demo customer (Back of House)",
  });
  if (!created.customer?.id) throw new Error(`Square customer create failed for ${c.id}`);
  return created.customer.id;
}
