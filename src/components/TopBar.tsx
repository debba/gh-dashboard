import type { ReactNode } from "react";
import appLogo from "../assets/app-logo-mark.svg";

interface TopBarProps {
  subtitle: string;
  lastUpdated: string;
  loading: boolean;
  themeLabel: string;
  themeIcon: ReactNode;
  authLogin: string | null;
  onThemeToggle: () => void;
  onRefresh: () => void;
  onOpenFilters: () => void;
  onLogout: () => void;
}

export function TopBar({
  subtitle,
  lastUpdated,
  loading,
  themeLabel,
  themeIcon,
  authLogin,
  onThemeToggle,
  onRefresh,
  onOpenFilters,
  onLogout,
}: TopBarProps) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="logo"><img src={appLogo} alt="" /></div>
        <div className="texts">
          <h1>GitHub Dashboard</h1>
          <div className="sub">{subtitle}</div>
        </div>
      </div>
      <div className="spacer" />
      <div className="topbar-actions">
        <span className="meta">{lastUpdated}</span>
        <button className="btn theme-btn" aria-label="Toggle theme" title="Toggle theme" onClick={onThemeToggle}>
          {themeIcon}
          <span className="label">{themeLabel}</span>
        </button>
        <button className="btn filters-toggle" aria-label="Open filters" title="Open filters" onClick={onOpenFilters}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          <span className="label">Filters</span>
        </button>
        <button className="btn primary" aria-label="Refresh" title="Refresh" disabled={loading} onClick={onRefresh}>
          <svg className={loading ? "spin" : ""} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          <span className="label">{loading ? "Loading" : "Refresh"}</span>
        </button>
        <button className="btn auth-btn" aria-label="Sign out" title={authLogin ? `Signed in as ${authLogin}` : "Sign out"} onClick={onLogout}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          <span className="label">{authLogin || "Sign out"}</span>
          {authLogin && <img className="auth-avatar" src={`https://github.com/${authLogin}.png?size=28`} alt="" width={20} height={20} />}
        </button>
      </div>
    </div>
  );
}
