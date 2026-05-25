import { Effect, Path } from "effect";
import { atomicWriteJson, atomicWriteText } from "../../storage/files";
import { runsPath, slashPath } from "../../storage/paths";
import { runBackendEffect } from "../../runtime";
import { logInfo, logWarn } from "../../runtime/Logging";
import type { AgentWorkKind, StructuredAgentResult } from "./index";

export type AgentRunArtifactContext = {
  readonly projectPath: string;
  readonly kind: AgentWorkKind;
  readonly providerId: string;
  readonly ticketId?: string | null;
  readonly runId?: string | null;
  readonly requestId?: string | null;
};

export type AgentRunArtifactPaths = {
  readonly runFolderKey: string;
  readonly fileStem: string;
  readonly rawPath: string;
  readonly outputPath: string;
  readonly metaPath: string;
  readonly relativePaths: {
    readonly raw: string;
    readonly output: string;
    readonly meta: string;
  };
};

const MAX_RAW_BYTES = 5_000_000;

export const resolveAgentRunArtifactPaths = (
  pathService: Path.Path,
  projectPath: string,
  context: AgentRunArtifactContext
): AgentRunArtifactPaths => {
  const folderKey = context.ticketId ?? "_intake";
  const fileStem = context.runId ?? context.requestId ?? "unknown";
  const directory = pathService.join(runsPath(pathService, projectPath), folderKey);
  const rawPath = pathService.join(directory, `${fileStem}-agent-raw.txt`);
  const outputPath = pathService.join(directory, `${fileStem}-agent-output.json`);
  const metaPath = pathService.join(directory, `${fileStem}-agent-meta.json`);
  const relayRoot = pathService.join(pathService.resolve(projectPath), ".relay");
  const toRelayRelative = (absolutePath: string): string => `.relay/${slashPath(pathService.relative(relayRoot, absolutePath))}`;

  return {
    runFolderKey: folderKey,
    fileStem,
    rawPath,
    outputPath,
    metaPath,
    relativePaths: {
      raw: toRelayRelative(rawPath),
      output: toRelayRelative(outputPath),
      meta: toRelayRelative(metaPath)
    }
  };
};

const truncateRawResponse = (rawResponse: string): { text: string; truncated: boolean } => {
  const byteLength = Buffer.byteLength(rawResponse, "utf8");
  if (byteLength <= MAX_RAW_BYTES) {
    return { text: rawResponse, truncated: false };
  }

  let cut = rawResponse.length;
  while (cut > 0 && Buffer.byteLength(rawResponse.slice(0, cut), "utf8") > MAX_RAW_BYTES) {
    cut -= 10_000;
  }

  return {
    text: `${rawResponse.slice(0, cut)}\n\n--- truncated (${byteLength} bytes, cap ${MAX_RAW_BYTES}) ---\n`,
    truncated: true
  };
};

export type PersistAgentStructuredRunOptions = {
  readonly phase?: "success" | "validation_failed";
  readonly validationError?: string;
};

export const persistAgentStructuredRunResponse = async (
  context: AgentRunArtifactContext,
  result: Pick<StructuredAgentResult, "output" | "rawResponse" | "providerId">,
  options: PersistAgentStructuredRunOptions = {}
): Promise<AgentRunArtifactPaths | null> => {
  try {
    const paths = await runBackendEffect(
      Effect.gen(function* () {
        const pathService = yield* Path.Path;
        return resolveAgentRunArtifactPaths(pathService, context.projectPath, context);
      })
    );
    const { text: rawText, truncated } = truncateRawResponse(result.rawResponse);
    const meta = {
      savedAt: new Date().toISOString(),
      kind: context.kind,
      providerId: context.providerId,
      ticketId: context.ticketId ?? null,
      runId: context.runId ?? null,
      requestId: context.requestId ?? null,
      phase: options.phase ?? "success",
      validationError: options.validationError ?? null,
      rawBytes: Buffer.byteLength(result.rawResponse, "utf8"),
      rawTruncated: truncated
    };

    await Promise.all([
      atomicWriteText(paths.rawPath, rawText),
      atomicWriteJson(paths.outputPath, result.output),
      atomicWriteJson(paths.metaPath, meta)
    ]);

    await logInfo("agent:debug", "saved agent structured run artifacts", {
      projectPath: context.projectPath,
      kind: context.kind,
      phase: meta.phase,
      validationError: meta.validationError,
      ...paths.relativePaths
    });

    return paths;
  } catch (error) {
    await logWarn("agent:debug", "failed to save agent structured run artifacts", {
      projectPath: context.projectPath,
      kind: context.kind,
      ticketId: context.ticketId ?? null,
      runId: context.runId ?? null,
      requestId: context.requestId ?? null,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
};
