import { describe, expect, it } from "vitest";
import type { GhIssue, GhRepo } from "../../src/types/github";
import { buildRepoInsight } from "../../src/utils/insights";

const repo: GhRepo = {
  nameWithOwner: "acme/sdk",
  name: "sdk",
  owner: { login: "acme" },
  description: "SDK",
  stargazerCount: 120,
  forkCount: 14,
  primaryLanguage: { name: "TypeScript" },
  updatedAt: "2026-04-20T10:00:00Z",
  pushedAt: "2026-04-10T10:00:00Z",
  visibility: "PUBLIC",
  isPrivate: false,
  isArchived: false,
  isFork: false,
  url: "https://github.com/acme/sdk",
  history: [
    { date: "2026-04-01", stars: 110, forks: 12 },
    { date: "2026-04-23", stars: 120, forks: 14 },
  ],
};

const issues: GhIssue[] = [
  {
    repository: { name: "sdk", nameWithOwner: "acme/sdk" },
    title: "A",
    url: "https://github.com/acme/sdk/issues/1",
    number: 1,
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-10T10:00:00Z",
    author: { login: "alice" },
    labels: [],
    commentsCount: 0,
    assignees: [],
  },
  {
    repository: { name: "sdk", nameWithOwner: "acme/sdk" },
    title: "B",
    url: "https://github.com/acme/sdk/issues/2",
    number: 2,
    createdAt: "2026-04-15T10:00:00Z",
    updatedAt: "2026-04-22T10:00:00Z",
    author: { login: "bob" },
    labels: [],
    commentsCount: 0,
    assignees: [],
  },
];

describe("insight utilities", () => {
  it("builds a strong insight for active repositories", () => {
    const insight = buildRepoInsight({
      repo,
      issues,
      viewsCount: 320,
      viewsUniques: 140,
      releaseCount: 4,
      totalDownloads: 900,
      recentDownloads: 120,
      latestReleasePublishedAt: "2026-04-18T10:00:00Z",
      now: new Date("2026-04-23T10:00:00Z").getTime(),
    });

    expect(insight.healthScore).toBeGreaterThanOrEqual(80);
    expect(insight.healthLabel).toBe("strong");
    expect(insight.correlations.length).toBeGreaterThan(0);
  });

  it("creates risk alerts for inactive repositories with open issues", () => {
    const risky = buildRepoInsight({
      repo: { ...repo, pushedAt: "2026-01-01T10:00:00Z", updatedAt: "2026-01-01T10:00:00Z", history: [] },
      issues,
      viewsCount: 280,
      releaseCount: 0,
      totalDownloads: 20,
      now: new Date("2026-04-23T10:00:00Z").getTime(),
    });

    expect(risky.healthLabel).toBe("risky");
    expect(risky.alerts.some((alert) => /No push/i.test(alert))).toBe(true);
    expect(risky.opportunities.some((item) => /without any formal releases/i.test(item))).toBe(true);
  });
});
