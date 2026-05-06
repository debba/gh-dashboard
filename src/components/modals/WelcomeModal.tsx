import { CloseIcon } from "../common/Icons";
import { APP_VERSION } from "../../version";

interface WelcomeModalProps {
  onClose: () => void;
  onViewChangelog: () => void;
}

export function WelcomeModal({ onClose, onViewChangelog }: WelcomeModalProps) {
  return (
    <div className="modal-root">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal welcome-modal" role="dialog" aria-modal="true">
        <header className="modal-head">
          <div className="modal-title">
            <span className="modal-icon welcome">✦</span>
            <div style={{ minWidth: 0 }}>
              <div className="kind">Welcome</div>
              <h3>gh-dashboard</h3>
            </div>
          </div>
          <button className="modal-close" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </header>
        <div className="modal-body welcome-body">
          <p className="welcome-lead">
            Explore your GitHub repositories, issues, pull requests, traffic and CI activity from a single dashboard.
          </p>
          <ul className="welcome-list">
            <li><strong>Repositories</strong> — health, stars, forks, traffic, releases at a glance.</li>
            <li><strong>Inbox & Triage</strong> — cross-repo issues and pull requests with smart filters.</li>
            <li><strong>Insights & Daily digest</strong> — alerts, opportunities, and AI-generated summaries.</li>
            <li><strong>Local-first</strong> — your GitHub token stays on your machine, never in the browser.</li>
          </ul>
          <div className="welcome-meta">Currently running v{APP_VERSION}</div>
        </div>
        <footer className="welcome-foot">
          <button type="button" className="btn ghost" onClick={onViewChangelog}>What's new</button>
          <button type="button" className="btn primary" onClick={onClose}>Get started</button>
        </footer>
      </div>
    </div>
  );
}
