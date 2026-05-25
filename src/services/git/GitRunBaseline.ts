/**
 * Per-run git change ledger and selective rollback for Codex implementation runs.
 */
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import { GitCli, GitCliLive } from "./GitCli";
import { Git, GitLive } from "./Git";
import { GitMetadataCacheLive } from "./GitMetadataCache";
import { parsePorcelainStatus } from "./GitStatus";
import { verifyGitRepository } from "./GitRepository";
import { commandMessage, type GitError } from "./GitError";
import { runsPath, slashPath } from "../../storage/paths";
import { readRunEvents } from "../run-events";
import { isGitRepository } from "../../storage";
import { BackendPlatformLive } from "../../platform/BackendPlatform";
import { fromPromise, runBackendEffect, BackendServicesBaseLive, type BackendServices } from "../../runtime";

export type RunGitBaselineSkippedPath = {
  readonly path: string;
  readonly reason: string;
};

export type RunGitBaseline = {
  readonly schemaVersion: 2;
  readonly commitSha: string;
  readonly changedPathsAtStart: readonly string[];
  readonly touchedPaths: readonly string[];
  readonly createdPaths: readonly string[];
  readonly skippedPaths: readonly RunGitBaselineSkippedPath[];
  readonly capturedAt: string;
  readonly updatedAt: string;
};

type LegacyRunGitBaseline = {
  readonly schemaVersion: 1;
  readonly commitSha: string;
  readonly changedPathsAtStart: readonly string[];
  readonly capturedAt?: string;
};

type RevertRunGitChangesResult = {
  readonly reverted: boolean;
  readonly message: string;
};

const CHANGE_LOG_SCHEMA_VERSION = 2 as const;
const LEGACY_BASELINE_SCHEMA_VERSION = 1 as const;

const changeLogPath = (pathService: Path.Path, projectPath: string, ticketId: string, runId: string): string =>
  pathService.join(runsPath(pathService, projectPath), ticketId, `${runId}-change-log.json`);

const legacyBaselinePath = (pathService: Path.Path, projectPath: string, ticketId: string, runId: string): string =>
  pathService.join(runsPath(pathService, projectPath), ticketId, `${runId}-git-baseline.json`);

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isSkippedPathArray = (value: unknown): value is RunGitBaselineSkippedPath[] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { path?: unknown }).path === "string" &&
      typeof (entry as { reason?: unknown }).reason === "string"
  );

const readJsonBaseline = (raw: string): RunGitBaseline | null => {
  try {
    const parsed = JSON.parse(raw) as RunGitBaseline | LegacyRunGitBaseline;
    if (parsed.schemaVersion === CHANGE_LOG_SCHEMA_VERSION) {
      if (
        typeof parsed.commitSha !== "string" ||
        !isStringArray(parsed.changedPathsAtStart) ||
        !isStringArray(parsed.touchedPaths) ||
        !isStringArray(parsed.createdPaths) ||
        !isSkippedPathArray(parsed.skippedPaths) ||
        typeof parsed.capturedAt !== "string" ||
        typeof parsed.updatedAt !== "string"
      ) {
        return null;
      }
      return parsed;
    }
    if (parsed.schemaVersion === LEGACY_BASELINE_SCHEMA_VERSION) {
      if (typeof parsed.commitSha !== "string" || !isStringArray(parsed.changedPathsAtStart)) return null;
      const capturedAt = typeof parsed.capturedAt === "string" ? parsed.capturedAt : new Date(0).toISOString();
      return {
        schemaVersion: CHANGE_LOG_SCHEMA_VERSION,
        commitSha: parsed.commitSha,
        changedPathsAtStart: parsed.changedPathsAtStart,
        touchedPaths: [],
        createdPaths: [],
        skippedPaths: [],
        capturedAt,
        updatedAt: capturedAt
      };
    }
    return null;
  } catch {
    return null;
  }
};

const writeBaseline = (
  projectPath: string,
  ticketId: string,
  runId: string,
  baseline: RunGitBaseline
): Effect.Effect<void, unknown, GitRunnerServices> =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const target = changeLogPath(pathService, projectPath, ticketId, runId);
    yield* fs.makeDirectory(pathService.dirname(target), { recursive: true });
    yield* fs.writeFileString(target, `${JSON.stringify(baseline, null, 2)}\n`);
  });

