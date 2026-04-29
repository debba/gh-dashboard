import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DailyRepoDigest, GhIssue, GhRepo } from "../types/github";
import { buildDailyDigestEntries, buildDailyDigestRecord, type DailyDigestRecord } from "../utils/digests";
import { DATA_DIR, DIGESTS_PATH } from "./config";
import { sendJsonCacheable } from "./http";
import { maybeGenerateOpenAIDigest } from "./openaiDigest";

const MAX_DIGEST_DAYS = 120;

let digestsCache: DailyDigestRecord[] | null = null;
let digestsLoadPromise: Promise<DailyDigestRecord[]> | null = null;

async function loadDigests(): Promise<DailyDigestRecord[]> {
  if (digestsCache) return digestsCache;
  if (digestsLoadPromise) return digestsLoadPromise;
  digestsLoadPromise = (async () => {
    try {
      const raw = await readFile(DIGESTS_PATH, "utf-8");
      digestsCache = JSON.parse(raw) as DailyDigestRecord[];
    } catch {
      digestsCache = [];
    }
    return digestsCache;
  })();
  return digestsLoadPromise;
}

async function saveDigests(): Promise<void> {
  if (!digestsCache) return;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DIGESTS_PATH, JSON.stringify(digestsCache));
}

export async function recordDailyDigest(repos: GhRepo[], issues: GhIssue[]): Promise<void> {
  const digests = await loadDigests();
  const today = buildDailyDigestRecord(repos, issues);
  const existing = digests.find((entry) => entry.date === today.date);
  if (existing) {
    Object.assign(existing, today);
  } else {
    digests.push(today);
    digests.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    if (digests.length > MAX_DIGEST_DAYS) digests.splice(0, digests.length - MAX_DIGEST_DAYS);
  }
  await saveDigests();
}

export async function handleDailyDigests(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const records = await loadDigests();
  const latest = records[records.length - 1];
  if (latest && !latest.ai) {
    try {
      latest.ai = await maybeGenerateOpenAIDigest(latest);
      await saveDigests();
    } catch {
      // AI enrichment is optional and should never break digest delivery.
    }
  }
  const digests = buildDailyDigestEntries(records);
  sendJsonCacheable(req, res, 200, {
    ok: true,
    generatedAt: digests[0]?.date ?? "",
    digests,
  });
}

export async function getLatestRepoDigest(repo: string): Promise<DailyRepoDigest | null> {
  const records = await loadDigests();
  const entries = buildDailyDigestEntries(records);
  const latest = entries[0];
  if (!latest) return null;
  const repoDigest = latest.repos.find((entry) => entry.repo === repo);
  if (!repoDigest) return null;
  if (!repoDigest.ai) {
    try {
      repoDigest.ai = await maybeGenerateOpenAIDigest(repoDigest);
    } catch {
      repoDigest.ai = null;
    }
  }
  return repoDigest;
}
