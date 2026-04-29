import type { GhRepo, RepoInsight } from "../../types/github";
import { formatNumber, formatRelativeTime } from "../../utils/format";

interface InsightsViewProps {
  insights: RepoInsight[];
  reposByName: Map<string, GhRepo>;
  onRepoClick: (repo: GhRepo) => void;
}

export function InsightsView({ insights, reposByName, onRepoClick }: InsightsViewProps) {
  if (!insights.length) {
    return <div className="empty"><div className="big">No insights available</div><div>Try broadening the repository filters.</div></div>;
  }

  return (
    <div className="insights-list">
      {insights.map((insight) => {
        const repo = reposByName.get(insight.repo);
        if (!repo) return null;
        return (
          <article className="insight-card" key={insight.repo} onClick={() => onRepoClick(repo)} onKeyDown={(event) => event.key === "Enter" && onRepoClick(repo)} tabIndex={0}>
            <div className="insight-head">
              <div>
                <strong>{insight.repo}</strong>
                <span>{insight.healthScore}/100 health · {insight.healthLabel}</span>
              </div>
              <div className={`health-pill ${insight.healthLabel}`}>{insight.healthLabel}</div>
            </div>
            <div className="insight-meta">
              <span>{insight.issueCount} open issues</span>
              <span>{insight.staleIssueCount} stale</span>
              <span>{formatNumber(insight.viewsCount)} views</span>
              <span>{formatNumber(insight.totalDownloads)} downloads</span>
              <span>pushed {formatRelativeTime(repo.pushedAt)}</span>
            </div>
            {insight.alerts.length ? (
              <div className="insight-section">
                <h4>Alerts</h4>
                {insight.alerts.map((item) => <p key={item}>{item}</p>)}
              </div>
            ) : null}
            {insight.opportunities.length ? (
              <div className="insight-section">
                <h4>Opportunities</h4>
                {insight.opportunities.map((item) => <p key={item}>{item}</p>)}
              </div>
            ) : null}
            {insight.correlations.length ? (
              <div className="insight-section">
                <h4>Correlation</h4>
                {insight.correlations.map((item) => <p key={item}>{item}</p>)}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
