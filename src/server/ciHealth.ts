import type { GhRepo } from "../types/github";
import { getReposCached } from "./dashboardData";
import { AuthRequiredError, restApi } from "./githubClient";

export interface CIRunSummary {
  id: number;
  workflowName: string;
  status: string;
  conclusion: string | null;
  event: string;
  headBranch: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  durationSec: number | null;
}

export interface RepoCIHealth {
  repo: string;
  url: string;
  totalRuns: number;
  successCount: number;
  failureCount: number;
  cancelledCount: number;
  skippedCount: number;
  inProgressCount: number;
  successRate: number; // 0..1, computed on success+failure only
  avgDurationSec: number | null;
  lastRun: CIRunSummary | null;
  lastFailure: CIRunSummary | null;
  lastSuccess: CIRunSummary | null;
}

export type CIHealthResult =
  | { ok: true; repos: RepoCIHealth[]; fetchedAt: string }
  | { ok: false; error: string; needsAuth?: true };

interface RawWorkflowRun {
  id: number;
  name: string | null;
  status: string;
  conclusion: string | null;
  event: string;
  head_branch: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at?: string | null;
}

interface RawWorkflowRunsResponse {
  total_count: number;
  workflow_runs: RawWorkflowRun[];
}

const RUNS_PER_REPO = 30;
const CONCURRENCY = 6;
const TTL_MS = 10 * 60 * 1000;

function summarizeRun(run: RawWorkflowRun): CIRunSummary {
  const start = run.run_started_at ?? run.created_at;
  const end = run.updated_at;
  const durationMs = end && start ? Date.parse(end) - Date.parse(start) : NaN;
  return {
    id: run.id,
    workflowName: run.name || "workflow",
    status: run.status,
    conclusion: run.conclusion,
    event: run.event,
    headBranch: run.head_branch,
    url: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    durationSec: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs / 1000)) : null,
  };
}

function aggregate(repo: GhRepo, runs: RawWorkflowRun[]): RepoCIHealth | null {
  if (!runs.length) return null;
  let success = 0;
  let failure = 0;
  let cancelled = 0;
  let skipped = 0;
  let inProgress = 0;
  let durSum = 0;
  let durCount = 0;
  let lastFailure: CIRunSummary | null = null;
  let lastSuccess: CIRunSummary | null = null;
  for (const run of runs) {
    if (run.status !== "completed") {
      inProgress += 1;
      continue;
    }
    switch (run.conclusion) {
      case "success":
        success += 1;
        if (!lastSuccess) lastSuccess = summarizeRun(run);
        break;
      case "failure":
      case "timed_out":
      case "startup_failure":
      case "action_required":
        failure += 1;
        if (!lastFailure) lastFailure = summarizeRun(run);
        break;
      case "cancelled":
        cancelled += 1;
        break;
      case "skipped":
      case "neutral":
        skipped += 1;
        break;
      default:
        skipped += 1;
    }
    const summary = summarizeRun(run);
    if (summary.durationSec != null) {
      durSum += summary.durationSec;
      durCount += 1;
    }
  }
  const decided = success + failure;
  const successRate = decided ? success / decided : 0;
  return {
    repo: repo.nameWithOwner,
    url: repo.url,
    totalRuns: runs.length,
    successCount: success,
    failureCount: failure,
    cancelledCount: cancelled,
    skippedCount: skipped,
    inProgressCount: inProgress,
    successRate,
    avgDurationSec: durCount ? Math.round(durSum / durCount) : null,
    lastRun: summarizeRun(runs[0]),
    lastFailure,
    lastSuccess,
  };
}

async function fetchRepoRuns(repo: GhRepo): Promise<RawWorkflowRun[] | "auth-required"> {
  const path = `/repos/${repo.nameWithOwner}/actions/runs?per_page=${RUNS_PER_REPO}`;
  const result = await restApi<RawWorkflowRunsResponse>(path);
  if (!result.ok) {
    if (result.status === 401) return "auth-required";
    // 404 / 403 (no actions, no access) → treat as no runs
    return [];
  }
  return result.data?.workflow_runs ?? [];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(runners);
  return results;
}

let cache: { value: CIHealthResult; expiresAt: number } | null = null;
let inflight: Promise<CIHealthResult> | null = null;

async function build(): Promise<CIHealthResult> {
  const reposResult = await getReposCached(false);
  if (!reposResult.ok) {
    return reposResult.needsAuth
      ? { ok: false, error: "authentication required", needsAuth: true }
      : { ok: false, error: reposResult.error };
  }
  const candidates = reposResult.repos.filter((repo) => !repo.isArchived);
  try {
    let authRequired = false;
    const perRepo = await mapWithConcurrency(candidates, CONCURRENCY, async (repo) => {
      const runs = await fetchRepoRuns(repo);
      if (runs === "auth-required") {
        authRequired = true;
        return null;
      }
      return aggregate(repo, runs);
    });
    if (authRequired) return { ok: false, error: "authentication required", needsAuth: true };
    const repos = perRepo.filter((entry): entry is RepoCIHealth => Boolean(entry));
    repos.sort((a, b) => a.successRate - b.successRate || b.failureCount - a.failureCount);
    return { ok: true, repos, fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { ok: false, error: "authentication required", needsAuth: true };
    }
    return { ok: false, error: (error as Error).message || String(error) };
  }
}

export function getCIHealthCached(forceFresh: boolean): Promise<CIHealthResult> {
  if (!forceFresh && cache && cache.expiresAt > Date.now()) return Promise.resolve(cache.value);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const value = await build();
      if (value.ok) cache = { value, expiresAt: Date.now() + TTL_MS };
      return value;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function invalidateCIHealthCache(): void {
  cache = null;
}
