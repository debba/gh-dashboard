import { useEffect, useMemo, useRef, useState } from "react";
import type { GhIssue, GhPullRequest, GhRepo } from "../../types/github";

export type PaletteTab =
  | "inbox"
  | "repos"
  | "issues"
  | "prs"
  | "kanban"
  | "insights"
  | "ci"
  | "digests";

interface CommandPaletteProps {
  repos: GhRepo[];
  issues: GhIssue[];
  pullRequests: GhPullRequest[];
  onNavigateTab: (tab: PaletteTab) => void;
  onOpenRepo: (repo: GhRepo) => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
  onClose: () => void;
}

type EntryKind = "tab" | "action" | "repo" | "issue" | "pr";

interface Entry {
  id: string;
  kind: EntryKind;
  label: string;
  hint?: string;
  haystack: string;
  run: () => void;
}

const TAB_DEFS: { key: PaletteTab; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "repos", label: "Repositories" },
  { key: "issues", label: "Issues" },
  { key: "prs", label: "Pull Requests" },
  { key: "insights", label: "Insights" },
  { key: "ci", label: "CI" },
  { key: "digests", label: "Daily" },
  { key: "kanban", label: "Board" },
];

const SECTION_LABELS: Record<EntryKind, string> = {
  tab: "Navigate",
  action: "Actions",
  repo: "Repositories",
  pr: "Pull Requests",
  issue: "Issues",
};

const SECTION_ORDER: EntryKind[] = ["tab", "action", "repo", "pr", "issue"];

const PER_KIND_CAP: Record<EntryKind, number> = {
  tab: 7,
  action: 5,
  repo: 8,
  pr: 8,
  issue: 8,
};

function score(haystack: string, needle: string): number {
  if (!needle) return 1;
  const idx = haystack.indexOf(needle);
  if (idx < 0) return 0;
  // earlier match = higher score; word-start bonus
  const prev = idx === 0 ? " " : haystack[idx - 1];
  const wordStart = prev === " " || prev === "/" || prev === "-" || prev === "_";
  return 1000 - idx + (wordStart ? 50 : 0);
}

export function CommandPalette({
  repos,
  issues,
  pullRequests,
  onNavigateTab,
  onOpenRepo,
  onRefresh,
  onToggleTheme,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allEntries = useMemo<Entry[]>(() => {
    const entries: Entry[] = [];
    for (const tab of TAB_DEFS) {
      entries.push({
        id: `tab:${tab.key}`,
        kind: "tab",
        label: tab.label,
        hint: "Tab",
        haystack: tab.label.toLowerCase(),
        run: () => onNavigateTab(tab.key),
      });
    }
    entries.push({
      id: "action:refresh",
      kind: "action",
      label: "Refresh data",
      hint: "Reload from GitHub",
      haystack: "refresh reload sync",
      run: () => onRefresh(),
    });
    entries.push({
      id: "action:theme",
      kind: "action",
      label: "Toggle theme",
      hint: "Dark / Light / Auto",
      haystack: "toggle theme dark light auto appearance",
      run: () => onToggleTheme(),
    });
    for (const repo of repos) {
      entries.push({
        id: `repo:${repo.nameWithOwner}`,
        kind: "repo",
        label: repo.nameWithOwner,
        hint: repo.primaryLanguage?.name || (repo.isPrivate ? "private" : "public"),
        haystack: `${repo.nameWithOwner} ${repo.description ?? ""}`.toLowerCase(),
        run: () => onOpenRepo(repo),
      });
    }
    for (const pr of pullRequests) {
      entries.push({
        id: `pr:${pr.repository.nameWithOwner}#${pr.number}`,
        kind: "pr",
        label: `${pr.repository.nameWithOwner}#${pr.number} — ${pr.title}`,
        hint: pr.isDraft ? "Draft" : pr.reviewDecision === "APPROVED" ? "Approved" : "Open PR",
        haystack: `${pr.repository.nameWithOwner} #${pr.number} ${pr.title}`.toLowerCase(),
        run: () => window.open(pr.url, "_blank", "noopener,noreferrer"),
      });
    }
    for (const issue of issues) {
      entries.push({
        id: `issue:${issue.repository.nameWithOwner}#${issue.number}`,
        kind: "issue",
        label: `${issue.repository.nameWithOwner}#${issue.number} — ${issue.title}`,
        hint: "Open issue",
        haystack: `${issue.repository.nameWithOwner} #${issue.number} ${issue.title}`.toLowerCase(),
        run: () => window.open(issue.url, "_blank", "noopener,noreferrer"),
      });
    }
    return entries;
  }, [repos, issues, pullRequests, onNavigateTab, onOpenRepo, onRefresh, onToggleTheme]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const scored: { entry: Entry; score: number }[] = [];
    for (const entry of allEntries) {
      const s = score(entry.haystack, needle);
      if (s > 0) scored.push({ entry, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    const grouped: Record<EntryKind, Entry[]> = {
      tab: [],
      action: [],
      repo: [],
      pr: [],
      issue: [],
    };
    for (const { entry } of scored) {
      const bucket = grouped[entry.kind];
      if (bucket.length < PER_KIND_CAP[entry.kind]) bucket.push(entry);
    }
    const flat: Entry[] = [];
    for (const kind of SECTION_ORDER) flat.push(...grouped[kind]);
    return { flat, grouped };
  }, [allEntries, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((idx) => Math.min(results.flat.length - 1, idx + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((idx) => Math.max(0, idx - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const entry = results.flat[activeIndex];
      if (entry) {
        entry.run();
        onClose();
      }
    }
  }

  let runningIndex = 0;

  return (
    <div className="modal-root command-palette-root">
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="command-palette-input-row">
          <span className="command-palette-icon" aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            className="command-palette-input"
            placeholder="Search repositories, issues, PRs, or jump to a tab…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
          <kbd className="kbd">esc</kbd>
        </div>
        <div className="command-palette-results" ref={listRef}>
          {results.flat.length === 0 ? (
            <div className="command-palette-empty">No matches</div>
          ) : (
            SECTION_ORDER.map((kind) => {
              const items = results.grouped[kind];
              if (!items.length) return null;
              return (
                <div className="command-palette-section" key={kind}>
                  <div className="command-palette-section-title">{SECTION_LABELS[kind]}</div>
                  {items.map((entry) => {
                    const idx = runningIndex++;
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`command-palette-item${active ? " active" : ""}`}
                        data-cmd-index={idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => {
                          entry.run();
                          onClose();
                        }}
                      >
                        <span className="command-palette-item-label">{entry.label}</span>
                        {entry.hint ? (
                          <span className="command-palette-item-hint">{entry.hint}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <footer className="command-palette-foot">
          <span><kbd className="kbd kbd--sm">↑</kbd><kbd className="kbd kbd--sm">↓</kbd> navigate</span>
          <span><kbd className="kbd kbd--sm">↵</kbd> select</span>
          <span><kbd className="kbd kbd--sm">esc</kbd> close</span>
        </footer>
      </div>
    </div>
  );
}
