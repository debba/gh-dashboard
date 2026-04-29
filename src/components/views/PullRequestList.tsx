import type { GhPullRequest } from "../../types/github";
import { reviewDecisionLabel } from "../../utils/dashboard";
import { formatNumber, formatRelativeTime } from "../../utils/format";
import { getOwner, getRepositoryName } from "../../utils/repository";
import { getContrastColor } from "../../utils/colors";

function reviewBadgeClass(pr: GhPullRequest): string {
  if (pr.reviewDecision === "APPROVED") return "approved";
  if (pr.reviewDecision === "CHANGES_REQUESTED") return "changes";
  return "pending";
}

export function PullRequestList({ pullRequests }: { pullRequests: GhPullRequest[] }) {
  if (!pullRequests.length) {
    return <div className="empty"><div className="big">No pull requests match your filters</div><div>Try clearing a filter or broadening the search.</div></div>;
  }

  return (
    <div className="list">
      {pullRequests.map((pr) => {
        const owner = getOwner(pr.repository.nameWithOwner);
        const repo = getRepositoryName(pr.repository.nameWithOwner);
        const stale = Date.now() - new Date(pr.updatedAt).getTime() > 14 * 86_400_000;
        return (
          <article className="issue" key={pr.url}>
            <div className="main-col">
              <div className="row1">
                <span className="repo-pill"><span>{owner}</span><span className="sep">/</span><span>{repo}</span></span>
                <span className="num">#{pr.number}</span>
                {pr.isDraft ? <span className="pr-badge draft">Draft</span> : null}
                <span className={`pr-badge review ${reviewBadgeClass(pr)}`}>{reviewDecisionLabel(pr.reviewDecision)}</span>
                {stale ? <span className="stale-badge">Stale</span> : null}
              </div>
              <a className="title-link" href={pr.url} target="_blank" rel="noreferrer">{pr.title}</a>
              <div className="labels">
                {(pr.labels || []).map((label) => {
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
                {pr.author?.login ? <span className="author-chip"><span className="avatar">{pr.author.login.slice(0, 2).toUpperCase()}</span>{pr.author.login}</span> : null}
                <span>opened {formatRelativeTime(pr.createdAt)}</span>
                <span className="sep">·</span>
                <span>updated {formatRelativeTime(pr.updatedAt)}</span>
                <span className="sep">·</span>
                <span className="pr-branch">{pr.headRefName} → {pr.baseRefName}</span>
              </div>
            </div>
            <div className="aside-col">
              <span className="pr-diff">
                <span className="pr-diff-add">+{formatNumber(pr.additions)}</span>
                <span className="pr-diff-del">−{formatNumber(pr.deletions)}</span>
                <em>{formatNumber(pr.changedFiles)} files</em>
              </span>
              <span className="comments">{pr.commentsCount} comments</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
