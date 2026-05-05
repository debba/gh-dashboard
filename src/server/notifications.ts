import type { GhNotification, GhNotificationReason, NotificationsData } from "../types/github";
import { AuthRequiredError, getToken } from "./githubClient";

const API_ROOT = "https://api.github.com";
const USER_AGENT = "gh-issues-dashboard";
const PAGE_LIMIT = 5;
const PER_PAGE = 50;
const TTL_MS = 60 * 1000;
const DEFAULT_POLL_INTERVAL = 60;

interface RawNotification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  last_read_at: string | null;
  subject: {
    title: string;
    url: string | null;
    latest_comment_url: string | null;
    type: string;
  };
  repository: {
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
  };
}

function authHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(extra ?? {}),
  };
}

function parseNextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part.trim());
    if (match) return match[1];
  }
  return null;
}

const SUBJECT_NUMBER_PATTERN = /\/(?:issues|pulls)\/(\d+)$/;

function deriveItemNumber(subjectUrl: string | null): number | null {
  if (!subjectUrl) return null;
  const match = SUBJECT_NUMBER_PATTERN.exec(subjectUrl);
  return match ? Number(match[1]) : null;
}

function deriveItemHtmlUrl(repoHtmlUrl: string, subjectUrl: string | null, subjectType: string, itemNumber: number | null): string | null {
  if (!itemNumber || !subjectUrl) return null;
  if (subjectType === "PullRequest") return `${repoHtmlUrl}/pull/${itemNumber}`;
  if (subjectType === "Issue") return `${repoHtmlUrl}/issues/${itemNumber}`;
  return null;
}

function normalizeReason(reason: string): GhNotificationReason {
  return reason as GhNotificationReason;
}

function normalize(raw: RawNotification): GhNotification {
  const itemNumber = deriveItemNumber(raw.subject?.url ?? null);
  return {
    id: raw.id,
    unread: Boolean(raw.unread),
    reason: normalizeReason(raw.reason),
    updatedAt: raw.updated_at,
    lastReadAt: raw.last_read_at,
    subject: {
      title: raw.subject?.title ?? "",
      url: raw.subject?.url ?? null,
      latestCommentUrl: raw.subject?.latest_comment_url ?? null,
      type: raw.subject?.type ?? "",
    },
    repository: {
      name: raw.repository?.name ?? "",
      nameWithOwner: raw.repository?.full_name ?? "",
      private: Boolean(raw.repository?.private),
      htmlUrl: raw.repository?.html_url ?? "",
    },
    itemNumber,
    itemHtmlUrl: deriveItemHtmlUrl(
      raw.repository?.html_url ?? "",
      raw.subject?.url ?? null,
      raw.subject?.type ?? "",
      itemNumber,
    ),
  };
}

interface FetchState {
  notifications: GhNotification[];
  lastModified: string | null;
  pollInterval: number;
  fetchedAt: string;
}

let cache: { state: FetchState; expiresAt: number } | null = null;
let inflight: Promise<NotificationsResult> | null = null;

export type NotificationsResult =
  | { ok: true; data: NotificationsData }
  | { ok: false; error: string; needsAuth?: true };

