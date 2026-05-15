import {
  add as addAccount,
  init as initAccountStore,
  list as listAccounts,
  remove as removeAccount,
} from "./accountStore";
import { getAuthMode, getProviderStatus, resetExternalAuthCaches } from "./authProvider";
import { getProvider } from "./providers/registry";
import type { Account } from "./providers/types";

const DEFAULT_PROVIDER_ID = "github.com";

interface PendingFlow {
  providerConfigId: string;
  deviceCode: string;
}

let pending: PendingFlow | null = null;

export interface DeviceFlowStartResult {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export async function startDeviceFlow(
  providerConfigId: string = DEFAULT_PROVIDER_ID,
): Promise<DeviceFlowStartResult> {
  await initAccountStore();
  const provider = await getProvider(providerConfigId);
  const result = await provider.startDeviceFlow();
  pending = { providerConfigId, deviceCode: result.deviceCode };
  return {
    userCode: result.userCode,
    verificationUri: result.verificationUri,
    expiresIn: result.expiresIn,
    interval: result.interval,
  };
}

export type DeviceFlowPollResult =
  | { status: "pending" }
  | { status: "throttled" }
  | { status: "expired" }
  | { status: "denied" }
  | { status: "error"; error: string }
  | { status: "ok"; login: string };

function buildAccount(
  providerConfigId: string,
  accessToken: string,
  scope: string,
  login: string,
  kind: Account["providerKind"],
  webHost: string,
): Account {
  const safeLogin = (login || "user").replace(/[^a-zA-Z0-9_-]/g, "_");
  const prefix = kind === "github" ? "gh" : kind === "forgejo" ? "fj" : kind;
  return {
    id: `${prefix}_${safeLogin}_${providerConfigId}`,
    providerKind: kind,
    providerConfigId,
    label: login ? `${login} (${webHost})` : webHost,
    login: login || null,
    accessToken,
    scope,
    obtainedAt: new Date().toISOString(),
    source: "device",
  };
}

export async function pollDeviceFlow(): Promise<DeviceFlowPollResult> {
  if (!pending) return { status: "error", error: "no pending device flow" };
  const provider = await getProvider(pending.providerConfigId);
  const result = await provider.pollDeviceFlow(pending.deviceCode);
  if (result.status === "ok") {
    const webHost = new URL(provider.config.webUrl).host;
    const account = buildAccount(
      pending.providerConfigId,
      result.accessToken,
      result.scope,
      result.login,
      provider.kind,
      webHost,
    );
    await initAccountStore();
    await addAccount(account);
    pending = null;
    return { status: "ok", login: result.login };
  }
  if (result.status === "expired" || result.status === "denied") {
    pending = null;
  }
  if (result.status === "throttled") return { status: "throttled" };
  if (result.status === "pending") return { status: "pending" };
  if (result.status === "expired") return { status: "expired" };
  if (result.status === "denied") return { status: "denied" };
  return { status: "error", error: result.error ?? "unknown error" };
}

export async function logout(): Promise<void> {
  pending = null;
  await initAccountStore();
  const accounts = await listAccounts();
  for (const account of accounts) {
    if (!account.ephemeral) await removeAccount(account.id);
  }
  resetExternalAuthCaches();
}

export interface AuthStatusPayload {
  authenticated: boolean;
  login: string | null;
  scope: string | null;
  mode: ReturnType<typeof getAuthMode>;
  detail?: string | null;
}

export async function authStatus(): Promise<AuthStatusPayload> {
  const mode = getAuthMode();
  const status = await getProviderStatus();
  return { mode, ...status };
}

export function isClientIdConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID?.trim());
}
