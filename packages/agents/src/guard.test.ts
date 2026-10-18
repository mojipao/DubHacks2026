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

  it("rejects sending a menu-asker to a website", () => {
    const result = checkReply("You can see our menu on our website or app.", { ...base, inboundText: "Whats the menu?" });
    expect(result.ok).toBe(false);
  });

  it("rejects hours as an answer to a menu question", () => {
    const result = checkReply("Hi Musa, we are open Tue-Fri 06:30-15:00 and Sat-Sun 07:00-14:00.", {
      ...base,
      inboundText: "Whats the menu?",
    });
    expect(result.ok).toBe(false);
  });

  it("allows inviting an order over this chat", () => {
    const result = checkReply(
      "Hi! We take orders over this chat. What would you like, and when will you pick it up?",
      base,
    );
    expect(result.ok).toBe(true);
  });
});
