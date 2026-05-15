import type {
  DeviceFlowPoll,
  DeviceFlowStart,
  Provider,
  ProviderCapabilities,
  ProviderConfig,
  ProviderIdentity,
} from "./types";

const CAPABILITIES: ProviderCapabilities = {
  graphql: false,
  notifications: true,
  projects: false,
  ciWorkflows: false,
  codeSearch: false,
  dependents: false,
  traffic: false,
  stargazerHistory: false,
};

export class ForgejoProvider implements Provider {
  readonly kind = "forgejo" as const;
  readonly capabilities = CAPABILITIES;

  constructor(readonly config: ProviderConfig) {}

  async startDeviceFlow(): Promise<DeviceFlowStart> {
    throw new Error(
      `Device flow is not enabled for ${this.config.id}. Add a personal access token instead.`,
    );
  }

  async pollDeviceFlow(): Promise<DeviceFlowPoll> {
    return { status: "error", error: "device flow not supported" };
  }

  async fetchIdentity(token: string): Promise<ProviderIdentity> {
    const response = await fetch(`${this.config.baseUrl}/user`, {
      headers: {
        Accept: "application/json",
        "User-Agent": this.config.userAgent,
        Authorization: `token ${token}`,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Identity lookup failed: ${text || `HTTP ${response.status}`}`);
    }
    const data = (await response.json()) as {
      login?: string;
      username?: string;
      avatar_url?: string;
      html_url?: string;
    };
    const login = data.login ?? data.username ?? "";
    if (!login) throw new Error("Forgejo /user response missing login");
    return {
      login,
      scope: null,
      avatarUrl: data.avatar_url ?? null,
      htmlUrl: data.html_url ?? null,
    };
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
        return `${base}/${parts.owner}/${parts.repo}/pulls/${parts.number}`;
    }
  }
}
