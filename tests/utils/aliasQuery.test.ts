import { describe, expect, it } from "vitest";
import {
  buildMentionQuery,
  isValidRepoName,
  normalizeAliases,
} from "../../src/utils/aliasQuery";

describe("aliasQuery utilities", () => {
  it("validates owner/repo identifiers", () => {
    expect(isValidRepoName("openai/codex")).toBe(true);
    expect(isValidRepoName("my-org.x/repo_1.0")).toBe(true);
    expect(isValidRepoName("missing-slash")).toBe(false);
    expect(isValidRepoName("too/many/parts")).toBe(false);
    expect(isValidRepoName("")).toBe(false);
  });

  it("strips whitespace, dedupes, and removes the canonical name", () => {
    expect(
      normalizeAliases("openai/codex", ["  openai/old  ", "openai/codex", "openai/old", "bad", ""])
    ).toEqual(["openai/old"]);
  });

  it("builds a quoted OR query including the canonical repo first", () => {
    expect(buildMentionQuery("openai/codex", ["openai/old", "old-org/codex"])).toBe(
      `"openai/codex" OR "openai/old" OR "old-org/codex"`
    );
  });

  it("returns just the canonical name when no aliases are provided", () => {
    expect(buildMentionQuery("openai/codex", [])).toBe(`"openai/codex"`);
  });
});
