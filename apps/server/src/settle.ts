import { db } from "./db.ts";
import { logEvent, type Actor } from "./events.ts";

/**
 * Marks orders paid and deducts recipe ingredients. Idempotent: the conditional update means
 * only the first delivery of a payment wins, so a replayed webhook pays and deducts once.
 */
export async function settlePaid(match: { squareOrderId: string } | { orderId: string }, actor: Actor, data: Record<string, unknown> = {}) {
  const query = db()
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("status", "awaiting_payment");
  const { data: paid, error } = await ("squareOrderId" in match
    ? query.eq("square_order_id", match.squareOrderId)
    : query.eq("id", match.orderId)
  ).select("id, order_items(product_id, qty)");
  if (error) throw new Error(`mark paid: ${error.message}`);
  if (!paid?.length) return { paidOrders: 0 };

  const units = new Map<string, number>();
  for (const order of paid) {
    await logEvent(actor, "order.paid", { type: "order", id: order.id }, data);
    for (const item of order.order_items) units.set(item.product_id, (units.get(item.product_id) ?? 0) + item.qty);
  }

  const { data: lines, error: recipeError } = await db()
    .from("recipe_lines")
    .select("product_id, ingredient_id, qty_per_unit")
    .in("product_id", [...units.keys()]);
  if (recipeError) throw new Error(`load recipes: ${recipeError.message}`);
  const deduct = new Map<string, number>();
  for (const l of lines ?? []) {
    deduct.set(l.ingredient_id, (deduct.get(l.ingredient_id) ?? 0) + (units.get(l.product_id) ?? 0) * Number(l.qty_per_unit));
  }

  for (const [ingredientId, amount] of deduct) {
    const { data: ing, error: ingError } = await db().from("ingredients").select("on_hand").eq("id", ingredientId).single();
    if (ingError) throw new Error(`load ingredient ${ingredientId}: ${ingError.message}`);
    const onHand = Math.max(0, Math.round((Number(ing.on_hand) - amount) * 1000) / 1000);
    const { error: updError } = await db().from("ingredients").update({ on_hand: onHand }).eq("id", ingredientId);
    if (updError) throw new Error(`deduct ${ingredientId}: ${updError.message}`);
    await logEvent("system", "inventory.deducted", { type: "ingredient", id: ingredientId }, {
      amount: Math.round(amount * 1000) / 1000,
      orderIds: paid.map((o) => o.id),
    });
  }
  return { paidOrders: paid.length };
}
