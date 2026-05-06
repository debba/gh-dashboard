export interface ChangelogItem {
  text: string;
  url?: string;
  scope?: string;
}

export interface ChangelogSection {
  title: string;
  items: ChangelogItem[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  url?: string;
  sections: ChangelogSection[];
}

const VERSION_HEADING = /^#{1,3}\s+(?:\[([^\]]+)\]\(([^)]+)\)|([\d.]+(?:-[\w.]+)?))\s*(?:\(([\d-]+)\))?\s*$/;
const SECTION_HEADING = /^#{2,4}\s+(.+)\s*$/;
const ITEM_LINE = /^[*-]\s+(.+)$/;
const SCOPED_ITEM = /^\*\*([^*]+):\*\*\s+(.*)$/;
const COMMIT_LINK = /\s*\(\[[^\]]+\]\(([^)]+)\)\)\s*$/;

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const lines = markdown.split("\n");
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  let section: ChangelogSection | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const versionMatch = line.match(VERSION_HEADING);
    if (versionMatch && (line.startsWith("# ") || line.startsWith("## "))) {
      const version = versionMatch[1] ?? versionMatch[3] ?? "";
      const url = versionMatch[2];
      const date = versionMatch[4] ?? "";
      current = { version, date, url, sections: [] };
      section = null;
      entries.push(current);
      continue;
    }

    if (!current) continue;

    if (line.startsWith("### ")) {
      const headingMatch = line.match(SECTION_HEADING);
      if (headingMatch) {
        section = { title: headingMatch[1], items: [] };
        current.sections.push(section);
        continue;
      }
    }

    const itemMatch = raw.match(ITEM_LINE);
    if (itemMatch && section) {
      let text = itemMatch[1];
      let url: string | undefined;
      const linkMatch = text.match(COMMIT_LINK);
      if (linkMatch) {
        url = linkMatch[1];
        text = text.replace(COMMIT_LINK, "").trim();
      }
      const scopeMatch = text.match(SCOPED_ITEM);
      let scope: string | undefined;
      if (scopeMatch) {
        scope = scopeMatch[1];
        text = scopeMatch[2];
      }
      section.items.push({ text, url, scope });
    }
  }

  return entries;
}
