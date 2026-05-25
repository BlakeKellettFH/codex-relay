import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import nodePath from "node:path";
import { promisify } from "node:util";
import { Effect } from "effect";
import type {
  AgentProviderAuthState,
  AgentProviderId,
  AgentProviderInventory,
  AgentProviderRecord,
  AgentProviderStatus,
  AgentProviderSwitchInput,
  AgentProviderSwitchResult,
  AppRegistry,
  CodexStatus,
  ProviderSwitchErrorCode
} from "@shared/schemas";
import { ElectronApp } from "../../platform";
import { runBackendEffect } from "../../runtime";
import {
  CURSOR_AGENT_CLI_CANDIDATES,
  defaultCursorCliProbe,
  defaultCursorCliStatusProbe,
  resolveCursorAgentCli,
  type CursorCliProbe,
  type CursorCliStatusProbe
} from "../agents/cursorProvider";
import { getCodexStatus } from "../codex";
import type { WorkRunSnapshot, WorkStatus } from "../work/domain";
import { WorkLedger, WorkLedgerLive } from "../work/ledger";
import { readRegistry, writeRegistry } from "./store";

const execFileAsync = promisify(execFile);
const defaultSelectedProviderId = "codex" as const;
const providerLabels: Record<AgentProviderId, string> = {
  codex: "Codex",
  cursor: "Cursor",
  claude: "Claude"
};
const blockingProviderSwitchStatuses = new Set<WorkStatus>(["created", "queued", "running", "cancelling", "stale"]);

type ProviderCommandProbe = {
  readonly installed: boolean;
  readonly version: string | null;
  readonly failed: boolean;
};

export type ProviderManagementDependencies = {
  readonly getCodexStatus?: () => Promise<CodexStatus>;
  readonly probeCommand?: (command: string) => Promise<ProviderCommandProbe>;
  readonly probeCursorStatus?: CursorCliStatusProbe;
  readonly readEnv?: () => Promise<Record<string, string | undefined>>;
  readonly readHomeDirectory?: () => Promise<string>;
  readonly fileExists?: (target: string) => Promise<boolean>;
  readonly readRegistry?: () => Promise<AppRegistry>;
  readonly writeRegistry?: (registry: AppRegistry) => Promise<void>;
  readonly listIncompleteWork?: (projectPath: string) => Promise<WorkRunSnapshot[]>;
};

type ProviderProbeResult = Pick<
  AgentProviderRecord,
  "id" | "label" | "installState" | "authState" | "status" | "message" | "version"
>;

