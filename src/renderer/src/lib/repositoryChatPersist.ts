import type { RepositoryChatMessage, RepositoryChatSaveInput, RepositoryChatStore } from "@shared/schemas";

export const REPOSITORY_CHAT_PERSIST_DEBOUNCE_MS = 1800;

export const repositoryChatStoreSignature = (input: {
  projectPath: string;
  threadId: string | null;
  messages: readonly RepositoryChatMessage[];
  draft: string;
}): string =>
  JSON.stringify({
    projectPath: input.projectPath,
    threadId: input.threadId,
    draft: input.draft,
    messages: input.messages.map((message) => ({ id: message.id, role: message.role, text: message.text }))
  });

export type RepositoryChatPersistSnapshot = {
  projectPath: string;
  threadId: string | null;
  messages: readonly RepositoryChatMessage[];
  draft: string;
};

export type RepositoryChatPersistRuntime = {
  ready: boolean;
  hydratedProjectPath: string | null;
  lastPersistedSignature: string | null;
};

export type RepositoryChatPersistOverrides = Partial<Pick<RepositoryChatStore, "threadId" | "messages" | "draft">>;

export type SaveRepositoryChatMutate = (
  input: RepositoryChatSaveInput,
  options?: { onError?: () => void }
) => void;

export type RepositoryChatPersistController = {
  syncSnapshot: (snapshot: RepositoryChatPersistSnapshot) => void;
  getRuntime: () => RepositoryChatPersistRuntime;
  setRuntime: (patch: Partial<RepositoryChatPersistRuntime>) => void;
  scheduleRepositoryChatPersist: (overrides?: RepositoryChatPersistOverrides) => void;
  flushRepositoryChatPersist: (overrides?: RepositoryChatPersistOverrides) => void;
  cancelScheduledRepositoryChatPersist: () => void;
  dispose: () => void;
};

const resolvePayload = (
  snapshot: RepositoryChatPersistSnapshot,
  overrides?: RepositoryChatPersistOverrides
): RepositoryChatSaveInput => ({
  projectPath: snapshot.projectPath,
  threadId: overrides?.threadId ?? snapshot.threadId,
  messages: overrides?.messages ?? [...snapshot.messages],
  draft: overrides?.draft ?? snapshot.draft
});

export const createRepositoryChatPersist = (options: {
  mutate: SaveRepositoryChatMutate;
  debounceMs?: number;
  schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearSchedule?: (timeoutId: ReturnType<typeof setTimeout>) => void;
}): RepositoryChatPersistController => {
  const debounceMs = options.debounceMs ?? REPOSITORY_CHAT_PERSIST_DEBOUNCE_MS;
  const schedule = options.schedule ?? setTimeout;
  const clearSchedule = options.clearSchedule ?? clearTimeout;
  const snapshotRef: { current: RepositoryChatPersistSnapshot | null } = { current: null };
  const runtimeRef: { current: RepositoryChatPersistRuntime } = {
    current: {
      ready: false,
      hydratedProjectPath: null,
      lastPersistedSignature: null
    }
  };
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let scheduledOverrides: RepositoryChatPersistOverrides | undefined;

  const saveNow = (overrides?: RepositoryChatPersistOverrides): void => {
    const runtime = runtimeRef.current;
    if (!runtime.ready) return;
    const snapshot = snapshotRef.current;
    if (!snapshot || runtime.hydratedProjectPath !== snapshot.projectPath) return;
    const payload = resolvePayload(snapshot, overrides);
    const signature = repositoryChatStoreSignature(payload);
    if (runtime.lastPersistedSignature === signature) return;
    runtime.lastPersistedSignature = signature;
    options.mutate(payload, {
      onError: () => {
        runtime.lastPersistedSignature = null;
      }
    });
  };

  const cancelScheduledRepositoryChatPersist = (): void => {
    if (debounceTimer === null) return;
    clearSchedule(debounceTimer);
    debounceTimer = null;
    scheduledOverrides = undefined;
  };

  return {
    syncSnapshot(snapshot: RepositoryChatPersistSnapshot): void {
      snapshotRef.current = snapshot;
    },
    getRuntime(): RepositoryChatPersistRuntime {
      return runtimeRef.current;
    },
    setRuntime(patch: Partial<RepositoryChatPersistRuntime>): void {
      runtimeRef.current = { ...runtimeRef.current, ...patch };
    },
    scheduleRepositoryChatPersist(overrides?: RepositoryChatPersistOverrides): void {
      scheduledOverrides = overrides;
      cancelScheduledRepositoryChatPersist();
      debounceTimer = schedule(() => {
        debounceTimer = null;
        const pendingOverrides = scheduledOverrides;
        scheduledOverrides = undefined;
        saveNow(pendingOverrides);
      }, debounceMs);
    },
    flushRepositoryChatPersist(overrides?: RepositoryChatPersistOverrides): void {
      cancelScheduledRepositoryChatPersist();
      saveNow(overrides);
    },
    cancelScheduledRepositoryChatPersist,
    dispose(): void {
      cancelScheduledRepositoryChatPersist();
    }
  };
};
