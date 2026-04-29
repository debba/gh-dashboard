import { clearToken, readToken, writeToken, type StoredToken } from "./tokenStore";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

const DEFAULT_SCOPES = "repo read:org project read:user user:email";

interface PendingFlow {
  deviceCode: string;
  interval: number;
  expiresAt: number;
}

let pending: PendingFlow | null = null;
let lastPollAt = 0;

function clientId(): string {
  const id = process.env.GITHUB_CLIENT_ID?.trim();
  if (!id) {
    throw new Error(
      "GITHUB_CLIENT_ID is not set. Register an OAuth App at https://github.com/settings/developers " +
      "(enable Device Flow) and export GITHUB_CLIENT_ID before starting the server."
    );
  }
  return id;
}

function scopes(): string {
  return process.env.GITHUB_OAUTH_SCOPES?.trim() || DEFAULT_SCOPES;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface DeviceFlowStartResult {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export async function startDeviceFlow(): Promise<DeviceFlowStartResult> {
  const body = new URLSearchParams({ client_id: clientId(), scope: scopes() });
  const response = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await response.text();
  let parsed: Partial<DeviceCodeResponse & { error: string; error_description: string }> = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    // Body is not JSON; surface the raw text in the error path below.
  }
  if (!response.ok || parsed.error) {
    const detail = parsed.error_description || parsed.error || text || `HTTP ${response.status}`;
    throw new Error(`GitHub device-code request failed: ${detail}`);
  }
  const data = parsed as DeviceCodeResponse;
  pending = {
    deviceCode: data.device_code,
    interval: Math.max(5, data.interval || 5),
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  lastPollAt = 0;
  return {
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}

interface AccessTokenResponse {
  access_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

export type DeviceFlowPollResult =
  | { status: "pending" }
  | { status: "throttled" }
  | { status: "expired" }
  | { status: "denied" }
  | { status: "error"; error: string }
  | { status: "ok"; login: string };

async function fetchUserLogin(token: string): Promise<string> {
  const response = await fetch(USER_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "gh-issues-dashboard",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub /user request failed: HTTP ${response.status}`);
  }
  const data = (await response.json()) as { login?: string };
  if (!data.login) throw new Error("GitHub /user response missing login");
  return data.login;
}

export async function pollDeviceFlow(): Promise<DeviceFlowPollResult> {
  if (!pending) return { status: "error", error: "no pending device flow" };
  if (Date.now() >= pending.expiresAt) {
    pending = null;
    return { status: "expired" };
  }
  const minInterval = pending.interval * 1000;
  if (Date.now() - lastPollAt < minInterval) return { status: "throttled" };
  lastPollAt = Date.now();

  const body = new URLSearchParams({
    client_id: clientId(),
    device_code: pending.deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  const response = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await response.json()) as AccessTokenResponse;

  if (data.access_token) {
    const login = await fetchUserLogin(data.access_token);
    const stored: StoredToken = {
      accessToken: data.access_token,
      scope: data.scope ?? "",
      obtainedAt: new Date().toISOString(),
      login,
    };
    await writeToken(stored);
    pending = null;
    return { status: "ok", login };
  }

  switch (data.error) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down":
      if (data.interval) pending.interval = Math.max(pending.interval, data.interval);
      return { status: "throttled" };
    case "expired_token":
      pending = null;
      return { status: "expired" };
    case "access_denied":
      pending = null;
      return { status: "denied" };
    default:
      return { status: "error", error: data.error_description || data.error || "unknown error" };
  }
}

export async function logout(): Promise<void> {
  pending = null;
  await clearToken();
}

export async function authStatus(): Promise<{ authenticated: boolean; login: string | null; scope: string | null }> {
  const token = await readToken();
  if (!token) return { authenticated: false, login: null, scope: null };
  return { authenticated: true, login: token.login ?? null, scope: token.scope ?? null };
}

export function isClientIdConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID?.trim());
}
