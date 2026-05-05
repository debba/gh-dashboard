import type { ReactNode } from "react";
import type { FacetValue, IssueFilters, PullRequestFilters, RepoFilters } from "../utils/dashboard";
import { getLanguageColor } from "../utils/colors";
import { ChevronIcon, CloseIcon, SearchIcon } from "./common/Icons";

type Tab = "inbox" | "issues" | "repos" | "kanban" | "insights" | "digests" | "prs";

type IssueLikeFacets = {
  orgs: Map<string, number>;
  repos: Map<string, number>;
  labels: Map<string, { count: number; color?: string }>;
  authors: Map<string, number>;
  assignees: Map<string, number>;
};

interface SidebarControlsProps {
  tab: Tab;
  search: string;
  issueFilters: IssueFilters;
  prFilters: PullRequestFilters;
  repoFilters: RepoFilters;
  issueFacets: IssueLikeFacets;
  prFacets: IssueLikeFacets;
  repoFacets: {
    orgs: Map<string, number>;
    languages: Map<string, number>;
  };
  onSearchChange: (value: string) => void;
  onIssueFiltersChange: (filters: IssueFilters) => void;
  onPrFiltersChange: (filters: PullRequestFilters) => void;
  onRepoFiltersChange: (filters: RepoFilters) => void;
  onReset: () => void;
  onClose: () => void;
}

