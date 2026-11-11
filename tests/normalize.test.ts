import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizeName, normalizePhone } from "@/lib/normalize";

describe("normalisation", () => {
  it("unifies Arabic spelling variants for duplicate detection", () => {
    expect(normalizeName("أَحمد  مُحمّد")).toBe(normalizeName("احمد محمد"));
    expect(normalizeName("فاطمة")).toBe(normalizeName("فاطمه"));
  });
  it("normalises phones incl. Arabic-Indic digits and 00 prefix", () => {
    expect(normalizePhone("٠٠٢٢٢ ٣٠ ٠٠ ٠٠ ٠١")).toBe("+222300000" + "01");
    expect(normalizePhone("+222 30-00-00-01")).toBe("+22230000001");
    expect(normalizePhone("abc")).toBeNull();
  });
  it("normalises emails", () => {
    expect(normalizeEmail(" A@Example.ORG ")).toBe("a@example.org");
    expect(normalizeEmail("bad")).toBeNull();
  });
});
