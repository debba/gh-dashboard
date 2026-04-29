import type { GhIssue, GhLabel, GhPullRequest, GhRepo, GhUser, ReviewDecision } from "../types/github";
import { recordDailyDigest } from "./digests";
import { AuthRequiredError, gql, restApi } from "./githubClient";
import { attachHistory, recordSnapshots } from "./snapshots";

export type ReposResult =
  | { ok: true; repos: GhRepo[]; owners: string[]; fetchedAt: string }
  | { ok: false; error: string; needsAuth?: true };

export type IssuesResult =
  | { ok: true; issues: GhIssue[]; owners: string[]; fetchedAt: string }
  | { ok: false; error: string; needsAuth?: true };

export type PullRequestsResult =
  | { ok: true; pullRequests: GhPullRequest[]; owners: string[]; fetchedAt: string }
  | { ok: false; error: string; needsAuth?: true };

type OwnersResult =
  | { ok: true; owners: string[] }
  | { ok: false; error: string; needsAuth?: true };

const ISSUE_SEARCH_QUERY = `
query($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: 100, after: $cursor) {
    issueCount
    pageInfo { endCursor hasNextPage }
    nodes {
      __typename
      ... on Issue {
        number title url createdAt updatedAt
        author { login url }
        repository { name nameWithOwner }
        labels(first: 20) { nodes { name color description } }
        comments { totalCount }
        assignees(first: 10) { nodes { login url avatarUrl } }
      }
    }
  }
}`;

const REPO_LIST_QUERY = `
query($owner: String!, $cursor: String) {
  repositoryOwner(login: $owner) {
    repositories(first: 100, after: $cursor, ownerAffiliations: [OWNER]) {
      pageInfo { endCursor hasNextPage }
      nodes {
        nameWithOwner name
        owner { login avatarUrl }
        description stargazerCount forkCount
        primaryLanguage { name }
        updatedAt pushedAt
        visibility
        isPrivate isArchived isFork url
      }
    }
  }
}`;

const PR_SEARCH_QUERY = `
query($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: 100, after: $cursor) {
    issueCount
    pageInfo { endCursor hasNextPage }
    nodes {
      __typename
      ... on PullRequest {
        number title url createdAt updatedAt
        isDraft reviewDecision
        author { login url }
        repository { name nameWithOwner }
        labels(first: 20) { nodes { name color description } }
        comments { totalCount }
        reviews { totalCount }
        assignees(first: 10) { nodes { login url avatarUrl } }
        additions deletions changedFiles
        baseRefName headRefName
      }
    }
  }
}`;

const ISSUE_PAGE_LIMIT = 10;
const PR_PAGE_LIMIT = 10;
const REPO_PAGE_LIMIT = 10;

interface IssueSearchNode {
  __typename: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string; url: string } | null;
  repository: { name: string; nameWithOwner: string };
  labels: { nodes: GhLabel[] };
  comments: { totalCount: number };
  assignees: { nodes: GhUser[] };
}

interface IssueSearchResponse {
  search: {
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
    nodes: (IssueSearchNode | { __typename: string })[];
  };
}

interface PullRequestSearchNode {
  __typename: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  reviewDecision: ReviewDecision;
  author: { login: string; url: string } | null;
  repository: { name: string; nameWithOwner: string };
  labels: { nodes: GhLabel[] };
  comments: { totalCount: number };
  reviews: { totalCount: number };
  assignees: { nodes: GhUser[] };
  additions: number;
  deletions: number;
  changedFiles: number;
  baseRefName: string;
  headRefName: string;
}

interface PullRequestSearchResponse {
  search: {
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
    nodes: (PullRequestSearchNode | { __typename: string })[];
  };
}

interface RepoNode {
  nameWithOwner: string;
  name: string;
  owner: { login: string; avatarUrl?: string };
  description: string | null;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: { name: string } | null;
  updatedAt: string;
  pushedAt: string;
  visibility: string;
  isPrivate: boolean;
  isArchived: boolean;
  isFork: boolean;
  url: string;
}

interface RepoListResponse {
  repositoryOwner: {
    repositories: {
      pageInfo: { endCursor: string | null; hasNextPage: boolean };
      nodes: RepoNode[];
    };
  } | null;
}

async function fetchOwners(): Promise<OwnersResult> {
  try {
    const userResult = await restApi<{ login: string }>("/user");
    if (!userResult.ok) {
      if (userResult.status === 401) return { ok: false, error: "authentication required", needsAuth: true };
      return { ok: false, error: `/user: ${userResult.error}` };
    }
    const orgsResult = await restApi<{ login: string }[]>("/user/orgs");
    if (!orgsResult.ok) {
      if (orgsResult.status === 401) return { ok: false, error: "authentication required", needsAuth: true };
      return { ok: false, error: `/user/orgs: ${orgsResult.error}` };
    }
    const orgs = orgsResult.data.map((entry) => entry.login).filter(Boolean);
    const owners = Array.from(new Set([userResult.data.login, ...orgs].filter(Boolean)));
    return { ok: true, owners };
  } catch (error: unknown) {
    if (error instanceof AuthRequiredError) return { ok: false, error: "authentication required", needsAuth: true };
    return { ok: false, error: (error as Error).message || String(error) };
  }
}

