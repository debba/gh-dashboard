const REPO_NAME_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

export function isValidRepoName(value: string): boolean {
  return REPO_NAME_PATTERN.test(value);
}

export function normalizeAliases(repo: string, aliases: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>([repo]);
  for (const raw of aliases) {
    const value = raw.trim();
    if (!isValidRepoName(value) || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function buildMentionQuery(repo: string, aliases: readonly string[]): string {
  const names = [repo, ...normalizeAliases(repo, aliases)];
  return names.map((name) => `"${name}"`).join(" OR ");
}
