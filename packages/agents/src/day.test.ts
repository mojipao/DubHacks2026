import { describe, expect, it } from "vitest";
import { dayFromText } from "./understand.ts";

const TZ = "America/Los_Angeles";

describe("dayFromText", () => {
  // 2026-10-17 is a Saturday: the case models get wrong.
  it("reads Saturday on a Saturday as next Saturday", () => {
    expect(dayFromText("4 dozen milk cakes for Saturday 9am", "2026-10-17", TZ)).toBe("2026-10-24");
  });
  it("reads Sunday as the day after that Saturday", () => {
    expect(dayFromText("2 pistachio maamoul sunday", "2026-10-17", TZ)).toBe("2026-10-25");
  });
  it("reads tomorrow and today", () => {
    expect(dayFromText("adeni chai tomorrow", "2026-10-17", TZ)).toBe("2026-10-18");
    expect(dayFromText("can I grab a qishr today", "2026-10-17", TZ)).toBe("2026-10-17");
  });
  it("returns null when no day is named", () => {
    expect(dayFromText("do you have milk cake?", "2026-10-17", TZ)).toBeNull();
  });
});
