import type { GhIssue } from "../../types/github";
import { formatRelativeTime } from "../../utils/format";
import { getContrastColor } from "../../utils/colors";
import { Avatar } from "../common/Avatar";
import { IssueIcon } from "../common/Icons";

export function IssueList({ issues }: { issues: GhIssue[] }) {
  if (!issues.length) {
    return <div className="empty"><div className="big">No issues match your filters</div><div>Try clearing a filter or broadening the search.</div></div>;
  }

  return (
    <div className="data-list">
      {issues.map((issue) => {
        const stale = Date.now() - new Date(issue.updatedAt).getTime() > 30 * 86_400_000;
        const author = issue.author?.login || "unknown";
        return (
          <a className="data-row" href={issue.url} key={issue.url} target="_blank" rel="noreferrer">
            <Avatar login={issue.author?.login} size={36} />
            <div className="data-row-body">
              <div className="data-row-top">
                <strong className="data-row-author">{author}</strong>
                <span className="data-row-repo">{issue.repository.nameWithOwner}</span>
                <span className="data-row-num">#{issue.number}</span>
                <em>{formatRelativeTime(issue.updatedAt)}</em>
              </div>
              <div className="data-row-title">{issue.title}</div>
              <div className="data-row-meta">
                <span className="data-kind issue"><IssueIcon /> Issue</span>
                {stale ? <span className="stale-badge">Stale</span> : null}
                {(issue.labels || []).slice(0, 4).map((label) => {
                  const color = (label.color || "").replace("#", "");
                  return (
                    <span
                      className="data-label"
                      key={label.name}
                      style={color ? {
                        background: `#${color}22`,
                        borderColor: `#${color}55`,
                        color: getContrastColor(color) === "#0a0c12" ? "#4a3212" : "var(--text)",
                      } : undefined}
                    >
                      {label.name}
                    </span>
                  );
                })}
                {(issue.labels || []).length > 4 ? (
                  <span className="data-label muted">+{issue.labels.length - 4}</span>
                ) : null}
                <span className="data-row-spacer" />
                <span className="data-row-count">{issue.commentsCount} comments</span>
                {issue.assignees && issue.assignees.length ? (
                  <span className="data-row-assignees">
                    {issue.assignees.slice(0, 3).map((assignee) => (
                      <Avatar key={assignee.login} login={assignee.login} size={18} />
                    ))}
                  </span>
                ) : null}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
