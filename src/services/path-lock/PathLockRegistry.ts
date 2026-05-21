import { Effect, FileSystem, Path } from "effect";
import { normalizeRepoPathList } from "@shared/pathScope";
import { RELAY_SCHEMA_VERSION } from "@shared/schemas";
import { runBackendEffect } from "../../runtime";
import { logInfo, logWarn } from "../../runtime/Logging";
import { pathLocksPath } from "../../storage/paths";
import { atomicWriteJson } from "../../storage/files";
import { readTicket } from "../../storage";

export type PathLockRecord = {
  readonly path: string;
  readonly ticketId: string;
  readonly runId: string;
  readonly acquiredAt: string;
};

export type PathLockConflict = {
  readonly path: string;
  readonly holderTicketId: string;
  readonly holderRunId: string;
};

type PathLockStore = {
  readonly schemaVersion: typeof RELAY_SCHEMA_VERSION;
  readonly locks: PathLockRecord[];
};

const emptyStore = (): PathLockStore => ({ schemaVersion: RELAY_SCHEMA_VERSION, locks: [] });

const backendPath = (): Promise<Path.Path> => runBackendEffect(Path.Path.use((path) => Effect.succeed(path)));

const resolveProjectPath = async (projectPathInput: string): Promise<string> => {
  const path = await backendPath();
  return path.resolve(projectPathInput);
};

const readStore = async (projectPath: string): Promise<PathLockStore> => {
  const path = await backendPath();
  const target = pathLocksPath(path, projectPath);
  const raw = await runBackendEffect(
    FileSystem.FileSystem.use((fs) =>
      fs.readFileString(target, "utf8").pipe(
        Effect.catch(() => Effect.succeed(null as string | null))
      )
    )
  );
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as PathLockStore;
    if (!Array.isArray(parsed.locks)) return emptyStore();
    return {
      schemaVersion: RELAY_SCHEMA_VERSION,
      locks: parsed.locks.filter(
        (lock): lock is PathLockRecord =>
          typeof lock.path === "string" &&
          typeof lock.ticketId === "string" &&
          typeof lock.runId === "string" &&
          typeof lock.acquiredAt === "string"
      )
    };
  } catch {
    return emptyStore();
  }
};

const writeStore = async (projectPath: string, store: PathLockStore): Promise<void> => {
  const path = await backendPath();
  await atomicWriteJson(pathLocksPath(path, projectPath), store);
};

const lockKey = (ticketId: string, runId: string, filePath: string): string => `${ticketId}:${runId}:${filePath}`;

const normalizePaths = (projectPath: string, paths: readonly string[]): string[] =>
  normalizeRepoPathList(paths, projectPath);

export const pathLockConflictsFor = async (
  projectPathInput: string,
  ticketId: string,
  paths: readonly string[]
): Promise<readonly PathLockConflict[]> => {
  const projectPath = await resolveProjectPath(projectPathInput);
  const normalized = normalizePaths(projectPath, paths);
  if (normalized.length === 0) return [];

  const store = await readStore(projectPath);
  const conflicts: PathLockConflict[] = [];
  for (const filePath of normalized) {
    const holder = store.locks.find((lock) => lock.path === filePath && lock.ticketId !== ticketId);
    if (holder) {
      conflicts.push({ path: filePath, holderTicketId: holder.ticketId, holderRunId: holder.runId });
    }
  }
  return conflicts;
};

export type PathLockAcquireResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly conflicts: readonly PathLockConflict[] };

export const tryAcquirePathLocks = async (
  projectPathInput: string,
  ticketId: string,
  runId: string,
  paths: readonly string[]
): Promise<PathLockAcquireResult> => {
  const projectPath = await resolveProjectPath(projectPathInput);
  const normalized = normalizePaths(projectPath, paths);
  if (normalized.length === 0) return { ok: true };

  const conflicts = await pathLockConflictsFor(projectPath, ticketId, normalized);
  if (conflicts.length > 0) return { ok: false, conflicts };

  const store = await readStore(projectPath);
  const acquiredAt = new Date().toISOString();
  const existingKeys = new Set(store.locks.map((lock) => lockKey(lock.ticketId, lock.runId, lock.path)));
  const nextLocks = [...store.locks];
  for (const filePath of normalized) {
    const key = lockKey(ticketId, runId, filePath);
    if (existingKeys.has(key)) continue;
    nextLocks.push({ path: filePath, ticketId, runId, acquiredAt });
    existingKeys.add(key);
  }

  await writeStore(projectPath, { schemaVersion: RELAY_SCHEMA_VERSION, locks: nextLocks });
  return { ok: true };
};

export const releasePathLocksForRun = async (
  projectPathInput: string,
  ticketId: string,
  runId: string
): Promise<void> => {
  const projectPath = await resolveProjectPath(projectPathInput);
  const store = await readStore(projectPath);
  const nextLocks = store.locks.filter((lock) => !(lock.ticketId === ticketId && lock.runId === runId));
  if (nextLocks.length === store.locks.length) return;
  await writeStore(projectPath, { schemaVersion: RELAY_SCHEMA_VERSION, locks: nextLocks });
};

export const releasePathLocksForTicket = async (projectPathInput: string, ticketId: string): Promise<void> => {
  const projectPath = await resolveProjectPath(projectPathInput);
  const store = await readStore(projectPath);
  const nextLocks = store.locks.filter((lock) => lock.ticketId !== ticketId);
  if (nextLocks.length === store.locks.length) return;
  await writeStore(projectPath, { schemaVersion: RELAY_SCHEMA_VERSION, locks: nextLocks });
};

export const recoverStalePathLocks = async (projectPathInput: string): Promise<number> => {
  const projectPath = await resolveProjectPath(projectPathInput);
  const store = await readStore(projectPath);
  if (store.locks.length === 0) return 0;

  const kept: PathLockRecord[] = [];
  let removed = 0;
  for (const lock of store.locks) {
    try {
      const ticket = await readTicket(projectPath, lock.ticketId);
      const activeRun =
        ticket.frontMatter.lastRunId === lock.runId &&
        (ticket.frontMatter.runStatus === "running" || ticket.frontMatter.runStatus === "queued");
      if (activeRun) {
        kept.push(lock);
      } else {
        removed += 1;
      }
    } catch {
      removed += 1;
    }
  }

  if (removed > 0) {
    await writeStore(projectPath, { schemaVersion: RELAY_SCHEMA_VERSION, locks: kept });
    await logInfo("path-lock", "recovered stale path locks", { projectPath, removed, kept: kept.length });
  }
  return removed;
};

export const recoverStalePathLocksForAllProjects = async (projectPaths: readonly string[]): Promise<void> => {
  for (const projectPath of projectPaths) {
    try {
      await recoverStalePathLocks(projectPath);
    } catch (error) {
      await logWarn("path-lock", "failed to recover stale path locks", {
        projectPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
};

export const listPathLocks = async (projectPathInput: string): Promise<readonly PathLockRecord[]> => {
  const projectPath = await resolveProjectPath(projectPathInput);
  return (await readStore(projectPath)).locks;
};
