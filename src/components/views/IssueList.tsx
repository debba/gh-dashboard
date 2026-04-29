import type { GhIssue } from "../../types/github";
import { formatRelativeTime } from "../../utils/format";
import { getOwner, getRepositoryName } from "../../utils/repository";
import { getContrastColor } from "../../utils/colors";

export function IssueList({ issues }: { issues: GhIssue[] }) {
  if (!issues.length) {
    return <div className="empty"><div className="big">No issues match your filters</div><div>Try clearing a filter or broadening the search.</div></div>;
  }

  return (
    <div className="list">
      {issues.map((issue) => {
        const owner = getOwner(issue.repository.nameWithOwner);
        const repo = getRepositoryName(issue.repository.nameWithOwner);
        const stale = Date.now() - new Date(issue.updatedAt).getTime() > 30 * 86_400_000;
        return (
          <article className="issue" key={issue.url}>
            <div className="main-col">
              <div className="row1">
                <span className="repo-pill"><span>{owner}</span><span className="sep">/</span><span>{repo}</span></span>
                <span className="num">#{issue.number}</span>
                {stale ? <span className="stale-badge">Stale</span> : null}
              </div>
              <a className="title-link" href={issue.url} target="_blank" rel="noreferrer">{issue.title}</a>
              <div className="labels">
                {(issue.labels || []).map((label) => {
                  const color = (label.color || "").replace("#", "");
                  return (
                    <span className="label" key={label.name} style={color ? { background: `#${color}22`, borderColor: `#${color}55`, color: getContrastColor(color) === "#0a0c12" ? "#ffeecc" : "#e7eaf3" } : undefined}>
                      <span className="dot" style={{ background: color ? `#${color}` : "var(--muted)" }} />
                      {label.name}
                    </span>
                  );
                })}
              </div>
              <div className="meta-row">
                {issue.author?.login ? <span className="author-chip"><span className="avatar">{issue.author.login.slice(0, 2).toUpperCase()}</span>{issue.author.login}</span> : null}
                <span>opened {formatRelativeTime(issue.createdAt)}</span>
                <span className="sep">·</span>
                <span>updated {formatRelativeTime(issue.updatedAt)}</span>
              </div>
            </div>
            <div className="aside-col">
              <span className="comments">{issue.commentsCount} comments</span>
              {(issue.assignees || []).length ? <span>{issue.assignees?.map((assignee) => assignee.login).join(", ")}</span> : <span>No assignee</span>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
