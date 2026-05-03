import { describe, expect, it } from "vitest";
import type { GhIssue, GhNotification, GhPullRequest } from "../../src/types/github";
import {
  buildInboxItems,
  filterInboxItems,
  itemHasReason,
  mergeNotifications,
} from "../../src/utils/inbox";

const now = Date.parse("2026-05-03T12:00:00Z");

const issues: GhIssue[] = [
  {
    repository: { name: "app", nameWithOwner: "acme/app" },
    title: "Production bug is still open",
    url: "https://github.com/acme/app/issues/1",
    number: 1,
    createdAt: "2026-03-10T10:00:00Z",
    updatedAt: "2026-03-15T10:00:00Z",
    author: { login: "external" },
    labels: [{ name: "bug", color: "ff0000" }],
    commentsCount: 9,
    assignees: [],
  },
];

const pullRequests: GhPullRequest[] = [
  {
    repository: { name: "app", nameWithOwner: "acme/app" },
    title: "Ship auth cleanup",
    url: "https://github.com/acme/app/pull/10",
    number: 10,
    createdAt: "2026-05-01T10:00:00Z",
    updatedAt: "2026-05-02T10:00:00Z",
    author: { login: "alice" },
    labels: [{ name: "maintenance", color: "00ff00" }],
    commentsCount: 2,
    assignees: [{ login: "bob" }],
    isDraft: false,
    reviewDecision: null,
    reviewsCount: 0,
    additions: 120,
    deletions: 30,
    changedFiles: 6,
    baseRefName: "main",
    headRefName: "auth-cleanup",
  },
  {
    repository: { name: "cli", nameWithOwner: "acme/cli" },
    title: "Release command",
    url: "https://github.com/acme/cli/pull/4",
    number: 4,
    createdAt: "2026-04-30T10:00:00Z",
    updatedAt: "2026-05-02T10:00:00Z",
    author: { login: "carol" },
    labels: [],
    commentsCount: 1,
    assignees: [],
    isDraft: false,
    reviewDecision: "APPROVED",
    reviewsCount: 1,
    additions: 5,
    deletions: 1,
    changedFiles: 1,
    baseRefName: "main",
    headRefName: "release-command",
  },
];

describe("inbox utilities", () => {
  it("builds attention-ranked items from issues and pull requests", () => {
    const items = buildInboxItems({ issues, pullRequests, userLogin: "bob", now });

    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("Ship auth cleanup");
    expect(itemHasReason(items[0], "awaiting-review")).toBe(true);
    expect(itemHasReason(items[0], "assigned-me")).toBe(true);
  });

  it("detects stale unassigned issue work", () => {
    const items = buildInboxItems({ issues, pullRequests, userLogin: "bob", now });
    const issue = items.find((item) => item.kind === "issue");

    expect(issue).toBeDefined();
    expect(issue ? itemHasReason(issue, "stale") : false).toBe(true);
    expect(issue ? itemHasReason(issue, "no-assignee") : false).toBe(true);
    expect(issue ? itemHasReason(issue, "high-discussion") : false).toBe(true);
  });

  it("filters by mailbox and search", () => {
    const items = buildInboxItems({ issues, pullRequests, userLogin: "bob", now });

    expect(filterInboxItems(items, "needs-review").map((item) => item.number)).toEqual([10]);
    expect(filterInboxItems(items, "ready").map((item) => item.number)).toEqual([4]);
    expect(filterInboxItems(items, "unassigned").map((item) => item.number)).toEqual([4, 1]);
    expect(filterInboxItems(items, "inbox", "production").map((item) => item.number)).toEqual([1]);
  });

  it("merges GitHub notifications into matching items", () => {
    const items = buildInboxItems({ issues, pullRequests, userLogin: "bob", now });
    const notifications: GhNotification[] = [
      {
        id: "111",
        unread: true,
        reason: "mention",
        updatedAt: "2026-05-02T10:00:00Z",
        lastReadAt: null,
        subject: { title: "Production bug is still open", url: "https://api.github.com/repos/acme/app/issues/1", latestCommentUrl: null, type: "Issue" },
        repository: { name: "app", nameWithOwner: "acme/app", private: false, htmlUrl: "https://github.com/acme/app" },
        itemNumber: 1,
        itemHtmlUrl: "https://github.com/acme/app/issues/1",
      },
      {
        id: "222",
        unread: true,
        reason: "review_requested",
        updatedAt: "2026-05-02T10:00:00Z",
        lastReadAt: null,
        subject: { title: "Ship auth cleanup", url: "https://api.github.com/repos/acme/app/pulls/10", latestCommentUrl: null, type: "PullRequest" },
        repository: { name: "app", nameWithOwner: "acme/app", private: false, htmlUrl: "https://github.com/acme/app" },
        itemNumber: 10,
        itemHtmlUrl: "https://github.com/acme/app/pull/10",
      },
    ];

    const merged = mergeNotifications(items, notifications);
    const issue = merged.find((entry) => entry.kind === "issue");
    const pr = merged.find((entry) => entry.number === 10);

    expect(issue?.unread).toBe(true);
    expect(issue?.notificationThreadId).toBe("111");
    expect(itemHasReason(issue!, "mentioned")).toBe(true);
    expect(itemHasReason(issue!, "unread")).toBe(true);

    expect(pr?.notificationThreadId).toBe("222");
    expect(itemHasReason(pr!, "review-requested")).toBe(true);

    expect(filterInboxItems(merged, "unread").map((entry) => entry.number).sort()).toEqual([1, 10]);
    expect(filterInboxItems(merged, "mentioned").map((entry) => entry.number)).toEqual([1]);
    expect(filterInboxItems(merged, "review-requested").map((entry) => entry.number)).toEqual([10]);
  });

  it("leaves items unchanged when no notifications are provided", () => {
    const items = buildInboxItems({ issues, pullRequests, userLogin: "bob", now });
    const merged = mergeNotifications(items, []);

    expect(merged).toBe(items);
    expect(filterInboxItems(merged, "unread")).toEqual([]);
  });
});
