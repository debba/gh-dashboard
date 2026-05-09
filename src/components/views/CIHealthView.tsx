import { useMemo, useState } from "react";
import type { GhRepo, RepoCIHealth } from "../../types/github";
import { formatNumber, formatRelativeTime } from "../../utils/format";

type SortKey = "health_asc" | "health_desc" | "failures_desc" | "runs_desc" | "recent_failure" | "name_asc";

interface CIHealthViewProps {
  data: RepoCIHealth[];
  reposByName: Map<string, GhRepo>;
  onRepoClick: (repo: GhRepo) => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

function healthLabel(rate: number, totalDecided: number): string {
  if (totalDecided === 0) return "no data";
  if (rate >= 0.95) return "strong";
  if (rate >= 0.75) return "watch";
  return "risky";
}

export function CIHealthView({ data, reposByName, onRepoClick }: CIHealthViewProps) {
  const [sort, setSort] = useState<SortKey>("health_asc");

  const sorted = useMemo(() => {
    const list = [...data];
    list.sort((a, b) => {
      switch (sort) {
        case "health_asc":
          return a.successRate - b.successRate || b.failureCount - a.failureCount;
        case "health_desc":
          return b.successRate - a.successRate || a.failureCount - b.failureCount;
        case "failures_desc":
          return b.failureCount - a.failureCount;
        case "runs_desc":
          return b.totalRuns - a.totalRuns;
        case "recent_failure": {
          const ax = a.lastFailure ? Date.parse(a.lastFailure.createdAt) : 0;
          const bx = b.lastFailure ? Date.parse(b.lastFailure.createdAt) : 0;
          return bx - ax;
        }
        case "name_asc":
          return a.repo.localeCompare(b.repo);
      }
    });
    return list;
  }, [data, sort]);

  if (!data.length) {
    return (
      <div className="empty">
        <div className="big">No CI activity</div>
        <div>None of your repositories has recent workflow runs (or you don't have access to them).</div>
      </div>
    );
  }

  return (
    <div className="view-ci-health">
      <div className="toolbar">
        <span className="count-chip"><strong>{sorted.length}</strong> repositories</span>
        <div className="spacer" />
        <label>Sort</label>
        <select className="sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          <option value="health_asc">Most at risk</option>
          <option value="health_desc">Best health</option>
          <option value="failures_desc">Most failures</option>
          <option value="recent_failure">Recent failure first</option>
          <option value="runs_desc">Most runs</option>
          <option value="name_asc">Name (A→Z)</option>
        </select>
      </div>
      <div className="ci-table" role="table">
        <div className="ci-row ci-row-head" role="row">
          <div role="columnheader">Repository</div>
          <div role="columnheader">Success rate</div>
          <div role="columnheader">Runs</div>
          <div role="columnheader">Avg duration</div>
          <div role="columnheader">Last run</div>
          <div role="columnheader">Last failure</div>
        </div>
        {sorted.map((entry) => {
          const repo = reposByName.get(entry.repo);
          const decided = entry.successCount + entry.failureCount;
          const ratePct = decided ? Math.round(entry.successRate * 100) : 0;
          const label = healthLabel(entry.successRate, decided);
          return (
            <div className="ci-row" role="row" key={entry.repo}>
              <div role="cell" className="ci-repo" data-label="Repository">
                <span className={`ci-health-dot ci-health-${label}`} aria-hidden="true" />
                <button
                  type="button"
                  className="ci-repo-link"
                  onClick={() => repo && onRepoClick(repo)}
                  disabled={!repo}
                  title={entry.repo}
                >
                  {entry.repo}
                </button>
              </div>
              <div role="cell" className="ci-rate" data-label="Success rate">
                <div className="ci-rate-top">
                  <span className={`ci-rate-pct ci-rate-${label}`}>
                    {decided ? `${ratePct}%` : "—"}
                  </span>
                  <span className="ci-rate-counts">
                    <span className="ci-count ci-count-ok">{entry.successCount}✓</span>
                    <span className="ci-count ci-count-fail">{entry.failureCount}✗</span>
                    {entry.cancelledCount ? <span className="ci-count">{entry.cancelledCount}⊘</span> : null}
                  </span>
                </div>
                <div className={`ci-bar ci-bar-${label}`}>
                  <div className="ci-bar-fill" style={{ width: `${decided ? ratePct : 0}%` }} />
                </div>
              </div>
              <div role="cell" data-label="Runs">{formatNumber(entry.totalRuns)}</div>
              <div role="cell" data-label="Avg duration">{formatDuration(entry.avgDurationSec)}</div>
              <div role="cell" className="ci-last" data-label="Last run">
                {entry.lastRun ? (
                  <a href={entry.lastRun.url} target="_blank" rel="noopener noreferrer">
                    <span className={`ci-conclusion ${entry.lastRun.conclusion ?? entry.lastRun.status}`}>
                      {entry.lastRun.conclusion ?? entry.lastRun.status}
                    </span>
                    <span className="ci-when">{formatRelativeTime(entry.lastRun.createdAt)}</span>
                  </a>
                ) : "—"}
              </div>
              <div role="cell" className="ci-last" data-label="Last failure">
                {entry.lastFailure ? (
                  <a href={entry.lastFailure.url} target="_blank" rel="noopener noreferrer">
                    <span className="ci-workflow">{entry.lastFailure.workflowName}</span>
                    <span className="ci-when">{formatRelativeTime(entry.lastFailure.createdAt)}</span>
                  </a>
                ) : <span className="ci-none">—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