async function fetchPage(token: string, url: string, ifModifiedSince: string | null): Promise<{ status: number; raw: RawNotification[]; nextUrl: string | null; lastModified: string | null; pollInterval: number; }> {
  const headers = authHeaders(token, ifModifiedSince ? { "If-Modified-Since": ifModifiedSince } : undefined);
  const response = await fetch(url, { headers });
  if (response.status === 401) throw new AuthRequiredError();
  const lastModified = response.headers.get("last-modified");
  const intervalHeader = response.headers.get("x-poll-interval");
  const pollInterval = intervalHeader ? Math.max(1, Number(intervalHeader)) : DEFAULT_POLL_INTERVAL;
  if (response.status === 304) {
    return { status: 304, raw: [], nextUrl: null, lastModified, pollInterval };
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  const raw = (await response.json()) as RawNotification[];
  return {
    status: response.status,
    raw,
    nextUrl: parseNextLink(response.headers.get("link")),
    lastModified,
    pollInterval,
  };
}

async function fetchAllNotifications(token: string, ifModifiedSince: string | null): Promise<{ refreshed: boolean; notifications: GhNotification[]; lastModified: string | null; pollInterval: number; }> {
  const initial = `${API_ROOT}/notifications?all=true&participating=false&per_page=${PER_PAGE}`;
  const collected: GhNotification[] = [];
  let url: string | null = initial;
  let firstLastModified: string | null = null;
  let firstPollInterval = DEFAULT_POLL_INTERVAL;
  let firstStatus = 0;
  let pages = 0;

  while (url && pages < PAGE_LIMIT) {
    const ims = pages === 0 ? ifModifiedSince : null;
    const page = await fetchPage(token, url, ims);
    if (pages === 0) {
      firstLastModified = page.lastModified;
      firstPollInterval = page.pollInterval;
      firstStatus = page.status;
      if (page.status === 304) {
        return { refreshed: false, notifications: [], lastModified: firstLastModified, pollInterval: firstPollInterval };
      }
    }
    for (const raw of page.raw) collected.push(normalize(raw));
    url = page.nextUrl;
    pages += 1;
  }

  return {
    refreshed: firstStatus !== 304,
    notifications: collected,
    lastModified: firstLastModified,
    pollInterval: firstPollInterval,
  };
}

function toResponse(state: FetchState): NotificationsData {
  return {
    ok: true,
    notifications: state.notifications,
    fetchedAt: state.fetchedAt,
    pollInterval: state.pollInterval,
  };
}

async function loadFresh(): Promise<NotificationsResult> {
  let token: string;
  try {
    token = await getToken();
  } catch (error) {
    if (error instanceof AuthRequiredError) return { ok: false, error: "authentication required", needsAuth: true };
    return { ok: false, error: (error as Error).message || String(error) };
  }
  try {
    const ifModifiedSince = cache?.state.lastModified ?? null;
    const result = await fetchAllNotifications(token, ifModifiedSince);
    const fetchedAt = new Date().toISOString();
    if (!result.refreshed && cache) {
      const state: FetchState = {
        notifications: cache.state.notifications,
        lastModified: result.lastModified ?? cache.state.lastModified,
        pollInterval: result.pollInterval,
        fetchedAt,
      };
      cache = { state, expiresAt: Date.now() + TTL_MS };
      return { ok: true, data: toResponse(state) };
    }
    const state: FetchState = {
      notifications: result.notifications,
      lastModified: result.lastModified,
      pollInterval: result.pollInterval,
      fetchedAt,
    };
    cache = { state, expiresAt: Date.now() + TTL_MS };
    return { ok: true, data: toResponse(state) };
  } catch (error) {
    if (error instanceof AuthRequiredError) return { ok: false, error: "authentication required", needsAuth: true };
    return { ok: false, error: (error as Error).message || String(error) };
  }
}

export async function getNotificationsCached(forceFresh: boolean): Promise<NotificationsResult> {
  if (!forceFresh && cache && cache.expiresAt > Date.now()) {
    return { ok: true, data: toResponse(cache.state) };
  }
  if (inflight) return inflight;
  inflight = loadFresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

export interface ReadResult {
  ok: boolean;
  status: number;
  error?: string;
  needsAuth?: true;
}

async function mutate(method: "PATCH" | "PUT", path: string, body?: unknown): Promise<ReadResult> {
  let token: string;
  try {
    token = await getToken();
  } catch (error) {
    if (error instanceof AuthRequiredError) return { ok: false, status: 401, error: "authentication required", needsAuth: true };
    return { ok: false, status: 500, error: (error as Error).message || String(error) };
  }
  try {
    const response = await fetch(`${API_ROOT}${path}`, {
      method,
      headers: authHeaders(token, body ? { "Content-Type": "application/json" } : undefined),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401) return { ok: false, status: 401, error: "authentication required", needsAuth: true };
    if (!response.ok && response.status !== 205) {
      const text = await response.text();
      return { ok: false, status: response.status, error: text || `HTTP ${response.status}` };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, status: 500, error: (error as Error).message || String(error) };
  }
}

function patchCacheThreadRead(threadId: string): void {
  if (!cache) return;
  const next = cache.state.notifications.map((entry) =>
    entry.id === threadId ? { ...entry, unread: false, lastReadAt: new Date().toISOString() } : entry,
  );
  cache = { state: { ...cache.state, notifications: next }, expiresAt: cache.expiresAt };
}

function patchCacheAllRead(repoFullName: string | null, lastReadAt: string): void {
  if (!cache) return;
  const next = cache.state.notifications.map((entry) => {
    if (repoFullName && entry.repository.nameWithOwner !== repoFullName) return entry;
    if (Date.parse(entry.updatedAt) > Date.parse(lastReadAt)) return entry;
    return { ...entry, unread: false, lastReadAt };
  });
  cache = { state: { ...cache.state, notifications: next }, expiresAt: cache.expiresAt };
}

export async function markThreadRead(threadId: string): Promise<ReadResult> {
  const result = await mutate("PATCH", `/notifications/threads/${encodeURIComponent(threadId)}`);
  if (result.ok) patchCacheThreadRead(threadId);
  return result;
}

export async function markAllRead(options: { repo?: string | null; lastReadAt?: string | null } = {}): Promise<ReadResult> {
  const lastReadAt = options.lastReadAt ?? new Date().toISOString();
  const path = options.repo ? `/repos/${options.repo}/notifications` : "/notifications";
  const result = await mutate("PUT", path, { last_read_at: lastReadAt, read: true });
  if (result.ok) patchCacheAllRead(options.repo ?? null, lastReadAt);
  return result;
}

export function invalidateNotificationsCache(): void {
  cache = null;
}
