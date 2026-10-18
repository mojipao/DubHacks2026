/**
 * The counteroffer, checked without a model in the loop.
 *
 * planning/LANE-3-AGENTS.md asks for exactly this test: 48 milk cakes on
 * Saturday against the seed numbers must come back as 24 Saturday, 24 Sunday, and a
 * ghee reorder from Rainier Dairy. If this test fails, the demo's second beat is gone.
 */
import { describe, expect, it } from "vitest";
import { createFixtureWorld } from "./fixtures/fixture-port.ts";
import { planFulfillment, planReorder } from "./ops.ts";

/** A Saturday, so "Saturday" resolves to the following Saturday as the seed intends. */
const NOW = new Date("2026-10-17T12:00:00-07:00");

const world = () => createFixtureWorld({ now: NOW });

describe("planFulfillment", () => {
  it("splits 4 dozen milk cakes across Saturday and Sunday", async () => {
    const { port, business, weekend } = world();

    const plan = await planFulfillment(
      [{ productId: "milk-cake", qty: 48 }],
      `${weekend.sat}T09:00`,
      port,
      business,
    );

    expect(plan.days).toHaveLength(2);
    expect(plan.days[0]).toMatchObject({
      localDate: weekend.sat,
      pickupLocal: `${weekend.sat}T09:00`,
      items: [{ productId: "milk-cake", qty: 24 }],
    });
    expect(plan.days[1]).toMatchObject({
      localDate: weekend.sun,
      pickupLocal: `${weekend.sun}T09:00`,
      items: [{ productId: "milk-cake", qty: 24 }],
    });

    expect(plan.unfulfilled).toEqual([]);
    expect(plan.capacitySplit).toBe(true);
    expect(plan.flags).toContain("capacity_shortfall");
    expect(plan.flags).toContain("counteroffer");
    expect(plan.flags).toContain("ingredient_shortfall");
  });

  it("reports the ghee shortfall across both days against one stock pool", async () => {
    const { port, business, weekend } = world();

    const plan = await planFulfillment(
      [{ productId: "milk-cake", qty: 48 }],
      `${weekend.sat}T09:00`,
      port,
      business,
    );

    const ghee = plan.needs.find((n) => n.ingredientId === "ghee");
    expect(ghee).toBeDefined();
    // 24 + 24 milk cakes on top of both days' committed ghee orders, against 1.66 kg.
    expect(ghee?.need).toBeCloseTo(2.195, 3);
    expect(ghee?.onHand).toBe(1.66);
    expect(ghee?.shortfall).toBeCloseTo(0.535, 3);
  });

  it("leaves a request that fits alone on its day", async () => {
    const { port, business, weekend } = world();

    const plan = await planFulfillment(
      [
        { productId: "pistachio-maamoul", qty: 2 },
        { productId: "adeni-chai", qty: 1 },
      ],
      `${weekend.sat}T09:00`,
      port,
      business,
    );

    expect(plan.days).toHaveLength(1);
    expect(plan.capacitySplit).toBe(false);
    expect(plan.flags).not.toContain("counteroffer");
    expect(plan.needs.every((n) => n.shortfall === 0)).toBe(true);
  });

  it("caps the plan at two days and reports the rest as unfulfilled", async () => {
    const { port, business, weekend } = world();

    // Capacity is 4 coffee boxes a day with 1 committed Saturday, so 20 cannot fit in two days.
    const plan = await planFulfillment(
      [{ productId: "coffee-box", qty: 20 }],
      `${weekend.sat}T10:00`,
      port,
      business,
    );

    expect(plan.days.length).toBeLessThanOrEqual(2);
    const planned = plan.days.flatMap((d) => d.items).reduce((s, i) => s + i.qty, 0);
    const missed = plan.unfulfilled.reduce((s, i) => s + i.qty, 0);
    expect(planned + missed).toBe(20);
    expect(missed).toBeGreaterThan(0);
  });
});

describe("planReorder", () => {
  it("orders 3 kg of ghee from Rainier Dairy, the $38.40 in the architecture doc", async () => {
    const { port, business, weekend } = world();

    const plan = await planFulfillment(
      [{ productId: "milk-cake", qty: 48 }],
      `${weekend.sat}T09:00`,
      port,
      business,
    );
    const reorders = planReorder(plan.needs, business, plan.days[0]?.localDate ?? weekend.sat);

    expect(reorders).toHaveLength(1);
    const ghee = reorders[0];
    expect(ghee?.payload.supplier).toBe("Rainier Dairy");
    expect(ghee?.payload.lines).toEqual([{ ingredientId: "ghee", qty: 3 }]);
    expect(ghee?.totalCents).toBe(3840);
    expect(ghee?.title).toContain("Rainier Dairy");
  });

  it("needs the ghee by the last open day before pickup, which is the Friday", async () => {
    const { port, business, weekend } = world();

    const plan = await planFulfillment(
      [{ productId: "milk-cake", qty: 48 }],
      `${weekend.sat}T09:00`,
      port,
      business,
    );
    const [ghee] = planReorder(plan.needs, business, weekend.sat);

    // The shop is closed Monday; the day before a Saturday pickup is the Friday.
    const neededBy = ghee?.payload.neededBy ?? "";
    expect(neededBy.slice(0, 10)).toBe("2026-10-23");
  });

  it("drafts nothing when stock covers the order", () => {
    expect(planReorder([], world().business, "2026-10-24")).toEqual([]);
  });
});