function buildIssueQuery(owners: string[]): string {
  const ownerScope = owners.map((owner) => `user:${owner}`).join(" ");
  return `is:issue is:open ${ownerScope}`.trim();
}

function buildPullRequestQuery(owners: string[]): string {
  const ownerScope = owners.map((owner) => `user:${owner}`).join(" ");
  return `is:pr is:open ${ownerScope}`.trim();
}

async function fetchIssues(owners: string[]): Promise<GhIssue[]> {
  if (!owners.length) return [];
  const q = buildIssueQuery(owners);
  const collected: GhIssue[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < ISSUE_PAGE_LIMIT; page++) {
    const data: IssueSearchResponse = await gql<IssueSearchResponse>(ISSUE_SEARCH_QUERY, { q, cursor });
    for (const raw of data.search.nodes) {
      if (raw.__typename !== "Issue") continue;
      const node = raw as IssueSearchNode;
      collected.push({
        repository: node.repository,
        title: node.title,
        url: node.url,
        number: node.number,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        author: node.author ?? undefined,
        labels: node.labels?.nodes ?? [],
        commentsCount: node.comments?.totalCount ?? 0,
        assignees: node.assignees?.nodes ?? [],
      });
    }
    if (!data.search.pageInfo.hasNextPage) break;
    cursor = data.search.pageInfo.endCursor;
    if (!cursor) break;
  }
  return collected;
}

async function fetchPullRequests(owners: string[]): Promise<GhPullRequest[]> {
  if (!owners.length) return [];
  const q = buildPullRequestQuery(owners);
  const collected: GhPullRequest[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < PR_PAGE_LIMIT; page++) {
    const data: PullRequestSearchResponse = await gql<PullRequestSearchResponse>(PR_SEARCH_QUERY, { q, cursor });
    for (const raw of data.search.nodes) {
      if (raw.__typename !== "PullRequest") continue;
      const node = raw as PullRequestSearchNode;
      collected.push({
        repository: node.repository,
        title: node.title,
        url: node.url,
        number: node.number,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        author: node.author ?? undefined,
        labels: node.labels?.nodes ?? [],
        commentsCount: node.comments?.totalCount ?? 0,
        assignees: node.assignees?.nodes ?? [],
        isDraft: node.isDraft,
        reviewDecision: node.reviewDecision,
        reviewsCount: node.reviews?.totalCount ?? 0,
        additions: node.additions,
        deletions: node.deletions,
        changedFiles: node.changedFiles,
        baseRefName: node.baseRefName,
        headRefName: node.headRefName,
      });
    }
    if (!data.search.pageInfo.hasNextPage) break;
    cursor = data.search.pageInfo.endCursor;
    if (!cursor) break;
  }
  return collected;
}

async function fetchReposForOwner(owner: string): Promise<GhRepo[]> {
  const collected: GhRepo[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < REPO_PAGE_LIMIT; page++) {
    let data: RepoListResponse;
    try {
      data = await gql<RepoListResponse>(REPO_LIST_QUERY, { owner, cursor });
    } catch {
      return collected;
    }
    const owned = data.repositoryOwner?.repositories;
    if (!owned) return collected;
    for (const node of owned.nodes) {
      collected.push({
        nameWithOwner: node.nameWithOwner,
        name: node.name,
        owner: node.owner,
        description: node.description,
        stargazerCount: node.stargazerCount,
        forkCount: node.forkCount,
        primaryLanguage: node.primaryLanguage,
        updatedAt: node.updatedAt,
        pushedAt: node.pushedAt,
        visibility: node.visibility?.toLowerCase() ?? "",
        isPrivate: node.isPrivate,
        isArchived: node.isArchived,
        isFork: node.isFork,
        url: node.url,
      });
    }
    if (!owned.pageInfo.hasNextPage) break;
    cursor = owned.pageInfo.endCursor;
    if (!cursor) break;
  }
  return collected;
}

async function fetchAllRepos(owners: string[]): Promise<GhRepo[]> {
  const lists = await Promise.all(owners.map(fetchReposForOwner));
  const seen = new Set<string>();
  const repos: GhRepo[] = [];
  for (const list of lists) {
    for (const repo of list) {
      if (seen.has(repo.nameWithOwner)) continue;
      seen.add(repo.nameWithOwner);
      repos.push(repo);
    }
  }
  return repos;
}

