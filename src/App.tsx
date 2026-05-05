import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AuthRequiredClientError,
  fetchAuthStatus,
  fetchDailyDigests,
  fetchIssues,
  fetchPullRequests,
  fetchRepoInsights,
  fetchRepos,
  logoutAuth,
} from "./api/github";
import { invalidate as invalidateCache, peek, swr } from "./api/cache";
import { AuthGate } from "./components/AuthGate";
import { RepositoryDetailsModal, type DetailTab } from "./components/modals/RepositoryDetailsModal";
import { RepositoryMetricModal, type MetricKind } from "./components/modals/RepositoryMetricModal";
import { TopBar } from "./components/TopBar";
import { SidebarControls } from "./components/SidebarControls";
import { Pagination } from "./components/common/Pagination";
import { BoardIcon, BookIcon, ExportIcon, InboxIcon, IssueIcon, PulseIcon } from "./components/common/Icons";
import { IssueList } from "./components/views/IssueList";
import { PullRequestList } from "./components/views/PullRequestList";
import { DailyDigestView } from "./components/views/DailyDigestView";
import { InboxView } from "./components/views/InboxView";
import { InsightsView } from "./components/views/InsightsView";
import { RepoGrid } from "./components/views/RepoGrid";
import { KanbanView } from "./components/views/KanbanView";
import type {
  DailyDigestEntry,
  DailyDigestsData,
  GhIssue,
  GhPullRequest,
  GhRepo,
  IssuesData,
  PullRequestsData,
  RepoInsight,
  RepoInsightsData,
  ReposData,
} from "./types/github";
import {
  buildIssueFacets,
  buildPullRequestFacets,
  buildRepoFacets,
  filterIssues,
  filterPullRequests,
  filterRepos,
  sortIssues,
  sortPullRequests,
  sortRepos,
  type IssueFilters,
  type PullRequestFilters,
  type RepoFilters,
} from "./utils/dashboard";
import { clampPage } from "./utils/pagination";
import { formatNumber } from "./utils/format";
import { clearStatsCache, readStatsCache, writeStatsCache } from "./utils/statsCache";
import { clearFiltersCache, hydrateFilters, readFiltersCache, writeFiltersCache } from "./utils/filtersCache";

type Tab = "inbox" | "repos" | "issues" | "prs" | "kanban" | "insights" | "digests";
type Theme = "dark" | "light" | "auto";

const TAB_ROUTES: Record<Tab, string> = {
  inbox: "/inbox",
  repos: "/repositories",
  issues: "/issues",
  prs: "/pull-requests",
  kanban: "/board",
  insights: "/insights",
  digests: "/daily",
};

const ROUTE_TABS = new Map<string, Tab>(Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab as Tab]));
const DETAIL_TABS = new Set<DetailTab>(["overview", "actions", "pull-requests", "issues", "releases", "forks", "traffic", "mentions", "dependents"]);
const METRIC_KINDS = new Set<MetricKind>(["stars", "forks"]);

function tabFromPath(pathname: string): Tab {
  return ROUTE_TABS.get(pathname) ?? "repos";
}

function detailTabFromParams(params: URLSearchParams): DetailTab {
  const tab = params.get("detail");
  return tab && DETAIL_TABS.has(tab as DetailTab) ? tab as DetailTab : "overview";
}

function metricKindFromParams(params: URLSearchParams): MetricKind | null {
  const metric = params.get("metric");
  return metric && METRIC_KINDS.has(metric as MetricKind) ? metric as MetricKind : null;
}

const CACHE_KEY = {
  repos: "/api/repos",
  issues: "/api/issues",
  prs: "/api/prs",
  insights: "/api/repo-insights",
  digests: "/api/daily-digests",
} as const;

const defaultIssueFilters = (): IssueFilters => ({
  search: "",
  orgs: new Set(),
  repos: new Set(),
  labels: new Set(),
  authors: new Set(),
  assignees: new Set(),
  dates: { cf: "", ct: "", uf: "", ut: "" },
  preset: "",
});

