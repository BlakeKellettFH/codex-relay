import type { AgentProviderId, AppRegistry } from "@shared/schemas";
import { readRegistry } from "../registry";
import type { ProviderSessionRef } from "../work";
import type { AgentProvider } from "./index";

const PROVIDER_SESSION_DELIMITER = "::";

const selectedProviderIdFromRegistry = async (): Promise<AgentProviderId> => {
  const registry = await readRegistry();
  return (registry.selectedProviderId ?? "codex") as AgentProviderId;
};

export type AgentProviderResolverDependencies = {
  readonly agentProvider?: AgentProvider;
  readonly selectedProviderId?: AgentProviderId;
  readonly readSelectedProviderId?: () => Promise<AgentProviderId>;
  readonly createAgentProvider?: (providerId: AgentProviderId) => AgentProvider | Promise<AgentProvider>;
  readonly readRegistry?: () => Promise<AppRegistry>;
};

export const resolveSelectedAgentProviderId = async (
  dependencies: Pick<AgentProviderResolverDependencies, "selectedProviderId" | "readSelectedProviderId" | "readRegistry"> = {}
): Promise<AgentProviderId> => {
  if (dependencies.selectedProviderId) return dependencies.selectedProviderId;
  if (dependencies.readSelectedProviderId) return dependencies.readSelectedProviderId();
  if (dependencies.readRegistry) {
    const registry = await dependencies.readRegistry();
    return (registry.selectedProviderId ?? "codex") as AgentProviderId;
  }
  return selectedProviderIdFromRegistry();
};

export const resolveAgentProviderForNewWork = async (
  dependencies: AgentProviderResolverDependencies
): Promise<AgentProvider> => {
  if (dependencies.agentProvider) return dependencies.agentProvider;
  const providerId = await resolveSelectedAgentProviderId(dependencies);
  if (!dependencies.createAgentProvider) {
    throw new Error(`No agent provider factory is configured for provider "${providerId}".`);
  }
  return dependencies.createAgentProvider(providerId);
};

export const encodeProviderSessionRef = (sessionRef: ProviderSessionRef): string =>
  `${sessionRef.providerId}${PROVIDER_SESSION_DELIMITER}${sessionRef.externalId}`;

export const decodeProviderSessionId = (value: string | null | undefined): ProviderSessionRef | null => {
  const normalized = value?.trim();
  if (!normalized) return null;

  const delimiterIndex = normalized.indexOf(PROVIDER_SESSION_DELIMITER);
  if (delimiterIndex > 0) {
    const providerId = normalized.slice(0, delimiterIndex);
    const externalId = normalized.slice(delimiterIndex + PROVIDER_SESSION_DELIMITER.length);
    if (!externalId) return null;
    return {
      providerId,
      externalId
    };
  }

  if (/^thread[_-]/.test(normalized)) {
    return {
      providerId: "codex",
      externalId: normalized,
      parts: { threadId: normalized }
    };
  }

  return null;
};

