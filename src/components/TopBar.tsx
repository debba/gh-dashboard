import type { ReactNode } from "react";
import appLogo from "../assets/app-logo-mark.svg";

interface TopBarProps {
  subtitle: string;
  lastUpdated: string;
  loading: boolean;
  themeLabel: string;
  themeIcon: ReactNode;
  authLogin: string | null;
  owners: string[];
  onThemeToggle: () => void;
  onRefresh: () => void;
  onOpenFilters: () => void;
  onOpenPalette: () => void;
  onLogout: () => void;
  canLogout?: boolean;
}

export function TopBar({
  subtitle,
  lastUpdated,
  loading,
  themeLabel,
  themeIcon,
  authLogin,
  owners,
  onThemeToggle,
  onRefresh,
  onOpenFilters,
  onOpenPalette,
  onLogout,
  canLogout = true,
}: TopBarProps) {
  // Orgs are all owners except the user's own login
  const orgs = owners.filter((o) => o !== authLogin);

  return (
    <div className="topbar">
      <div className="brand">
        {/* Wrapper for logo + org badges. Logo keeps its original overflow:hidden for border-radius. */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div className="logo">
            <img src={authLogin ? `https://github.com/${authLogin}.png?size=80` : appLogo} alt="" />
          </div>
          {/* Org badges: positioned relative to wrapper, outside logo's overflow:hidden */}
          {orgs.length > 0 && orgs.slice(0, 3).map((org, i) => (
            <img key={org} src={`https://github.com/${org}.png?size=40`} alt={org} title={org}
              style={{ position: "absolute", bottom: -4, right: -4 + i * 8, width: 20, height: 20, borderRadius: "50%", objectFit: "contain", objectPosition: "55% center", zIndex: 3 - i, border: "1px solid var(--border-soft)", background: "color-mix(in srgb, var(--panel) 85%, transparent)" }} />
          ))}
        </div>
        <div className="texts">
          <h1>GitHub Dashboard</h1>
          <div className="sub">{subtitle}</div>
        </div>
      </div>
      <div className="spacer" />
      <div className="topbar-actions">
        <span className="meta">{lastUpdated}</span>
        <button className="btn search-btn" aria-label="Search (Cmd+K)" title="Search (Cmd+K)" onClick={onOpenPalette}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <span className="label">Search</span>
          <kbd className="kbd kbd--sm">⌘K</kbd>
        </button>
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
        {canLogout ? (
          <button className="btn auth-btn" aria-label="Sign out" title={authLogin ? `Signed in as ${authLogin}` : "Sign out"} onClick={onLogout}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            <span className="label">{authLogin || "Sign out"}</span>
          </button>
        ) : (
          <span className="btn auth-btn" aria-label="Signed in" title={authLogin ? `Signed in as ${authLogin} — sign out from your gh CLI or environment` : "Authenticated externally"} style={{ cursor: "default", opacity: 0.85 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            <span className="label">{authLogin || "Authenticated"}</span>
          </span>
        )}
      </div>
    </div>
  );
}