const TTL_MS = 5 * 60 * 1000;

interface Memoized<T extends { ok: boolean }> {
  get(forceFresh: boolean): Promise<T>;
  peek(): T | null;
  invalidate(): void;
}

function memoize<T extends { ok: boolean }>(ttlMs: number, fetcher: () => Promise<T>): Memoized<T> {
  let cache: { value: T; expiresAt: number } | null = null;
  let inflight: Promise<T> | null = null;
  return {
    async get(forceFresh: boolean): Promise<T> {
      if (!forceFresh && cache && cache.expiresAt > Date.now()) return cache.value;
      if (inflight) return inflight;
      inflight = (async () => {
        try {
          const value = await fetcher();
          if (value.ok) cache = { value, expiresAt: Date.now() + ttlMs };
          return value;
        } finally {
          inflight = null;
        }
      })();
      return inflight;
    },
    peek() {
      return cache && cache.expiresAt > Date.now() ? cache.value : null;
    },
    invalidate() {
      cache = null;
    },
  };
}

const ownersStore = memoize<OwnersResult>(TTL_MS, fetchOwners);

function authFail(): { ok: false; error: string; needsAuth: true } {
  return { ok: false, error: "authentication required", needsAuth: true };
}

function genericFail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: (error as Error).message || String(error) };
}

const reposStore = memoize<ReposResult>(TTL_MS, async (): Promise<ReposResult> => {
  const ownersResult = await ownersStore.get(false);
  if (!ownersResult.ok) return ownersResult.needsAuth ? authFail() : { ok: false, error: ownersResult.error };
  try {
    const repos = await fetchAllRepos(ownersResult.owners);
    try {
      await recordSnapshots(repos);
      await attachHistory(repos);
    } catch {
      // Snapshot/history is best-effort.
    }
    const result: ReposResult = { ok: true, repos, owners: ownersResult.owners, fetchedAt: new Date().toISOString() };
    maybeRecordDigest(result, issuesStore.peek());
    return result;
  } catch (error: unknown) {
    if (error instanceof AuthRequiredError) return authFail();
    return genericFail(error);
  }
});

const issuesStore = memoize<IssuesResult>(TTL_MS, async (): Promise<IssuesResult> => {
  const ownersResult = await ownersStore.get(false);
  if (!ownersResult.ok) return ownersResult.needsAuth ? authFail() : { ok: false, error: ownersResult.error };
  try {
    const issues = await fetchIssues(ownersResult.owners);
    const result: IssuesResult = { ok: true, issues, owners: ownersResult.owners, fetchedAt: new Date().toISOString() };
    maybeRecordDigest(reposStore.peek(), result);
    return result;
  } catch (error: unknown) {
    if (error instanceof AuthRequiredError) return authFail();
    return genericFail(error);
  }
});

const pullRequestsStore = memoize<PullRequestsResult>(TTL_MS, async (): Promise<PullRequestsResult> => {
  const ownersResult = await ownersStore.get(false);
  if (!ownersResult.ok) return ownersResult.needsAuth ? authFail() : { ok: false, error: ownersResult.error };
  try {
    const pullRequests = await fetchPullRequests(ownersResult.owners);
    return { ok: true, pullRequests, owners: ownersResult.owners, fetchedAt: new Date().toISOString() };
  } catch (error: unknown) {
    if (error instanceof AuthRequiredError) return authFail();
    return genericFail(error);
  }
});

let digestRecordedFor: { reposAt: string; issuesAt: string } | null = null;

function maybeRecordDigest(repos: ReposResult | null, issues: IssuesResult | null): void {
  if (!repos || !repos.ok || !issues || !issues.ok) return;
  if (digestRecordedFor && digestRecordedFor.reposAt === repos.fetchedAt && digestRecordedFor.issuesAt === issues.fetchedAt) {
    return;
  }
  digestRecordedFor = { reposAt: repos.fetchedAt, issuesAt: issues.fetchedAt };
  void recordDailyDigest(repos.repos, issues.issues).catch(() => {
    digestRecordedFor = null;
  });
}

export function getReposCached(forceFresh: boolean): Promise<ReposResult> {
  if (forceFresh) ownersStore.invalidate();
  return reposStore.get(forceFresh);
}

export function getIssuesCached(forceFresh: boolean): Promise<IssuesResult> {
  if (forceFresh) ownersStore.invalidate();
  return issuesStore.get(forceFresh);
}

export function getPullRequestsCached(forceFresh: boolean): Promise<PullRequestsResult> {
  if (forceFresh) ownersStore.invalidate();
  return pullRequestsStore.get(forceFresh);
}

export function invalidateDataCache(): void {
  ownersStore.invalidate();
  reposStore.invalidate();
  issuesStore.invalidate();
  pullRequestsStore.invalidate();
  digestRecordedFor = null;
}
