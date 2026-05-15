import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DATA_DIR } from "./config";

/**
 * @deprecated Legacy single-account token storage. New code must use
 * `accountStore` instead. This module is kept to support backwards-compatible
 * tooling and tests; production paths no longer call it.
 */

const TOKEN_PATH = resolve(DATA_DIR, "auth.json");

export interface StoredToken {
  accessToken: string;
  scope: string;
  obtainedAt: string;
  login?: string;
}

let cache: StoredToken | null | undefined;

export async function readToken(): Promise<StoredToken | null> {
  if (cache !== undefined) return cache;
  try {
    const raw = await readFile(TOKEN_PATH, "utf-8");
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed?.accessToken) {
      cache = null;
      return null;
    }
    cache = parsed;
    return cache;
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      cache = null;
      return null;
    }
    throw error;
  }
}

export async function writeToken(token: StoredToken): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify(token), { mode: 0o600 });
  cache = token;
}

export async function updateLogin(login: string): Promise<void> {
  const current = await readToken();
  if (!current) return;
  if (current.login === login) return;
  await writeToken({ ...current, login });
}

export async function clearToken(): Promise<void> {
  cache = null;
  try {
    await rm(TOKEN_PATH, { force: true });
  } catch {
    // best-effort
  }
}

export function resetTokenCache(): void {
  cache = undefined;
}
