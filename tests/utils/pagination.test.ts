import { describe, expect, it } from "vitest";
import { clampPage, getPageWindow } from "../../src/utils/pagination";

describe("pagination utilities", () => {
  it("builds compact page windows", () => {
    expect(getPageWindow(1, 1)).toEqual([1]);
    expect(getPageWindow(5, 10)).toEqual([1, "...", 4, 5, 6, "...", 10]);
    expect(getPageWindow(2, 10)).toEqual([1, 2, 3, "...", 10]);
  });

  it("clamps pages to available bounds", () => {
    expect(clampPage(-2, 100, 20)).toBe(1);
    expect(clampPage(99, 100, 20)).toBe(5);
    expect(clampPage(3, 100, 20)).toBe(3);
  });
});
