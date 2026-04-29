const REPOSITORY_PATTERN = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;
const REPO_API_PREFIX = "https://api.github.com/repos/";

export function parseRepositoryName(raw: string | null): [string, string] | null {
  if (!raw) return null;
  const match = REPOSITORY_PATTERN.exec(raw);
  return match ? [match[1], match[2]] : null;
}

export function getOwner(nameWithOwner: string): string {
  return nameWithOwner.split("/")[0] ?? "";
}

export function getRepositoryName(nameWithOwner: string): string {
  return nameWithOwner.split("/")[1] ?? "";
}

export function nameWithOwnerFromApiUrl(repositoryUrl: string): string {
  return repositoryUrl.startsWith(REPO_API_PREFIX)
    ? repositoryUrl.slice(REPO_API_PREFIX.length)
    : repositoryUrl;
}
