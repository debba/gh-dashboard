import type { GhNotification, NotificationsData } from "../types/github";
import { getActive as getActiveAccount } from "./accountStore";
import { getProviderForAccount } from "./providers/registry";
import type { Account, Provider } from "./providers/types";

const TTL_MS = 60 * 1000;

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

function toResponse(state: FetchState): NotificationsData {
  return {
    ok: true,
    notifications: state.notifications,
    fetchedAt: state.fetchedAt,
    pollInterval: state.pollInterval,
  };
}

async function resolveActive(): Promise<{ account: Account; provider: Provider } | null> {
  const account = await getActiveAccount();
  if (!account) return null;
  const provider = await getProviderForAccount(account);
  return { account, provider };
}

async function loadFresh(): Promise<NotificationsResult> {
  const active = await resolveActive();
  if (!active) return { ok: false, error: "authentication required", needsAuth: true };
  const ifModifiedSince = cache?.state.lastModified ?? null;
  const result = await active.provider.fetchNotifications(active.account, ifModifiedSince);
  if (!result.ok) return { ok: false, error: result.error, needsAuth: result.needsAuth };
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
  const active = await resolveActive();
  if (!active) return { ok: false, status: 401, error: "authentication required", needsAuth: true };
  const result = await active.provider.markNotificationRead(active.account, threadId);
  if (result.ok) {
    patchCacheThreadRead(threadId);
    return { ok: true, status: result.status };
  }
  return { ok: false, status: result.status, error: result.error, needsAuth: result.needsAuth };
}

export async function markAllRead(options: { repo?: string | null; lastReadAt?: string | null } = {}): Promise<ReadResult> {
  const lastReadAt = options.lastReadAt ?? new Date().toISOString();
  const active = await resolveActive();
  if (!active) return { ok: false, status: 401, error: "authentication required", needsAuth: true };
  const result = await active.provider.markAllNotificationsRead(active.account, { repo: options.repo, lastReadAt });
  if (result.ok) {
    patchCacheAllRead(options.repo ?? null, lastReadAt);
    return { ok: true, status: result.status };
  }
  return { ok: false, status: result.status, error: result.error, needsAuth: result.needsAuth };
}

export function invalidateNotificationsCache(): void {
  cache = null;
}
