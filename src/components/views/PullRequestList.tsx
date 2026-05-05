import type { GhPullRequest } from "../../types/github";
import { reviewDecisionLabel } from "../../utils/dashboard";
import { formatNumber, formatRelativeTime } from "../../utils/format";
import { getContrastColor } from "../../utils/colors";
import { Avatar } from "../common/Avatar";
import { PulseIcon } from "../common/Icons";

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
    <div className="data-list">
      {pullRequests.map((pr) => {
        const stale = Date.now() - new Date(pr.updatedAt).getTime() > 14 * 86_400_000;
        const author = pr.author?.login || "unknown";
        return (
          <a className="data-row" href={pr.url} key={pr.url} target="_blank" rel="noreferrer">
            <Avatar login={pr.author?.login} size={36} />
            <div className="data-row-body">
              <div className="data-row-top">
                <strong className="data-row-author">{author}</strong>
                <span className="data-row-repo">{pr.repository.nameWithOwner}</span>
                <span className="data-row-num">#{pr.number}</span>
                <em>{formatRelativeTime(pr.updatedAt)}</em>
              </div>
              <div className="data-row-title">{pr.title}</div>
              <div className="data-row-meta">
                <span className="data-kind pull-request"><PulseIcon /> PR</span>
                {pr.isDraft ? <span className="pr-badge draft">Draft</span> : null}
                <span className={`pr-badge review ${reviewBadgeClass(pr)}`}>{reviewDecisionLabel(pr.reviewDecision)}</span>
                {stale ? <span className="stale-badge">Stale</span> : null}
                {(pr.labels || []).slice(0, 3).map((label) => {
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
                <span className="data-row-spacer" />
                <span className="pr-diff">
                  <span className="pr-diff-add">+{formatNumber(pr.additions)}</span>
                  <span className="pr-diff-del">−{formatNumber(pr.deletions)}</span>
                </span>
                <span className="data-row-count">{pr.commentsCount} comments</span>
                {pr.assignees && pr.assignees.length ? (
                  <span className="data-row-assignees">
                    {pr.assignees.slice(0, 3).map((assignee) => (
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