function toggleSetValue(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function countOf(value: FacetValue): number {
  return typeof value === "number" ? value : value.count;
}

function CheckList({
  entries,
  selected,
  onToggle,
  showSwatch,
  languageDot,
}: {
  entries: Array<[string, FacetValue]>;
  selected: Set<string>;
  onToggle: (value: string) => void;
  showSwatch?: boolean;
  languageDot?: boolean;
}) {
  const sorted = [...entries].sort((a, b) => Number(selected.has(b[0])) - Number(selected.has(a[0])) || countOf(b[1]) - countOf(a[1]) || a[0].localeCompare(b[0]));
  if (!sorted.length) return <div style={{ padding: 8, color: "var(--muted-2)", fontSize: 12 }}>No matches</div>;

  return (
    <div className="check-list">
      {sorted.map(([name, value]) => {
        const color = typeof value === "number" ? undefined : value.color;
        return (
          <label className="check" key={name}>
            <input type="checkbox" checked={selected.has(name)} onChange={() => onToggle(name)} />
            {showSwatch && color ? <span className="label-swatch" style={{ background: `#${color}` }} /> : null}
            {languageDot ? <span className="label-swatch" style={{ borderRadius: "50%", background: getLanguageColor(name) }} /> : null}
            <span className="label-text">{name}</span>
            <span className="label-count">{countOf(value)}</span>
          </label>
        );
      })}
    </div>
  );
}

function FilterSection({ title, activeCount, children, dataFor, open = false }: { title: string; activeCount: number; children: ReactNode; dataFor?: string; open?: boolean }) {
  return (
    <details className="section" data-for={dataFor} open={open || activeCount > 0}>
      <summary>
        <ChevronIcon />
        {title} <span className={`count ${activeCount ? "active" : ""}`}>{activeCount}</span>
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function SidebarControls({
  tab,
  search,
  issueFilters,
  prFilters,
  repoFilters,
  issueFacets,
  prFacets,
  repoFacets,
  onSearchChange,
  onIssueFiltersChange,
  onPrFiltersChange,
  onRepoFiltersChange,
  onReset,
  onClose,
}: SidebarControlsProps) {
  const prMode = tab === "prs";
  const issueMode = tab === "issues" || tab === "kanban";
  const ticketMode = prMode || issueMode;
  const activeFilters: IssueFilters | PullRequestFilters = prMode ? prFilters : issueFilters;
  const activeFacets: IssueLikeFacets = prMode ? prFacets : issueFacets;
  const orgSelection = ticketMode ? activeFilters.orgs : repoFilters.orgs;
  const orgEntries = ticketMode ? activeFacets.orgs : repoFacets.orgs;
  const onActiveFiltersChange = (next: IssueFilters | PullRequestFilters) => {
    if (prMode) onPrFiltersChange(next as PullRequestFilters);
    else onIssueFiltersChange(next as IssueFilters);
  };

  return (
    <aside className="sidebar" id="sidebar">
      <div className="side-head">
        <h2>Filters</h2>
        <button className="reset" onClick={onReset}>Clear all</button>
        <button className="side-close" aria-label="Close filters" onClick={onClose}><CloseIcon /></button>
      </div>

      <div className="search-wrap">
        <label className="search-input">
          <SearchIcon />
          <input type="search" placeholder="Search…" autoComplete="off" value={search} onChange={(event) => onSearchChange(event.target.value)} />
        </label>
      </div>

      <FilterSection title="Organizations" activeCount={orgSelection.size} open>
        <CheckList
          entries={[...orgEntries.entries()]}
          selected={orgSelection}
          onToggle={(value) => ticketMode
            ? onActiveFiltersChange({ ...activeFilters, orgs: toggleSetValue(activeFilters.orgs, value) })
            : onRepoFiltersChange({ ...repoFilters, orgs: toggleSetValue(repoFilters.orgs, value) })}
        />
      </FilterSection>

      {ticketMode ? (
        <>
          <FilterSection title="Repositories" activeCount={activeFilters.repos.size} dataFor={prMode ? "prs-only" : "issues-only"}>
            <CheckList entries={[...activeFacets.repos.entries()]} selected={activeFilters.repos} onToggle={(value) => onActiveFiltersChange({ ...activeFilters, repos: toggleSetValue(activeFilters.repos, value) })} />
          </FilterSection>
          <FilterSection title="Labels" activeCount={activeFilters.labels.size} dataFor={prMode ? "prs-only" : "issues-only"}>
            <CheckList entries={[...activeFacets.labels.entries()]} selected={activeFilters.labels} showSwatch onToggle={(value) => onActiveFiltersChange({ ...activeFilters, labels: toggleSetValue(activeFilters.labels, value) })} />
          </FilterSection>
          <FilterSection title="Authors" activeCount={activeFilters.authors.size} dataFor={prMode ? "prs-only" : "issues-only"}>
            <CheckList entries={[...activeFacets.authors.entries()]} selected={activeFilters.authors} onToggle={(value) => onActiveFiltersChange({ ...activeFilters, authors: toggleSetValue(activeFilters.authors, value) })} />
          </FilterSection>
          <FilterSection title="Assignees" activeCount={activeFilters.assignees.size} dataFor={prMode ? "prs-only" : "issues-only"}>
            <CheckList entries={[...activeFacets.assignees.entries()]} selected={activeFilters.assignees} onToggle={(value) => onActiveFiltersChange({ ...activeFilters, assignees: toggleSetValue(activeFilters.assignees, value) })} />
          </FilterSection>
        </>
      ) : (
        <>
          <FilterSection title="Languages" activeCount={repoFilters.languages.size} dataFor="repos-only">
            <CheckList entries={[...repoFacets.languages.entries()]} selected={repoFilters.languages} languageDot onToggle={(value) => onRepoFiltersChange({ ...repoFilters, languages: toggleSetValue(repoFilters.languages, value) })} />
          </FilterSection>
          <FilterSection title="Visibility" activeCount={repoFilters.visibility === "all" ? 0 : 1} dataFor="repos-only" open>
            <div className="opt-group" role="tablist">
              {(["all", "public", "private"] as const).map((value) => (
                <button key={value} className={repoFilters.visibility === value ? "active" : ""} onClick={() => onRepoFiltersChange({ ...repoFilters, visibility: value })}>{value[0].toUpperCase() + value.slice(1)}</button>
              ))}
            </div>
          </FilterSection>
          <FilterSection title="Options" activeCount={Number(!repoFilters.includeForks) + Number(repoFilters.includeArchived)} dataFor="repos-only" open>
            <div className="toggle-row">Include forks <button className={`toggle ${repoFilters.includeForks ? "on" : ""}`} role="switch" aria-checked={repoFilters.includeForks} onClick={() => onRepoFiltersChange({ ...repoFilters, includeForks: !repoFilters.includeForks })} /></div>
            <div className="toggle-row">Include archived <button className={`toggle ${repoFilters.includeArchived ? "on" : ""}`} role="switch" aria-checked={repoFilters.includeArchived} onClick={() => onRepoFiltersChange({ ...repoFilters, includeArchived: !repoFilters.includeArchived })} /></div>
          </FilterSection>
        </>
      )}
    </aside>
  );
}
