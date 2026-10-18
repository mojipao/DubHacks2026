import { describe, expect, it } from "vitest";
import { checkReply, type GuardFacts } from "./guard.ts";

const base: GuardFacts = {
  hasOrder: false,
  perkApplies: false,
  allergyFlagged: false,
  catalog: [],
  otherCustomerNames: [],
  inboundText: "hi",
};

describe("checkReply", () => {
  it("rejects claiming the shop cannot take orders by text", () => {
    const result = checkReply(
      "Hi Aahil, we can't take orders through this chat. You can place an order for pickup tomorrow at 12pm through our website or app!",
      base,
    );
    expect(result.ok).toBe(false);
    expect(result.blocking.join(" ")).toMatch(/take orders/i);
  });

  it("rejects promising a pickup when nothing is scheduled", () => {
    const result = checkReply("We'll let you know when it's ready for pickup.", base);
    expect(result.ok).toBe(false);
    expect(result.blocking.join(" ")).toMatch(/prepared|scheduled/i);
  });

  it("allows inviting an order over this chat", () => {
    const result = checkReply(
      "Hi! We take orders over this chat. What would you like, and when will you pick it up?",
      base,
    );
    expect(result.ok).toBe(true);
  });
});
