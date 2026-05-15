import { getProviderConfig } from "../accountStore";
import { GitHubProvider } from "./github";
import type { Account, Provider, ProviderConfig } from "./types";

const cache = new Map<string, Provider>();

function build(config: ProviderConfig): Provider {
  switch (config.kind) {
    case "github":
      return new GitHubProvider(config);
    case "forgejo":
      // Forgejo provider lands in PR5. Treat unknown as GitHub-compatible
      // for the configurable bits but only the github.com config flows through
      // this branch today.
      throw new Error(`Provider kind 'forgejo' not yet implemented (configId=${config.id})`);
  }
}

export async function getProvider(providerConfigId: string): Promise<Provider> {
  const cached = cache.get(providerConfigId);
  if (cached) return cached;
  const config = await getProviderConfig(providerConfigId);
  if (!config) throw new Error(`Unknown provider config: ${providerConfigId}`);
  const provider = build(config);
  cache.set(providerConfigId, provider);
  return provider;
}

export async function getProviderForAccount(account: Account): Promise<Provider> {
  return getProvider(account.providerConfigId);
}

export function resetProviderCache(): void {
  cache.clear();
}
