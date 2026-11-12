import { describe, expect, it } from "vitest";
import { utcToZonedInput, zonedInputToUtc } from "@/lib/time";

describe("timezone conversion", () => {
  it("round-trips in a DST zone and handles offsets", () => {
    const d = zonedInputToUtc("2026-07-01T18:30", "Europe/Paris")!;
    expect(d.toISOString()).toBe("2026-07-01T16:30:00.000Z");
    expect(utcToZonedInput(d, "Europe/Paris")).toBe("2026-07-01T18:30");
    expect(zonedInputToUtc("2026-01-01T18:30", "Europe/Paris")!.toISOString()).toBe("2026-01-01T17:30:00.000Z");
  });
  it("Nouakchott is UTC+0", () => {
    expect(zonedInputToUtc("2026-11-12T09:00", "Africa/Nouakchott")!.toISOString()).toBe("2026-11-12T09:00:00.000Z");
  });
  it("rejects malformed input", () => {
    expect(zonedInputToUtc("tomorrow")).toBeNull();
    expect(zonedInputToUtc("")).toBeNull();
  });
});
