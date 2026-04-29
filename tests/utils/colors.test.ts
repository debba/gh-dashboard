import { describe, expect, it } from "vitest";
import { getContrastColor, getLanguageColor } from "../../src/utils/colors";

describe("color utilities", () => {
  it("selects readable contrast colors", () => {
    expect(getContrastColor("ffffff")).toBe("#0a0c12");
    expect(getContrastColor("000000")).toBe("#e7eaf3");
    expect(getContrastColor("")).toBe("#e7eaf3");
  });

  it("returns stable language colors", () => {
    expect(getLanguageColor("TypeScript")).toBe(getLanguageColor("TypeScript"));
    expect(getLanguageColor("")).toBe("#6e7280");
  });
});
