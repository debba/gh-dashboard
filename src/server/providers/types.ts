export type ProviderKind = "github" | "forgejo";

export type AccountSource = "device" | "gh-cli" | "token" | "env";

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  label: string;
  baseUrl: string;
  webUrl: string;
  graphqlUrl?: string;
  oauthAuthorizeUrl?: string;
  oauthDeviceCodeUrl?: string;
  oauthTokenUrl?: string;
  oauthClientId?: string;
  oauthScopes?: string;
  userAgent: string;
}

export interface ProviderCapabilities {
  graphql: boolean;
  notifications: boolean;
  projects: boolean;
  ciWorkflows: boolean;
  codeSearch: boolean;
  dependents: boolean;
  traffic: boolean;
  stargazerHistory: boolean;
}

export interface Account {
  id: string;
  providerKind: ProviderKind;
  providerConfigId: string;
  label: string;
  login: string | null;
  accessToken: string;
  scope: string;
  obtainedAt: string;
  source: AccountSource;
  ephemeral?: boolean;
}

export interface AccountStoreData {
  version: 1;
  activeId: string | null;
  accounts: Account[];
  providerConfigs: Record<string, ProviderConfig>;
}

export interface DeviceFlowStart {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  deviceCode: string;
}

export type DeviceFlowPoll =
  | { status: "ok"; accessToken: string; scope: string; login: string }
  | { status: "pending" }
  | { status: "throttled"; interval?: number }
  | { status: "expired" }
  | { status: "denied" }
  | { status: "error"; error: string };

export interface ProviderIdentity {
  login: string;
  scope: string | null;
  avatarUrl?: string | null;
  htmlUrl?: string | null;
}

export interface Provider {
  readonly kind: ProviderKind;
  readonly config: ProviderConfig;
  readonly capabilities: ProviderCapabilities;

  startDeviceFlow(): Promise<DeviceFlowStart>;
  pollDeviceFlow(deviceCode: string): Promise<DeviceFlowPoll>;
  fetchIdentity(token: string): Promise<ProviderIdentity>;
  loadFromGhCli?(): Promise<{ token: string } | null>;

  avatarUrl(login: string, size?: number): string;
  webUrlFor(kind: "user" | "repo" | "issue" | "pr", parts: Record<string, string | number>): string;
}