const defaultPrFilters = (): PullRequestFilters => ({
  search: "",
  orgs: new Set(),
  repos: new Set(),
  labels: new Set(),
  authors: new Set(),
  assignees: new Set(),
  dates: { cf: "", ct: "", uf: "", ut: "" },
  preset: "",
});

const defaultRepoFilters = (): RepoFilters => ({
  search: "",
  orgs: new Set(),
  languages: new Set(),
  visibility: "all",
  includeForks: true,
  includeArchived: false,
});

function themeIcon(theme: Theme) {
  if (theme === "light") return <span aria-hidden="true">☀</span>;
  if (theme === "auto") return <span aria-hidden="true">◐</span>;
  return <span aria-hidden="true">☾</span>;
}

function downloadJson(filename: string, rows: unknown[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

type AuthState = "checking" | "anonymous" | "authenticated";

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromPath(location.pathname);
  const routeRepoName = searchParams.get("repo") || "";
  const repoDetailTab = detailTabFromParams(searchParams);
  const routeMetricKind = metricKindFromParams(searchParams);

  // Read cached filters once — shared across all filter/sort useState initializers below.
  const [cachedFiltersOnMount] = useState(() => {
    const raw = readFiltersCache();
    return raw ? { hydrated: hydrateFilters(raw), sorts: raw.sorts } : null;
  });

  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authLogin, setAuthLogin] = useState<string | null>(null);
  const [issues, setIssues] = useState<GhIssue[]>([]);
  const [pullRequests, setPullRequests] = useState<GhPullRequest[]>([]);
  const [repos, setRepos] = useState<GhRepo[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [repoInsights, setRepoInsights] = useState<RepoInsight[]>([]);
  const [dailyDigests, setDailyDigests] = useState<DailyDigestEntry[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataStale, setDataStale] = useState(false);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("gh-dash.theme") as Theme) || "dark");
  const [issueFilters, setIssueFilters] = useState<IssueFilters>(() => cachedFiltersOnMount?.hydrated.issueFilters ?? defaultIssueFilters());
  const [prFilters, setPrFilters] = useState<PullRequestFilters>(() => cachedFiltersOnMount?.hydrated.prFilters ?? defaultPrFilters());
  const [repoFilters, setRepoFilters] = useState<RepoFilters>(() => cachedFiltersOnMount?.hydrated.repoFilters ?? defaultRepoFilters());
  const [issueSort, setIssueSort] = useState(() => cachedFiltersOnMount?.sorts?.issueSort || "updated_desc");
  const [prSort, setPrSort] = useState(() => cachedFiltersOnMount?.sorts?.prSort || "updated_desc");
  const [repoSort, setRepoSort] = useState(() => cachedFiltersOnMount?.sorts?.repoSort || "stars_desc");
  // Page numbers are intentionally NOT cached — they're ephemeral positions,
  // not preferences. After a refresh, page 1 is always the correct start.
  const [issuePage, setIssuePage] = useState(1);
  const [prPage, setPrPage] = useState(1);
  const [repoPage, setRepoPage] = useState(1);
  const [issuePageSize, setIssuePageSize] = useState(Number(localStorage.getItem("gh-dash.issuesPageSize")) || 20);
  const [prPageSize, setPrPageSize] = useState(Number(localStorage.getItem("gh-dash.prsPageSize")) || 20);
  const [repoPageSize, setRepoPageSize] = useState(Number(localStorage.getItem("gh-dash.reposPageSize")) || 20);
  const abortRef = useRef<AbortController | null>(null);

  const loadData = useCallback((fresh = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setDataStale(true);

    const cachedRepos = peek<ReposData>(CACHE_KEY.repos);
    if (cachedRepos) {
      setRepos(cachedRepos.repos);
      setOwners(cachedRepos.owners);
      setFetchedAt(cachedRepos.fetchedAt);
    }
    const cachedIssues = peek<IssuesData>(CACHE_KEY.issues);
    if (cachedIssues) setIssues(cachedIssues.issues);
    const cachedPrs = peek<PullRequestsData>(CACHE_KEY.prs);
    if (cachedPrs) setPullRequests(cachedPrs.pullRequests);

    // Fall back to localStorage when in-memory cache is empty (page refresh)
    if (!cachedRepos && !cachedIssues && !cachedPrs) {
      const persisted = readStatsCache();
      if (persisted) {
        setRepos(persisted.repos as GhRepo[]);
        setOwners(persisted.owners);
        setIssues(persisted.issues as GhIssue[]);
        setPullRequests(persisted.pullRequests as GhPullRequest[]);
        if (persisted.fetchedAt) setFetchedAt(persisted.fetchedAt);
      }
    }

    let pending = 3;
    setLoading(true);
    const finish = () => {
      pending -= 1;
      if (pending <= 0 && abortRef.current === controller) {
        setLoading(false);
        setDataStale(false);
      }
    };
    const handleFailure = (err: unknown) => {
      if (controller.signal.aborted) return;
      if (err instanceof AuthRequiredClientError) {
        setAuthState("anonymous");
        setAuthLogin(null);
        return;
      }
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
    };

    void swr<ReposData>(CACHE_KEY.repos, (signal) => fetchRepos(fresh, signal), {
      fresh,
      signal: controller.signal,
    }).promise
      .then((data) => {
        if (controller.signal.aborted) return;
        setRepos(data.repos);
        setOwners(data.owners);
        setFetchedAt(data.fetchedAt);
      }, handleFailure)
      .finally(finish);

    void swr<IssuesData>(CACHE_KEY.issues, (signal) => fetchIssues(fresh, signal), {
      fresh,
      signal: controller.signal,
    }).promise
      .then((data) => {
        if (controller.signal.aborted) return;
        setIssues(data.issues);
      }, handleFailure)
      .finally(finish);

    void swr<PullRequestsData>(CACHE_KEY.prs, (signal) => fetchPullRequests(fresh, signal), {
      fresh,
      signal: controller.signal,
    }).promise
      .then((data) => {
        if (controller.signal.aborted) return;
        setPullRequests(data.pullRequests);
      }, handleFailure)
      .finally(finish);
  }, []);

  useEffect(() => {
    void fetchAuthStatus()
      .then((status) => {
        if (status.authenticated) {
          setAuthLogin(status.login);
          setAuthState("authenticated");
        } else {
          setAuthState("anonymous");
        }
      })
      .catch(() => setAuthState("anonymous"));
  }, []);

  useEffect(() => {
    if (authState === "authenticated") loadData();
  }, [authState, loadData]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Persist dashboard data to localStorage for instant display on next page load
  useEffect(() => {
    if (repos.length === 0 && issues.length === 0 && pullRequests.length === 0) return;
    writeStatsCache({
      repos,
      owners,
      issues,
      pullRequests,
      fetchedAt,
    });
  }, [repos, owners, issues, pullRequests, fetchedAt]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    if (tab !== "insights" && tab !== "repos") return;
    const cached = peek<RepoInsightsData>(CACHE_KEY.insights);
    if (cached) setRepoInsights(cached.insights);
    const controller = new AbortController();
    swr<RepoInsightsData>(
      CACHE_KEY.insights,
      (signal) => fetchRepoInsights(false, signal),
      { signal: controller.signal },
    ).promise
      .then((data) => {
        if (!controller.signal.aborted) setRepoInsights(data.insights);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [tab, authState]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    if (tab !== "digests") return;
    const cached = peek<DailyDigestsData>(CACHE_KEY.digests);
    if (cached) setDailyDigests(cached.digests);
    const controller = new AbortController();
    swr<DailyDigestsData>(CACHE_KEY.digests, (signal) => fetchDailyDigests(signal), {
      signal: controller.signal,
    }).promise
      .then((data) => {
        if (!controller.signal.aborted) setDailyDigests(data.digests);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [tab, authState]);

  async function handleLogout() {
    abortRef.current?.abort();
    try {
      await logoutAuth();
    } catch {
      // ignore — UI flips regardless
    }
    invalidateCache();
    clearStatsCache();
    clearFiltersCache();
    setAuthState("anonymous");
    setAuthLogin(null);
    setIssues([]);
    setPullRequests([]);
    setRepos([]);
    setOwners([]);
    setRepoInsights([]);
    setDailyDigests([]);
    setFetchedAt("");
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("gh-dash.theme", theme);
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle("tab-inbox", tab === "inbox");
    document.body.classList.toggle("tab-issues", tab === "issues");
    document.body.classList.toggle("tab-prs", tab === "prs");
    document.body.classList.toggle("tab-repos", tab === "repos");
    document.body.classList.toggle("tab-kanban", tab === "kanban");
    document.body.classList.toggle("tab-insights", tab === "insights");
    document.body.classList.toggle("tab-digests", tab === "digests");
    document.body.classList.toggle("filters-open", filtersOpen);
  }, [tab, filtersOpen]);

  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "/index.html") {
      navigate(`${TAB_ROUTES.repos}${location.search}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setFiltersOpen(false), [location.pathname]);

  useEffect(() => localStorage.setItem("gh-dash.issuesPageSize", String(issuePageSize)), [issuePageSize]);
  useEffect(() => localStorage.setItem("gh-dash.prsPageSize", String(prPageSize)), [prPageSize]);
  useEffect(() => localStorage.setItem("gh-dash.reposPageSize", String(repoPageSize)), [repoPageSize]);

  // Persist sidebar filters and sort order to localStorage
  useEffect(() => {
    writeFiltersCache(repoFilters, issueFilters, prFilters, { issueSort, prSort, repoSort });
  }, [repoFilters, issueFilters, prFilters, issueSort, prSort, repoSort]);

  const userLogin = owners[0] || "";
  const issueFacets = useMemo(() => buildIssueFacets(issues), [issues]);
  const prFacets = useMemo(() => buildPullRequestFacets(pullRequests), [pullRequests]);
  const repoFacets = useMemo(() => buildRepoFacets(repos), [repos]);
  const insightsByRepo = useMemo(() => new Map(repoInsights.map((insight) => [insight.repo, insight])), [repoInsights]);
  const filteredIssues = useMemo(() => sortIssues(filterIssues(issues, issueFilters, userLogin), issueSort), [issues, issueFilters, issueSort, userLogin]);
  const filteredPullRequests = useMemo(() => sortPullRequests(filterPullRequests(pullRequests, prFilters, userLogin), prSort), [pullRequests, prFilters, prSort, userLogin]);
  const filteredRepos = useMemo(() => sortRepos(filterRepos(repos, issues, repoFilters), issues, repoSort, insightsByRepo), [repos, issues, repoFilters, repoSort, insightsByRepo]);
  const filteredInsights = useMemo(
    () => filteredRepos
      .map((repo) => insightsByRepo.get(repo.nameWithOwner))
      .filter((value): value is RepoInsight => Boolean(value))
      .filter((insight) => insight.alerts.length || insight.opportunities.length || insight.correlations.length),
    [filteredRepos, insightsByRepo]
  );
  const issuePageSafe = clampPage(issuePage, filteredIssues.length, issuePageSize);
  const prPageSafe = clampPage(prPage, filteredPullRequests.length, prPageSize);
  const repoPageSafe = clampPage(repoPage, filteredRepos.length, repoPageSize);
  const visibleIssues = filteredIssues.slice((issuePageSafe - 1) * issuePageSize, issuePageSafe * issuePageSize);
  const visiblePullRequests = filteredPullRequests.slice((prPageSafe - 1) * prPageSize, prPageSafe * prPageSize);
  const visibleRepos = filteredRepos.slice((repoPageSafe - 1) * repoPageSize, repoPageSafe * repoPageSize);
  const draftCount = pullRequests.filter((pr) => pr.isDraft).length;
  const awaitingReviewCount = pullRequests.filter((pr) => !pr.isDraft && pr.reviewsCount === 0).length;
  const approvedCount = pullRequests.filter((pr) => pr.reviewDecision === "APPROVED").length;
  const stalePrCount = pullRequests.filter((pr) => Date.now() - new Date(pr.updatedAt).getTime() > 14 * 86_400_000).length;
  const averageHealth = repoInsights.length ? Math.round(repoInsights.reduce((sum, insight) => sum + insight.healthScore, 0) / repoInsights.length) : 0;
  const totalAlerts = repoInsights.reduce((sum, insight) => sum + insight.alerts.length, 0);
  const reposByName = useMemo(() => new Map(repos.map((repo) => [repo.nameWithOwner, repo])), [repos]);
  const repoModal = useMemo(
    () => (routeRepoName && !routeMetricKind ? reposByName.get(routeRepoName) ?? null : null),
    [reposByName, routeMetricKind, routeRepoName],
  );
  const metricRepo = routeMetricKind && routeRepoName ? reposByName.get(routeRepoName) ?? null : null;
  const metricTotalCount = routeMetricKind === "stars" ? metricRepo?.stargazerCount : routeMetricKind === "forks" ? metricRepo?.forkCount : undefined;

  if (authState === "checking") {
    return <div className="auth-gate"><div className="auth-card"><p className="auth-status">Loading…</p></div></div>;
  }

  if (authState === "anonymous") {
    return (
      <AuthGate
        onAuthenticated={(login) => {
          setAuthLogin(login);
          setAuthState("authenticated");
        }}
      />
    );
  }

  const search =
    tab === "repos" || tab === "insights" || tab === "digests"
      ? repoFilters.search
      : tab === "prs"
        ? prFilters.search
        : issueFilters.search;
  const subtitle = `${issues.length} issues · ${pullRequests.length} PRs · ${repos.length} repos · ${owners.length} orgs${loading ? " · loading…" : ""}`;
  const lastUpdated = fetchedAt ? `updated ${new Date(fetchedAt).toLocaleTimeString()}` : "";

  function setSearch(value: string) {
    if (tab === "repos" || tab === "insights" || tab === "digests") {
      setRepoFilters({ ...repoFilters, search: value });
      setRepoPage(1);
    } else if (tab === "prs") {
      setPrFilters({ ...prFilters, search: value });
      setPrPage(1);
    } else {
      setIssueFilters({ ...issueFilters, search: value });
      setIssuePage(1);
    }
  }

  function resetFilters() {
    if (tab === "repos" || tab === "insights" || tab === "digests") setRepoFilters(defaultRepoFilters());
    else if (tab === "prs") setPrFilters(defaultPrFilters());
    else setIssueFilters(defaultIssueFilters());
    clearFiltersCache();
  }

  function navigateTab(nextTab: Tab) {
    navigate(TAB_ROUTES[nextTab]);
  }

  function openRepoModal(repo: GhRepo, detail: DetailTab = "overview") {
    setSearchParams({ repo: repo.nameWithOwner, detail });
  }

  function closeRepoModal() {
    navigate(TAB_ROUTES[tab]);
  }

  function openMetricModal(repo: string, metric: MetricKind) {
    setSearchParams({ repo, metric });
  }

  function closeMetricModal() {
    navigate(TAB_ROUTES[tab]);
  }

  function changeRepoDetailTab(detail: DetailTab) {
    if (!repoModal) return;
    setSearchParams({ repo: repoModal.nameWithOwner, detail });
  }

  const tabs = [
    { key: "inbox" as const, label: "Inbox", count: issues.length + pullRequests.length, icon: <InboxIcon /> },
    { key: "repos" as const, label: "Repositories", count: repos.length, icon: <BookIcon /> },
    { key: "issues" as const, label: "Issues", count: issues.length, icon: <IssueIcon /> },
    { key: "prs" as const, label: "Pull Requests", count: pullRequests.length, icon: <PulseIcon /> },
    { key: "insights" as const, label: "Insights", count: filteredInsights.length, icon: <PulseIcon /> },
    { key: "digests" as const, label: "Daily", count: dailyDigests.length, icon: <PulseIcon /> },
    { key: "kanban" as const, label: "Board", count: "—", icon: <BoardIcon /> },
  ];

  return (
    <>
      <TopBar
        subtitle={subtitle}
        lastUpdated={lastUpdated}
        loading={loading}
        themeLabel={theme[0].toUpperCase() + theme.slice(1)}
        themeIcon={themeIcon(theme)}
        authLogin={authLogin}
        onThemeToggle={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "auto" : "dark")}
        onRefresh={() => loadData(true)}
        onOpenFilters={() => setFiltersOpen(true)}
        onLogout={() => void handleLogout()}
      />
      <div className="sidebar-backdrop" onClick={() => setFiltersOpen(false)} />
      <div className={`layout ${tab === "inbox" ? "layout-inbox" : ""}`}>
        <SidebarControls
          tab={tab}
          search={search}
          issueFilters={issueFilters}
          prFilters={prFilters}
          repoFilters={repoFilters}
          issueFacets={issueFacets}
          prFacets={prFacets}
          repoFacets={repoFacets}
          onSearchChange={setSearch}
          onIssueFiltersChange={(next) => { setIssueFilters(next); setIssuePage(1); }}
          onPrFiltersChange={(next) => { setPrFilters(next); setPrPage(1); }}
          onRepoFiltersChange={(next) => { setRepoFilters(next); setRepoPage(1); }}
          onReset={resetFilters}
          onClose={() => setFiltersOpen(false)}
        />
        <main className={`main${dataStale ? " data-stale" : ""}`}>
          {error ? <div className="error">{error}</div> : null}
          <div className="view-head">
            <div className="tabs" role="tablist">
              {tabs.map((item) => (
                <button className={`tab ${tab === item.key ? "active" : ""}`} key={item.key} role="tab" onClick={() => navigateTab(item.key)}>
                  {item.icon}
                  {item.label} <span className="tab-badge">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          {tab === "inbox" ? (
            <InboxView
              issues={issues}
              pullRequests={pullRequests}
              userLogin={userLogin}
              reposByName={reposByName}
              onRepoClick={openRepoModal}
            />
          ) : null}

          {tab === "issues" ? (
            <div className="view-issues" style={{ display: "block" }}>
              <section className="stats">
                <div className="stat"><div className="k">Open issues</div><div className="v">{formatNumber(filteredIssues.length)}</div><div className="sub">matching filters</div></div>
                <div className="stat"><div className="k">Repositories</div><div className="v">{new Set(filteredIssues.map((issue) => issue.repository.nameWithOwner)).size}</div><div className="sub">with open issues</div></div>
                <div className="stat"><div className="k">Organizations</div><div className="v">{new Set(filteredIssues.map((issue) => issue.repository.nameWithOwner.split("/")[0])).size}</div><div className="sub">including personal</div></div>
                <div className="stat"><div className="k">Stale ≥ 30d</div><div className="v">{filteredIssues.filter((issue) => Date.now() - new Date(issue.updatedAt).getTime() > 30 * 86_400_000).length}</div><div className="sub">no recent activity</div></div>
              </section>
              <div className="toolbar">
                <span className="count-chip"><strong>{visibleIssues.length}</strong> of <span>{filteredIssues.length}</span> shown</span>
                <div className="spacer" />
                <label>Sort</label>
                <select className="sort" value={issueSort} onChange={(event) => setIssueSort(event.target.value)}>
                  <option value="updated_desc">Recently updated</option>
                  <option value="updated_asc">Least recently updated</option>
                  <option value="created_desc">Newest</option>
                  <option value="created_asc">Oldest</option>
                  <option value="comments_desc">Most commented</option>
                  <option value="comments_asc">Least commented</option>
                  <option value="repo_asc">Repository (A→Z)</option>
                </select>
                <button className="btn ghost" onClick={() => downloadJson("issues.json", filteredIssues)}><ExportIcon /> Export</button>
              </div>
              <IssueList issues={visibleIssues} />
              <Pagination totalItems={filteredIssues.length} page={issuePageSafe} pageSize={issuePageSize} onPageChange={setIssuePage} onPageSizeChange={(size) => { setIssuePageSize(size); setIssuePage(1); }} />
            </div>
          ) : null}

          {tab === "prs" ? (
            <div className="view-prs" style={{ display: "block" }}>
              <section className="stats">
                <div className="stat"><div className="k">Open PRs</div><div className="v">{formatNumber(filteredPullRequests.length)}</div><div className="sub">matching filters</div></div>
                <div className="stat"><div className="k">Drafts</div><div className="v">{formatNumber(draftCount)}</div><div className="sub">across all PRs</div></div>
                <div className="stat"><div className="k">Awaiting review</div><div className="v">{formatNumber(awaitingReviewCount)}</div><div className="sub">no review yet</div></div>
                <div className="stat"><div className="k">Approved</div><div className="v">{formatNumber(approvedCount)}</div><div className="sub">ready to merge</div></div>
                <div className="stat"><div className="k">Stale ≥ 14d</div><div className="v">{formatNumber(stalePrCount)}</div><div className="sub">no recent activity</div></div>
              </section>
              <div className="toolbar">
                <span className="count-chip"><strong>{visiblePullRequests.length}</strong> of <span>{filteredPullRequests.length}</span> shown</span>
                <div className="spacer" />
                <label>Preset</label>
                <select className="sort" value={prFilters.preset} onChange={(event) => { setPrFilters({ ...prFilters, preset: event.target.value }); setPrPage(1); }}>
                  <option value="">All</option>
                  <option value="ready">Ready</option>
                  <option value="draft">Drafts</option>
                  <option value="awaiting-review">Awaiting review</option>
                  <option value="approved">Approved</option>
                  <option value="changes-requested">Changes requested</option>
                  <option value="assigned-me">Assigned to me</option>
                  <option value="authored-me">Authored by me</option>
                  <option value="stale">Stale</option>
                </select>
                <label>Sort</label>
                <select className="sort" value={prSort} onChange={(event) => setPrSort(event.target.value)}>
                  <option value="updated_desc">Recently updated</option>
                  <option value="updated_asc">Least recently updated</option>
                  <option value="created_desc">Newest</option>
                  <option value="created_asc">Oldest</option>
                  <option value="review_pending">Awaiting review first</option>
                  <option value="size_desc">Largest diff</option>
                  <option value="size_asc">Smallest diff</option>
                  <option value="files_desc">Most files changed</option>
                  <option value="comments_desc">Most commented</option>
                  <option value="repo_asc">Repository (A→Z)</option>
                </select>
                <button className="btn ghost" onClick={() => downloadJson("pull-requests.json", filteredPullRequests)}><ExportIcon /> Export</button>
              </div>
              <PullRequestList pullRequests={visiblePullRequests} />
              <Pagination totalItems={filteredPullRequests.length} page={prPageSafe} pageSize={prPageSize} onPageChange={setPrPage} onPageSizeChange={(size) => { setPrPageSize(size); setPrPage(1); }} />
            </div>
          ) : null}

          {tab === "repos" ? (
            <div className="view-repos" style={{ display: "block" }}>
              <section className="stats">
                <div className="stat"><div className="k">Repositories</div><div className="v">{formatNumber(filteredRepos.length)}</div><div className="sub">matching filters</div></div>
                <div className="stat"><div className="k">Total stars</div><div className="v">{formatNumber(filteredRepos.reduce((sum, repo) => sum + repo.stargazerCount, 0))}</div><div className="sub">across shown</div></div>
                <div className="stat"><div className="k">Total forks</div><div className="v">{formatNumber(filteredRepos.reduce((sum, repo) => sum + repo.forkCount, 0))}</div><div className="sub">across shown</div></div>
                <div className="stat"><div className="k">Average health</div><div className="v">{formatNumber(averageHealth)}</div><div className="sub">from repo signals</div></div>
              </section>
              <div className="toolbar">
                <span className="count-chip"><strong>{visibleRepos.length}</strong> of <span>{filteredRepos.length}</span> shown</span>
                <div className="spacer" />
                <label>Sort</label>
                <select className="sort" value={repoSort} onChange={(event) => setRepoSort(event.target.value)}>
                  <option value="stars_desc">Most stars</option>
                  <option value="stars_asc">Fewest stars</option>
                  <option value="forks_desc">Most forks</option>
                  <option value="forks_asc">Fewest forks</option>
                  <option value="issues_desc">Most open issues</option>
                  <option value="issues_asc">Fewest open issues</option>
                  <option value="health_desc">Best health</option>
                  <option value="health_asc">Most at risk</option>
                  <option value="pushed_desc">Recently pushed</option>
                  <option value="updated_desc">Recently updated</option>
                  <option value="name_asc">Name (A→Z)</option>
                </select>
                <button className="btn ghost" onClick={() => downloadJson("repositories.json", filteredRepos)}><ExportIcon /> Export</button>
              </div>
              <RepoGrid
                repos={visibleRepos}
                issues={issues}
                insightsByRepo={insightsByRepo}
                onRepoClick={openRepoModal}
                onIssuesClick={(repo) => { setIssueFilters({ ...issueFilters, repos: new Set([repo]) }); navigateTab("issues"); }}
                onStarsClick={(repo) => openMetricModal(repo, "stars")}
                onForksClick={(repo) => openMetricModal(repo, "forks")}
              />
              <Pagination totalItems={filteredRepos.length} page={repoPageSafe} pageSize={repoPageSize} onPageChange={setRepoPage} onPageSizeChange={(size) => { setRepoPageSize(size); setRepoPage(1); }} />
            </div>
          ) : null}

          {tab === "insights" ? (
            <div className="view-insights" style={{ display: "block" }}>
              <section className="stats">
                <div className="stat"><div className="k">Average health</div><div className="v">{formatNumber(averageHealth)}</div><div className="sub">across tracked repos</div></div>
                <div className="stat"><div className="k">Alert count</div><div className="v">{formatNumber(totalAlerts)}</div><div className="sub">active risks detected</div></div>
                <div className="stat"><div className="k">Repos with insights</div><div className="v">{formatNumber(filteredInsights.length)}</div><div className="sub">alerts, opportunities or correlations</div></div>
                <div className="stat"><div className="k">At-risk repos</div><div className="v">{formatNumber(repoInsights.filter((insight) => insight.healthLabel === "risky").length)}</div><div className="sub">health score under 55</div></div>
              </section>
              <InsightsView insights={filteredInsights} reposByName={reposByName} onRepoClick={openRepoModal} />
            </div>
          ) : null}

          {tab === "digests" ? (
            <div className="view-digests" style={{ display: "block" }}>
              <section className="stats">
                <div className="stat"><div className="k">Digest days</div><div className="v">{formatNumber(dailyDigests.length)}</div><div className="sub">days with saved snapshots</div></div>
                <div className="stat"><div className="k">Latest issue delta</div><div className="v">{dailyDigests[0] ? `${dailyDigests[0].issueDelta >= 0 ? "+" : ""}${formatNumber(dailyDigests[0].issueDelta)}` : "0"}</div><div className="sub">vs previous day</div></div>
                <div className="stat"><div className="k">Latest stars delta</div><div className="v">{dailyDigests[0] ? `${dailyDigests[0].starsDelta >= 0 ? "+" : ""}${formatNumber(dailyDigests[0].starsDelta)}` : "0"}</div><div className="sub">vs previous day</div></div>
                <div className="stat"><div className="k">Latest stale delta</div><div className="v">{dailyDigests[0] ? `${dailyDigests[0].staleIssueDelta >= 0 ? "+" : ""}${formatNumber(dailyDigests[0].staleIssueDelta)}` : "0"}</div><div className="sub">vs previous day</div></div>
              </section>
              <DailyDigestView digests={dailyDigests} />
            </div>
          ) : null}

          {tab === "kanban" ? <KanbanView /> : null}
        </main>
      </div>
      {repoModal ? (
        <RepositoryDetailsModal
          repo={repoModal}
          issues={issues}
          pullRequests={pullRequests}
          activeTab={repoDetailTab}
          onTabChange={changeRepoDetailTab}
          onClose={closeRepoModal}
          onIssuesClick={(repo) => {
            closeRepoModal();
            setIssueFilters({ ...issueFilters, repos: new Set([repo]) });
            navigateTab("issues");
          }}
        />
      ) : null}
      {routeMetricKind && routeRepoName ? (
        <RepositoryMetricModal
          kind={routeMetricKind}
          repo={routeRepoName}
          totalCount={metricTotalCount}
          onClose={closeMetricModal}
        />
      ) : null}
    </>
  );
}
