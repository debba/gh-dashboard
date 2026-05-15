import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  DeviceFlowPoll,
  DeviceFlowStart,
  Provider,
  ProviderCapabilities,
  ProviderConfig,
  ProviderIdentity,
} from "./types";

const execFileAsync = promisify(execFile);

const CAPABILITIES: ProviderCapabilities = {
  graphql: true,
  notifications: true,
  projects: true,
  ciWorkflows: true,
  codeSearch: true,
  dependents: true,
  traffic: true,
  stargazerHistory: true,
};

interface PendingFlow {
  deviceCode: string;
  interval: number;
  expiresAt: number;
}

export class GitHubProvider implements Provider {
  readonly kind = "github" as const;
  readonly capabilities = CAPABILITIES;

  private pending: PendingFlow | null = null;
  private lastPollAt = 0;

  constructor(readonly config: ProviderConfig) {}

  private clientId(): string {
    const id = this.config.oauthClientId ?? process.env.GITHUB_CLIENT_ID?.trim();
    if (!id) {
      throw new Error(
        "GITHUB_CLIENT_ID is not set. Register an OAuth App at https://github.com/settings/developers " +
          "(enable Device Flow) and export GITHUB_CLIENT_ID before starting the server.",
      );
    }
    return id;
  }

  private scopes(): string {
    return (
      process.env.GITHUB_OAUTH_SCOPES?.trim() ||
      this.config.oauthScopes ||
      "repo read:org project read:user user:email"
    );
  }

  async startDeviceFlow(): Promise<DeviceFlowStart> {
    const url = this.config.oauthDeviceCodeUrl;
    if (!url) throw new Error(`Device flow URL not configured for ${this.config.id}`);
    const body = new URLSearchParams({ client_id: this.clientId(), scope: this.scopes() });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const text = await response.text();
    let parsed: {
      device_code?: string;
      user_code?: string;
      verification_uri?: string;
      expires_in?: number;
      interval?: number;
      error?: string;
      error_description?: string;
    } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // body not JSON
    }
    if (!response.ok || parsed.error || !parsed.device_code) {
      const detail = parsed.error_description || parsed.error || text || `HTTP ${response.status}`;
      throw new Error(`GitHub device-code request failed: ${detail}`);
    }
    this.pending = {
      deviceCode: parsed.device_code,
      interval: Math.max(5, parsed.interval || 5),
      expiresAt: Date.now() + (parsed.expires_in ?? 900) * 1000,
    };
    this.lastPollAt = 0;
    return {
      userCode: parsed.user_code ?? "",
      verificationUri: parsed.verification_uri ?? "",
      expiresIn: parsed.expires_in ?? 0,
      interval: parsed.interval ?? 5,
      deviceCode: parsed.device_code,
    };
  }

  async pollDeviceFlow(deviceCode: string): Promise<DeviceFlowPoll> {
    if (!this.pending || this.pending.deviceCode !== deviceCode) {
      return { status: "error", error: "no pending device flow" };
    }
    if (Date.now() >= this.pending.expiresAt) {
      this.pending = null;
      return { status: "expired" };
    }
    const minInterval = this.pending.interval * 1000;
    if (Date.now() - this.lastPollAt < minInterval) return { status: "throttled" };
    this.lastPollAt = Date.now();

    const url = this.config.oauthTokenUrl;
    if (!url) return { status: "error", error: "oauthTokenUrl not configured" };
    const body = new URLSearchParams({
      client_id: this.clientId(),
      device_code: this.pending.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await response.json()) as {
      access_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
      interval?: number;
    };

    if (data.access_token) {
      const identity = await this.fetchIdentity(data.access_token);
      this.pending = null;
      return {
        status: "ok",
        accessToken: data.access_token,
        scope: data.scope ?? "",
        login: identity.login,
      };
    }

    switch (data.error) {
      case "authorization_pending":
        return { status: "pending" };
      case "slow_down":
        if (data.interval) this.pending.interval = Math.max(this.pending.interval, data.interval);
        return { status: "throttled", interval: data.interval };
      case "expired_token":
        this.pending = null;
        return { status: "expired" };
      case "access_denied":
        this.pending = null;
        return { status: "denied" };
      default:
        return { status: "error", error: data.error_description || data.error || "unknown error" };
    }
  }

  async fetchIdentity(token: string): Promise<ProviderIdentity> {
    const response = await fetch(`${this.config.baseUrl}/user`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": this.config.userAgent,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      return { login: "", scope: response.headers.get("x-oauth-scopes") };
    }
    const data = (await response.json()) as { login?: string; avatar_url?: string; html_url?: string };
    return {
      login: data.login ?? "",
      scope: response.headers.get("x-oauth-scopes"),
      avatarUrl: data.avatar_url ?? null,
      htmlUrl: data.html_url ?? null,
    };
  }

  async loadFromGhCli(): Promise<{ token: string } | null> {
    try {
      const { stdout } = await execFileAsync("gh", ["auth", "token"], { timeout: 5000 });
      const token = stdout.trim();
      if (!token) return null;
      return { token };
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { stderr?: string };
      if (err.code === "ENOENT") {
        throw new Error(
          "gh CLI is not installed. Install it from https://cli.github.com/ or switch GH_AUTH_MODE.",
        );
      }
      const detail = err.stderr?.trim() || err.message;
      throw new Error(`gh auth token failed: ${detail}. Run 'gh auth login' first.`);
    }
  }

  avatarUrl(login: string, size = 64): string {
    return `${this.config.webUrl}/${encodeURIComponent(login)}.png?size=${size}`;
  }

  webUrlFor(
    kind: "user" | "repo" | "issue" | "pr",
    parts: Record<string, string | number>,
  ): string {
    const base = this.config.webUrl;
    switch (kind) {
      case "user":
        return `${base}/${parts.login}`;
      case "repo":
        return `${base}/${parts.owner}/${parts.repo}`;
      case "issue":
        return `${base}/${parts.owner}/${parts.repo}/issues/${parts.number}`;
      case "pr":
        return `${base}/${parts.owner}/${parts.repo}/pull/${parts.number}`;
    }
  }
}