const readBaselineEffect = (
  projectPath: string,
  ticketId: string,
  runId: string
): Effect.Effect<RunGitBaseline | null, unknown, GitRunnerServices> =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const primary = changeLogPath(pathService, projectPath, ticketId, runId);
    const legacy = legacyBaselinePath(pathService, projectPath, ticketId, runId);
    const primaryRaw = yield* fs.readFileString(primary).pipe(Effect.catch(() => Effect.succeed(null)));
    const raw = primaryRaw ?? (yield* fs.readFileString(legacy).pipe(Effect.catch(() => Effect.succeed(null))));
    if (!raw) return null;
    return readJsonBaseline(raw);
  });

const captureBaselineEffect = (
  projectPath: string,
  ticketId: string,
  runId: string,
  capturedAt: string,
  gitProjectPath: string
): Effect.Effect<RunGitBaseline | null, unknown, GitRunnerServices> =>
  Effect.gen(function*() {
    const isGit = yield* fromPromise(() => isGitRepository(gitProjectPath));
    if (!isGit) return null;

    yield* verifyGitRepository(gitProjectPath);
    const head = yield* GitCli.use((git) => git.exec(gitProjectPath, ["rev-parse", "HEAD"]));
    const commitSha = head.stdout.trim();
    if (!commitSha) return null;

    const statusResult = yield* GitCli.use((git) =>
      git.exec(gitProjectPath, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])
    );
    const status = parsePorcelainStatus(statusResult.stdout);
    const baseline: RunGitBaseline = {
      schemaVersion: CHANGE_LOG_SCHEMA_VERSION,
      commitSha,
      changedPathsAtStart: status.changedFiles.map((entry) => entry.path),
      touchedPaths: [],
      createdPaths: [],
      skippedPaths: [],
      capturedAt,
      updatedAt: capturedAt
    };

    yield* writeBaseline(projectPath, ticketId, runId, baseline);
    return baseline;
  }).pipe(Effect.catch(() => Effect.succeed(null)));

const isPathInsideDirectory = (pathService: Path.Path, directory: string, target: string): boolean => {
  const relative = pathService.relative(directory, target);
  return relative === "" || (!relative.startsWith("..") && !pathService.isAbsolute(relative));
};

const normalizeLoggedPath = (pathValue: string): string | null => {
  const trimmed = slashPath(pathValue.trim());
  if (!trimmed || trimmed === "." || trimmed.includes("\0")) return null;
  return trimmed;
};

const trackedAtHead = (projectPath: string, relativePath: string): Effect.Effect<boolean, unknown, GitRunnerServices> =>
  GitCli.use((git) => git.exec(projectPath, ["ls-tree", "-r", "--name-only", "HEAD", "--", relativePath])).pipe(
    Effect.map((result) => result.stdout.trim().length > 0),
    Effect.catch(() => Effect.succeed(false))
  );

const restoreTrackedPath = (projectPath: string, relativePath: string): Effect.Effect<void, unknown, GitRunnerServices> =>
  GitCli.use((git) => git.exec(projectPath, ["restore", "--source=HEAD", "--", relativePath])).pipe(
    Effect.asVoid,
    Effect.catch(() => Effect.void)
  );

const deleteCreatedPath = (absolutePath: string): Effect.Effect<void, unknown, GitRunnerServices> =>
  FileSystem.FileSystem.use((fs) => fs.remove(absolutePath, { recursive: true, force: true })).pipe(Effect.catch(() => Effect.void));

const summarizeResult = (restored: number, deleted: number, skipped: number): string => {
  const parts = [
    `${restored} tracked file(s) restored`,
    `${deleted} new file(s) deleted`,
    `${skipped} path(s) skipped`
  ];
  const prefix = skipped > 0 ? "Reverted run file changes with warnings" : "Reverted run file changes";
  return `${prefix}: ${parts.join(", ")}.`;
};

