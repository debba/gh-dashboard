import type { DailyDigestEntry } from "../../types/github";
import { buildDailyDigestMarkdown } from "../../utils/digests";
import { formatNumber } from "../../utils/format";

export function DailyDigestView({ digests }: { digests: DailyDigestEntry[] }) {
  async function copyDigest(digest: DailyDigestEntry) {
    await navigator.clipboard.writeText(buildDailyDigestMarkdown(digest));
  }

  if (!digests.length) {
    return <div className="empty"><div className="big">No daily digests yet</div><div>Refresh the dashboard on different days to build history.</div></div>;
  }

  return (
    <div className="digest-list">
      {digests.map((digest) => (
        <article className="digest-card" key={digest.date}>
          <div className="digest-head">
            <div>
              <strong>{new Date(`${digest.date}T00:00:00`).toLocaleDateString()}</strong>
              <span>{formatNumber(digest.repoCount)} repos tracked</span>
            </div>
            <div className="digest-badges">
              <span>★ {digest.starsDelta >= 0 ? "+" : ""}{formatNumber(digest.starsDelta)}</span>
              <span>forks {digest.forksDelta >= 0 ? "+" : ""}{formatNumber(digest.forksDelta)}</span>
              <span>issues {digest.issueDelta >= 0 ? "+" : ""}{formatNumber(digest.issueDelta)}</span>
              <button type="button" className="digest-copy-btn" onClick={() => void copyDigest(digest)}>Copy Markdown</button>
            </div>
          </div>
          {digest.ai ? (
            <div className="digest-ai-block">
              <div className="digest-ai-head">
                <strong>{digest.ai.headline}</strong>
                <span>{digest.ai.model}</span>
              </div>
              <div className="digest-ai-briefing">
                {digest.ai.briefing.map((item) => <p key={item}>{item}</p>)}
              </div>
            </div>
          ) : null}
          <div className="digest-pill-groups">
            <div className="digest-pill-group">
              <h4>Executive Summary</h4>
              {digest.executiveSummary.map((item) => <span key={item}>{item}</span>)}
            </div>
            {digest.momentum.length ? (
              <div className="digest-pill-group positive">
                <h4>Momentum</h4>
                {digest.momentum.map((item) => <span key={item}>{item}</span>)}
              </div>
            ) : null}
            {digest.risks.length ? (
              <div className="digest-pill-group risk">
                <h4>Risks</h4>
                {digest.risks.map((item) => <span key={item}>{item}</span>)}
              </div>
            ) : null}
          </div>
          <div className="digest-summary">
            {digest.highlights.map((item) => <p key={item}>{item}</p>)}
          </div>
          <div className="digest-repo-list">
            {digest.repos.map((repo) => (
              <div className="digest-repo-row" key={`${digest.date}-${repo.repo}`}>
                <strong>{repo.repo}</strong>
                <span>★ {repo.starsDelta >= 0 ? "+" : ""}{formatNumber(repo.starsDelta)}</span>
                <span>forks {repo.forksDelta >= 0 ? "+" : ""}{formatNumber(repo.forksDelta)}</span>
                <em>issues {repo.issueDelta >= 0 ? "+" : ""}{formatNumber(repo.issueDelta)}</em>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
