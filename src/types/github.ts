export interface GhLabel {
  name: string;
  color?: string;
  description?: string;
}

export interface GhUser {
  login: string;
  url?: string;
  avatarUrl?: string;
  avatar_url?: string;
}

export interface GhIssue {
  repository: { name: string; nameWithOwner: string };
  title: string;
  url: string;
  number: number;
  createdAt: string;
  updatedAt: string;
  author?: GhUser;
  labels: GhLabel[];
  commentsCount: number;
  assignees?: GhUser[];
}

export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;

export interface GhPullRequest {
  repository: { name: string; nameWithOwner: string };
  title: string;
  url: string;
  number: number;
  createdAt: string;
  updatedAt: string;
  author?: GhUser;
  labels: GhLabel[];
  commentsCount: number;
  assignees?: GhUser[];
  isDraft: boolean;
  reviewDecision: ReviewDecision;
  reviewsCount: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  baseRefName: string;
  headRefName: string;
}

export interface SnapshotEntry {
  date: string;
  stars: number;
  forks: number;
}

export interface GhRepo {
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
  history?: SnapshotEntry[];
}

export interface ReposData {
  ok: true;
  repos: GhRepo[];
  owners: string[];
  fetchedAt: string;
}

export interface IssuesData {
  ok: true;
  issues: GhIssue[];
  owners: string[];
  fetchedAt: string;
}

export interface PullRequestsData {
  ok: true;
  pullRequests: GhPullRequest[];
  owners: string[];
  fetchedAt: string;
}

export interface ApiError {
  ok: false;
  error: string;
}

export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface StargazerNode {
  starredAt: string;
  node: { login: string; avatarUrl: string; url: string };
}

export interface ForkNode {
  nameWithOwner: string;
  owner: { login: string; avatarUrl: string };
  stargazerCount: number;
  forkCount: number;
  pushedAt: string;
  updatedAt: string;
  createdAt: string;
  url: string;
  description: string | null;
  primaryLanguage: { name: string } | null;
}

export interface RepoContributor {
  login?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  avatarUrl?: string;
  html_url?: string;
  url?: string;
  contributions: number;
}

export interface RepoTrafficViews {
  count: number;
  uniques: number;
  views?: Array<{
    timestamp: string;
    count: number;
    uniques: number;
  }>;
}

export interface RepoTrafficReferrer {
  referrer: string;
  count: number;
  uniques: number;
}

export interface RepoTrafficPath {
  path: string;
  title: string;
  count: number;
  uniques: number;
}

export interface RepoReleaseAsset {
  id: number;
  name: string;
  download_count: number;
  size?: number;
  browser_download_url?: string;
}

export interface RepoRelease {
  id: number;
  name: string | null;
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  created_at?: string | null;
  assets: RepoReleaseAsset[];
  totalDownloads: number;
}

export interface RepoWorkflowRun {
  id: number;
  name: string | null;
  display_title?: string | null;
  html_url: string;
  status: string;
  conclusion: string | null;
  event: string;
  head_branch: string | null;
  run_number: number;
  run_started_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepoDetailsData {
  ok: true;
  meta: {
    description?: string | null;
    homepage?: string | null;
    topics?: string[];
    license?: { name: string } | null;
    default_branch?: string;
  } | null;
  languages: Record<string, number>;
  contributors: RepoContributor[];
  views: RepoTrafficViews | null;
  releases: RepoRelease[];
  workflows: RepoWorkflowRun[];
  digest?: DailyRepoDigest | null;
  errors?: Record<string, string | null>;
}

export interface RepoTrafficDetails {
  ok: true;
  forbidden: boolean;
  referrers: RepoTrafficReferrer[];
  paths: RepoTrafficPath[];
  views: RepoTrafficViews | null;
  clones: {
    count: number;
    uniques: number;
    clones?: Array<{
      timestamp: string;
      count: number;
      uniques: number;
    }>;
  } | null;
}

export interface RepoInsight {
  repo: string;
  issueCount: number;
  staleIssueCount: number;
  daysSincePush: number;
  daysSinceUpdate: number;
  starsDelta: number | null;
  forksDelta: number | null;
  releaseCount: number;
  totalDownloads: number;
  recentDownloads: number;
  viewsCount: number;
  viewsUniques: number;
  healthScore: number;
  healthLabel: "strong" | "watch" | "risky";
  alerts: string[];
  opportunities: string[];
  correlations: string[];
  latestReleasePublishedAt: string | null;
}

export interface RepoInsightsData {
  ok: true;
  generatedAt: string;
  insights: RepoInsight[];
}

export interface DailyRepoDigest {
  repo: string;
  date: string;
  stars: number;
  forks: number;
  issueCount: number;
  staleIssueCount: number;
  starsDelta: number;
  forksDelta: number;
  issueDelta: number;
  staleIssueDelta: number;
  highlights: string[];
  executiveSummary: string[];
  momentum: string[];
  risks: string[];
  ai?: {
    model: string;
    headline: string;
    briefing: string[];
    generatedAt: string;
  } | null;
}

export interface DailyDigestEntry {
  date: string;
  repoCount: number;
  issueCount: number;
  staleIssueCount: number;
  totalStars: number;
  totalForks: number;
  issueDelta: number;
  staleIssueDelta: number;
  starsDelta: number;
  forksDelta: number;
  highlights: string[];
  executiveSummary: string[];
  momentum: string[];
  risks: string[];
  repos: DailyRepoDigest[];
  ai?: {
    model: string;
    headline: string;
    briefing: string[];
    generatedAt: string;
  } | null;
}

export interface DailyDigestsData {
  ok: true;
  generatedAt: string;
  digests: DailyDigestEntry[];
}

export interface MentionIssueItem {
  repository: { nameWithOwner: string };
  title: string;
  url: string;
  number: number;
  createdAt: string;
  updatedAt: string;
  state: string;
  isPullRequest?: boolean;
  author?: { login: string; url: string };
}

export interface MentionCodeItem {
  repository: { nameWithOwner: string };
  path: string;
  url: string;
}

export interface DependentItem {
  owner: string;
  repo: string;
  nameWithOwner: string;
  url: string;
  stars: number;
  forks: number;
  avatar: string;
}

export interface ProjectSummary {
  id: string;
  number: number;
  title: string;
  url: string;
  closed: boolean;
  shortDescription: string | null;
  updatedAt?: string;
  items?: { totalCount: number };
  owner: { __typename: string; login?: string };
  linkedRepos?: string[];
}

export interface ProjectFieldOption {
  id: string;
  name: string;
  color?: string;
}

export interface ProjectField {
  __typename: string;
  id: string;
  name: string;
  dataType?: string;
  options?: ProjectFieldOption[];
}

export interface ProjectItem {
  id: string;
  isArchived: boolean;
  type: string;
  content?: {
    __typename?: string;
    number?: number;
    title?: string;
    url?: string;
    state?: string;
    repository?: { nameWithOwner: string };
    author?: GhUser;
    labels?: { nodes: GhLabel[] };
    assignees?: { nodes: GhUser[] };
    createdAt?: string;
    updatedAt?: string;
  };
  fieldValues?: {
    nodes: Array<{
      __typename: string;
      field?: { id: string; name: string };
      name?: string;
      optionId?: string;
    }>;
  };
}

export interface ProjectDetails {
  id: string;
  number: number;
  title: string;
  url: string;
  closed: boolean;
  shortDescription: string | null;
  owner: { __typename: string; login?: string };
  fields: ProjectField[];
  items: ProjectItem[];
  totalCount: number;
  truncated: boolean;
}
