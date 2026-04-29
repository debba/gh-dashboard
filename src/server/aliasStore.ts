import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DATA_DIR } from "./config";

const ALIASES_PATH = resolve(DATA_DIR, "aliases.json");
const MAX_ALIASES_PER_REPO = 10;

type AliasFile = Record<string, string[]>;

let cache: AliasFile | null = null;
let loadPromise: Promise<AliasFile> | null = null;

async function load(): Promise<AliasFile> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await readFile(ALIASES_PATH, "utf-8");
      cache = JSON.parse(raw) as AliasFile;
    } catch {
      cache = {};
    }
    return cache;
  })();
  return loadPromise;
}

async function save(): Promise<void> {
  if (!cache) return;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ALIASES_PATH, JSON.stringify(cache));
}

export async function getAliases(repo: string): Promise<string[]> {
  const file = await load();
  return file[repo] ? [...file[repo]] : [];
}

export async function addAlias(repo: string, alias: string): Promise<string[]> {
  if (alias === repo) return getAliases(repo);
  const file = await load();
  const list = file[repo] ? [...file[repo]] : [];
  if (!list.includes(alias)) list.push(alias);
  if (list.length > MAX_ALIASES_PER_REPO) list.splice(0, list.length - MAX_ALIASES_PER_REPO);
  file[repo] = list;
  await save();
  return list;
}

export async function removeAlias(repo: string, alias: string): Promise<string[]> {
  const file = await load();
  const list = (file[repo] || []).filter((entry) => entry !== alias);
  if (list.length) file[repo] = list;
  else delete file[repo];
  await save();
  return list;
}

export function resetAliasCache(): void {
  cache = null;
  loadPromise = null;
}