const probeCommand = async (command: string): Promise<ProviderCommandProbe> => {
  try {
    const { stdout, stderr } = await execFileAsync(command, ["--version"], { timeout: 1500 });
    const version = `${stdout ?? ""}\n${stderr ?? ""}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? null;
    return {
      installed: true,
      version,
      failed: false
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return { installed: false, version: null, failed: false };
    }
    return { installed: false, version: null, failed: true };
  }
};

const readElectronEnv = (): Promise<Record<string, string | undefined>> =>
  runBackendEffect(ElectronApp.use((electronApp) => electronApp.env));

const readElectronHomeDirectory = (): Promise<string> =>
  runBackendEffect(ElectronApp.use((electronApp) => electronApp.homeDirectory));

const fileExists = async (target: string): Promise<boolean> => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

const listIncompleteWorkForProject = (projectPath: string): Promise<WorkRunSnapshot[]> =>
  runBackendEffect(Effect.provide(WorkLedger.use((ledger) => ledger.listIncomplete(projectPath)), WorkLedgerLive));

const providerStatusFrom = (installState: AgentProviderRecord["installState"], authState: AgentProviderAuthState): AgentProviderStatus => {
  if (installState === "unknown") return "unknown";
  if (installState !== "installed") return "unavailable";
  if (authState === "unknown") return "unknown";
  if (authState === "authenticated") return "ready";
  return "unauthenticated";
};

const providerMessageFrom = (
  label: string,
  installState: AgentProviderRecord["installState"],
  authState: AgentProviderAuthState,
  status: AgentProviderStatus,
  fallback: string | null = null
): string => {
  if (fallback) return fallback;
  if (status === "unavailable") return `${label} is not installed.`;
  if (status === "unauthenticated") return `${label} is installed, but the agent CLI is not logged in. Run \`cursor-agent login\` or \`agent login\`.`;
  if (status === "unknown") return `${label} status could not be determined.`;
  if (installState === "installed" && authState === "authenticated") return `${label} is available.`;
  return `${label} status could not be determined.`;
};

const probeCursorProvider = async (dependencies: ProviderManagementDependencies): Promise<ProviderProbeResult> => {
  const label = providerLabels.cursor;
  const runProbe: CursorCliProbe = dependencies.probeCommand ?? defaultCursorCliProbe;
  const resolved = await resolveCursorAgentCli(runProbe);

  if (!resolved) {
    return {
      id: "cursor",
      label,
      installState: "not_installed",
      authState: "unknown",
      status: "unavailable",
      message: `${label} agent CLI was not found on PATH (tried ${CURSOR_AGENT_CLI_CANDIDATES.join(", ")}).`,
      version: null
    };
  }

  const runStatusProbe = dependencies.probeCursorStatus ?? defaultCursorCliStatusProbe;
  const statusResult = await runStatusProbe(resolved.command);

  if (statusResult.failed) {
    return {
      id: "cursor",
      label,
      installState: "installed",
      authState: "unknown",
      status: "unknown",
      message: `${label} login status could not be determined.`,
      version: resolved.version
    };
  }

  const authState: AgentProviderAuthState = statusResult.authenticated ? "authenticated" : "unauthenticated";
  const status = providerStatusFrom("installed", authState);
  return {
    id: "cursor",
    label,
    installState: "installed",
    authState,
    status,
    message: providerMessageFrom(label, "installed", authState, status),
    version: resolved.version
  };
};

const probeFileOrEnvProvider = async (
  providerId: Exclude<AgentProviderId, "codex">,
  command: string,
  resolvedVersion: string | null,
  authEnvKeys: readonly string[],
  authFileCandidates: readonly string[],
  dependencies: ProviderManagementDependencies
): Promise<ProviderProbeResult> => {
  const label = providerLabels[providerId];
  const runProbe = dependencies.probeCommand ?? probeCommand;
  const readEnv = dependencies.readEnv ?? readElectronEnv;
  const readHomeDirectory = dependencies.readHomeDirectory ?? readElectronHomeDirectory;
  const exists = dependencies.fileExists ?? fileExists;
  const commandProbe =
    resolvedVersion === null
      ? await runProbe(command)
      : { installed: true, version: resolvedVersion, failed: false };

  if (commandProbe.failed) {
    return {
      id: providerId,
      label,
      installState: "unknown",
      authState: "unknown",
      status: "unknown",
      message: `${label} status check failed.`,
      version: null
    };
  }

  if (!commandProbe.installed) {
    return {
      id: providerId,
      label,
      installState: "not_installed",
      authState: "unknown",
      status: "unavailable",
      message: `${label} CLI was not found on PATH.`,
      version: null
    };
  }

  try {
    const [env, homeDirectory] = await Promise.all([readEnv(), readHomeDirectory()]);
    const authenticatedFromEnv = authEnvKeys.some((key) => Boolean(env[key]));
    const authenticatedFromFile = authenticatedFromEnv
      ? false
      : await Promise.any(
        authFileCandidates.map(async (target) =>
          await exists(nodePath.join(homeDirectory, target)) ? true : Promise.reject(new Error("missing"))
        )
      ).catch(() => false);
    const authState: AgentProviderAuthState = authenticatedFromEnv || authenticatedFromFile ? "authenticated" : "unauthenticated";
    const status = providerStatusFrom("installed", authState);
    return {
      id: providerId,
      label,
      installState: "installed",
      authState,
      status,
      message: providerMessageFrom(label, "installed", authState, status),
      version: commandProbe.version
    };
  } catch {
    return {
      id: providerId,
      label,
      installState: "installed",
      authState: "unknown",
      status: "unknown",
      message: `${label} status check failed.`,
      version: commandProbe.version
    };
  }
};

const probeCodexProvider = async (dependencies: ProviderManagementDependencies): Promise<ProviderProbeResult> => {
  const codexStatus = await (dependencies.getCodexStatus ?? getCodexStatus)();
  const installState: AgentProviderRecord["installState"] = codexStatus.cliAvailable ? "installed" : "not_installed";
  const authState: AgentProviderAuthState = codexStatus.authenticated === null
    ? "unknown"
    : codexStatus.authenticated
      ? "authenticated"
      : "unauthenticated";
  const status = providerStatusFrom(installState, authState);
  return {
    id: "codex",
    label: providerLabels.codex,
    installState,
    authState,
    status,
    message: providerMessageFrom(providerLabels.codex, installState, authState, status, codexStatus.message),
    version: codexStatus.cliVersion
  };
};

const readBlockingProviderSwitchWork = async (
  registry: AppRegistry,
  dependencies: ProviderManagementDependencies
): Promise<WorkRunSnapshot[]> => {
  const listIncompleteWork = dependencies.listIncompleteWork ?? listIncompleteWorkForProject;
  const work = await Promise.all(registry.projects.map((project) => listIncompleteWork(project.path)));
  return work.flat().filter((snapshot) => blockingProviderSwitchStatuses.has(snapshot.status));
};

const switchabilityFromBlockingWork = (blockingWork: readonly WorkRunSnapshot[]): AgentProviderInventory["switchability"] => {
  if (blockingWork.length === 0) {
    return {
      canSwitch: true,
      reasonCode: null,
      message: null,
      blockingWorkCount: 0
    };
  }
  const projectCount = new Set(blockingWork.map((snapshot) => snapshot.projectPath)).size;
  return {
    canSwitch: false,
    reasonCode: "busy",
    message: `Relay cannot switch providers while ${blockingWork.length} active work item(s) exist across ${projectCount} registered project(s).`,
    blockingWorkCount: blockingWork.length
  };
};

const targetBlockFor = (
  provider: ProviderProbeResult,
  switchability: AgentProviderInventory["switchability"]
): { readonly code: ProviderSwitchErrorCode; readonly message: string } | null => {
  if (provider.status === "unavailable") {
    return { code: "provider_unavailable", message: provider.message };
  }
  if (provider.status === "unauthenticated") {
    return { code: "provider_unauthenticated", message: provider.message };
  }
  if (provider.status === "unknown") {
    return { code: "provider_status_unknown", message: provider.message };
  }
  if (!switchability.canSwitch) {
    return { code: "busy", message: switchability.message ?? "Relay cannot switch providers right now." };
  }
  return null;
};

const withSwitchability = (
  provider: ProviderProbeResult,
  selectedProviderId: AgentProviderId,
  switchability: AgentProviderInventory["switchability"]
): AgentProviderRecord => {
  if (provider.id === selectedProviderId) {
    return {
      ...provider,
      canSelect: true,
      blockedReasonCode: null,
      blockedReasonMessage: null
    };
  }
  const block = targetBlockFor(provider, switchability);
  return {
    ...provider,
    canSelect: block === null,
    blockedReasonCode: block?.code ?? null,
    blockedReasonMessage: block?.message ?? null
  };
};

const buildAgentProviderInventory = async (
  registry: AppRegistry,
  dependencies: ProviderManagementDependencies = {}
): Promise<AgentProviderInventory> => {
  const selectedProviderId = registry.selectedProviderId ?? defaultSelectedProviderId;
  const [providers, blockingWork] = await Promise.all([
    Promise.all([
      probeCodexProvider(dependencies),
      probeCursorProvider(dependencies),
      probeFileOrEnvProvider(
        "claude",
        "claude",
        null,
        ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"],
        [".claude/auth.json", ".config/claude/auth.json", ".config/claude-code/auth.json"],
        dependencies
      )
    ]),
    readBlockingProviderSwitchWork(registry, dependencies)
  ]);
  const switchability = switchabilityFromBlockingWork(blockingWork);
  return {
    providers: providers.map((provider) => withSwitchability(provider, selectedProviderId, switchability)),
    selectedProviderId,
    switchability
  };
};

export const readAgentProviderInventory = async (dependencies: ProviderManagementDependencies = {}): Promise<AgentProviderInventory> => {
  const registry = await (dependencies.readRegistry ?? readRegistry)();
  return buildAgentProviderInventory(registry, dependencies);
};

export const switchAgentProviderSelection = async (
  input: AgentProviderSwitchInput,
  dependencies: ProviderManagementDependencies = {}
): Promise<AgentProviderSwitchResult> => {
  const readRegistryImpl = dependencies.readRegistry ?? readRegistry;
  const writeRegistryImpl = dependencies.writeRegistry ?? writeRegistry;
  const currentRegistry = await readRegistryImpl();
  const currentSelectedProviderId = currentRegistry.selectedProviderId ?? defaultSelectedProviderId;

  if (input.providerId === currentSelectedProviderId) {
    const inventory = await buildAgentProviderInventory(
      { ...currentRegistry, selectedProviderId: currentSelectedProviderId },
      dependencies
    );
    return {
      ok: true,
      selectedProviderId: currentSelectedProviderId,
      inventory
    };
  }

  const inventory = await buildAgentProviderInventory(
    { ...currentRegistry, selectedProviderId: currentSelectedProviderId },
    dependencies
  );
  const target = inventory.providers.find((provider) => provider.id === input.providerId);
  const failure = target ? targetBlockFor(target, inventory.switchability) : null;
  if (failure) {
    return {
      ok: false,
      code: failure.code,
      message: failure.message,
      selectedProviderId: currentSelectedProviderId
    };
  }

  const nextRegistry: AppRegistry = {
    ...currentRegistry,
    selectedProviderId: input.providerId
  };
  await writeRegistryImpl(nextRegistry);
  return {
    ok: true,
    selectedProviderId: input.providerId,
    inventory: await buildAgentProviderInventory(nextRegistry, dependencies)
  };
};
