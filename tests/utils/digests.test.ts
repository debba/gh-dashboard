import { describe, expect, it } from "vitest";
import type { GhIssue, GhRepo } from "../../src/types/github";
import { buildDailyDigestEntries, buildDailyDigestRecord } from "../../src/utils/digests";

const reposDay1: GhRepo[] = [
  {
    nameWithOwner: "acme/app",
    name: "app",
    owner: { login: "acme" },
    description: null,
    stargazerCount: 10,
    forkCount: 2,
    primaryLanguage: { name: "TypeScript" },
    updatedAt: "2026-04-20T10:00:00Z",
    pushedAt: "2026-04-20T10:00:00Z",
    visibility: "PUBLIC",
    isPrivate: false,
    isArchived: false,
    isFork: false,
    url: "https://github.com/acme/app",
  },
];

const reposDay2: GhRepo[] = [
  {
    ...reposDay1[0],
    stargazerCount: 14,
    forkCount: 3,
  },
];

const issuesDay1: GhIssue[] = [
  {
    repository: { name: "app", nameWithOwner: "acme/app" },
    title: "A",
    url: "https://github.com/acme/app/issues/1",
    number: 1,
    createdAt: "2026-04-20T10:00:00Z",
    updatedAt: "2026-04-20T10:00:00Z",
    author: { login: "alice" },
    labels: [],
    commentsCount: 0,
    assignees: [],
  },
];

const issuesDay2: GhIssue[] = [
  ...issuesDay1,
  {
    repository: { name: "app", nameWithOwner: "acme/app" },
    title: "B",
    url: "https://github.com/acme/app/issues/2",
    number: 2,
    createdAt: "2026-04-21T10:00:00Z",
    updatedAt: "2026-04-21T10:00:00Z",
    author: { login: "bob" },
    labels: [],
    commentsCount: 0,
    assignees: [],
  },
];

describe("daily digest utilities", () => {
  it("builds snapshot records from repositories and issues", () => {
    const record = buildDailyDigestRecord(reposDay1, issuesDay1, new Date("2026-04-20T12:00:00Z").getTime());
    expect(record.date).toBe("2026-04-20");
    expect(record.totalStars).toBe(10);
    expect(record.issueCount).toBe(1);
    expect(record.repos[0].issueCount).toBe(1);
  });

  it("computes daily deltas and highlights", () => {
    const day1 = buildDailyDigestRecord(reposDay1, issuesDay1, new Date("2026-04-20T12:00:00Z").getTime());
    const day2 = buildDailyDigestRecord(reposDay2, issuesDay2, new Date("2026-04-21T12:00:00Z").getTime());
    const entries = buildDailyDigestEntries([day1, day2]);

    expect(entries[0].date).toBe("2026-04-21");
    expect(entries[0].starsDelta).toBe(4);
    expect(entries[0].issueDelta).toBe(1);
    expect(entries[0].repos[0].issueDelta).toBe(1);
    expect(entries[0].highlights.length).toBeGreaterThan(0);
  });
});
