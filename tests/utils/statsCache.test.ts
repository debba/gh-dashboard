import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearStatsCache, readStatsCache, writeStatsCache } from "../../src/utils/statsCache";

describe("statsCache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns null when no cache exists", () => {
    expect(readStatsCache()).toBeNull();
  });

  it("writes and reads back cached stats", () => {
    const data = {
      repos: [{ nameWithOwner: "acme/app", stargazerCount: 10 }],
      owners: ["acme"],
      issues: [{ title: "Bug" }],
      pullRequests: [{ title: "Fix" }],
      fetchedAt: "2026-04-29T10:00:00Z",
    };

    writeStatsCache(data);
    const result = readStatsCache();

    expect(result).not.toBeNull();
    expect(result!.repos).toEqual(data.repos);
    expect(result!.owners).toEqual(data.owners);
    expect(result!.issues).toEqual(data.issues);
    expect(result!.pullRequests).toEqual(data.pullRequests);
    expect(result!.fetchedAt).toBe(data.fetchedAt);
    expect(result!.savedAt).toBeGreaterThan(0);
  });

  it("clears cached stats", () => {
    writeStatsCache({
      repos: [],
      owners: [],
      issues: [],
      pullRequests: [],
      fetchedAt: "",
    });

    clearStatsCache();
    expect(readStatsCache()).toBeNull();
  });

  it("returns null for corrupted JSON", () => {
    localStorage.setItem("gh-dash.cache.stats", "not-json{{{");
    expect(readStatsCache()).toBeNull();
  });

  it("returns null if data shape is invalid", () => {
    localStorage.setItem("gh-dash.cache.stats", JSON.stringify({ repos: "not-array" }));
    expect(readStatsCache()).toBeNull();
  });

  it("handles localStorage quota errors gracefully", () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("QuotaExceededError");
    };

    // Should not throw
    expect(() => writeStatsCache({
      repos: [],
      owners: [],
      issues: [],
      pullRequests: [],
      fetchedAt: "",
    })).not.toThrow();

    Storage.prototype.setItem = originalSetItem;
  });
});