const revertBaselineEffect = (
  projectPath: string,
  ticketId: string,
  runId: string,
  gitProjectPath: string
): Effect.Effect<RevertRunGitChangesResult, unknown, GitRunnerServices> =>
  Effect.gen(function*() {
    const baseline = yield* readBaselineEffect(projectPath, ticketId, runId);
    if (!baseline) {
      return { reverted: false, message: "No run change log was recorded for this run." };
    }

    yield* verifyGitRepository(gitProjectPath);

    const pathService = yield* Path.Path;
    const projectRoot = pathService.resolve(gitProjectPath);
    const baselineDirty = new Set(baseline.changedPathsAtStart.map(slashPath));
    const events = yield* fromPromise(() => readRunEvents(projectPath, ticketId, runId));

    const touchedPaths = new Set<string>();
    const createdPaths = new Set<string>();
    const skippedByPath = new Map<string, string>();
    const restoreCandidates = new Set<string>();
    const deleteCandidates = new Set<string>();

    for (const event of events) {
      if (event.type !== "file.change") continue;
      const normalizedPath = normalizeLoggedPath(event.path);
      if (!normalizedPath) {
        skippedByPath.set(event.path, "Logged path was empty or invalid.");
        continue;
      }

      const absolutePath = pathService.resolve(projectRoot, normalizedPath);
      if (!isPathInsideDirectory(pathService, projectRoot, absolutePath)) {
        skippedByPath.set(normalizedPath, "Path is outside the project root.");
        continue;
      }

      touchedPaths.add(normalizedPath);

      if (baselineDirty.has(normalizedPath)) {
        skippedByPath.set(normalizedPath, "Path was already dirty when the run started.");
        continue;
      }

      const kind = typeof event.kind === "string" ? event.kind.trim().toLowerCase() : "";
      const existsAtHead = yield* trackedAtHead(gitProjectPath, normalizedPath);

      if (existsAtHead) {
        restoreCandidates.add(normalizedPath);
        continue;
      }

      if (!kind) {
        skippedByPath.set(normalizedPath, "Older run log did not record file-change kind for a non-HEAD path.");
        continue;
      }

      createdPaths.add(normalizedPath);
      deleteCandidates.add(normalizedPath);
    }

    let restored = 0;
    for (const relativePath of restoreCandidates) {
      yield* restoreTrackedPath(gitProjectPath, relativePath);
      restored += 1;
    }

    let deleted = 0;
    for (const relativePath of deleteCandidates) {
      const absolutePath = pathService.resolve(projectRoot, relativePath);
      yield* deleteCreatedPath(absolutePath);
      deleted += 1;
    }

    const nextBaseline: RunGitBaseline = {
      ...baseline,
      touchedPaths: [...touchedPaths].sort(),
      createdPaths: [...createdPaths].sort(),
      skippedPaths: [...skippedByPath.entries()]
        .map(([path, reason]) => ({ path, reason }))
        .sort((left, right) => left.path.localeCompare(right.path)),
      updatedAt: new Date().toISOString()
    };
    yield* writeBaseline(projectPath, ticketId, runId, nextBaseline);

    return {
      reverted: restored > 0 || deleted > 0,
      message: summarizeResult(restored, deleted, skippedByPath.size)
    };
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed({
        reverted: false,
        message: commandMessage(error as GitError)
      })
    )
  );

type GitRunnerServices =
  | BackendServices
  | Context.Service.Identifier<typeof Git>
  | Context.Service.Identifier<typeof GitCli>;

const GitRunBaselineLive = Layer.mergeAll(GitLive, GitCliLive, GitMetadataCacheLive);

const runGitBaselineEffect = <A, E>(effect: Effect.Effect<A, E, GitRunnerServices>): Promise<A> =>
  runBackendEffect(
    Effect.provide(effect, GitRunBaselineLive.pipe(Layer.provideMerge(BackendServicesBaseLive), Layer.provideMerge(BackendPlatformLive)))
  );

export const captureRunGitBaseline = (
  projectPath: string,
  ticketId: string,
  runId: string,
  capturedAt = new Date().toISOString(),
  gitProjectPath = projectPath
): Promise<RunGitBaseline | null> =>
  runGitBaselineEffect(captureBaselineEffect(projectPath, ticketId, runId, capturedAt, gitProjectPath));

export const readRunGitBaseline = (
  projectPath: string,
  ticketId: string,
  runId: string
): Promise<RunGitBaseline | null> => runGitBaselineEffect(readBaselineEffect(projectPath, ticketId, runId));

export const revertRunGitChanges = (
  projectPath: string,
  ticketId: string,
  runId: string,
  gitProjectPath = projectPath
): Promise<RevertRunGitChangesResult> =>
  runGitBaselineEffect(revertBaselineEffect(projectPath, ticketId, runId, gitProjectPath));
