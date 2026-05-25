import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { CursorAgentModel } from "@shared/schemas";
import type {
  AgentProvider,
  CliCommandRunner,
  CliCommandStreamRunner,
  StructuredAgentRequest,
  TextAgentRequest,
  TextAgentResult,
  TextAgentStreamEvent
} from "./index";
import { parseStructuredAgentJsonResponse } from "./index";

const execFileAsync = promisify(execFile);

type CursorCliLane = "interactive" | "implementation";

type CursorCliLaneState = {
  capacity: number;
  active: number;
  readonly waiters: Array<() => void>;
};

const cursorCliLanes = new Map<CursorCliLane, CursorCliLaneState>();

const cursorCliLaneStateFor = (lane: CursorCliLane, capacity: number): CursorCliLaneState => {
  const existing = cursorCliLanes.get(lane);
  if (existing) {
    existing.capacity = Math.max(1, capacity);
    return existing;
  }
  const created: CursorCliLaneState = { capacity: Math.max(1, capacity), active: 0, waiters: [] };
  cursorCliLanes.set(lane, created);
  return created;
};

const withCursorCliLane = async <T>(lane: CursorCliLane, capacity: number, run: () => Promise<T>): Promise<T> => {
  const state = cursorCliLaneStateFor(lane, capacity);
  if (state.active >= state.capacity) {
    await new Promise<void>((resolve) => {
      state.waiters.push(resolve);
    });
  }
  state.active += 1;
  try {
    return await run();
  } finally {
    state.active = Math.max(0, state.active - 1);
    state.waiters.shift()?.();
  }
};

/** Prefer `cursor-agent`, then `agent`. Never use the desktop `cursor` launcher. */
export const CURSOR_AGENT_CLI_CANDIDATES = ["cursor-agent", "agent"] as const;

/** Default model for non-interactive Cursor agent runs (`agent --trust --print --model auto "<prompt>"`). */
export const CURSOR_AGENT_DEFAULT_MODEL = "auto" satisfies CursorAgentModel;

export const CURSOR_AGENT_MODEL_OPTIONS = ["auto"] as const satisfies readonly CursorAgentModel[];

export const cursorAgentModelLabel = (model: CursorAgentModel): string => {
  switch (model) {
    case "auto":
      return "Auto";
    default:
      return model;
  }
};

export const CURSOR_AGENT_OUTPUT_FORMAT_STREAM_JSON = "stream-json";

export const CURSOR_STRUCTURED_JSON_INSTRUCTION =
  "You may include progress updates while working, but your final output must end with exactly one valid JSON object and no markdown fences around that final JSON object.";

export type CursorCliProbeResult = {
  readonly installed: boolean;
  readonly version: string | null;
  readonly failed: boolean;
};

export type CursorCliProbe = (command: string) => Promise<CursorCliProbeResult>;

export const defaultCursorCliProbe: CursorCliProbe = async (command) => {
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

export type ResolvedCursorAgentCli = {
  readonly command: (typeof CURSOR_AGENT_CLI_CANDIDATES)[number] | string;
  readonly version: string | null;
};

export const resolveCursorAgentCli = async (probe: CursorCliProbe = defaultCursorCliProbe): Promise<ResolvedCursorAgentCli | null> => {
  for (const command of CURSOR_AGENT_CLI_CANDIDATES) {
    const result = await probe(command);
    if (result.installed && !result.failed) {
      return { command, version: result.version };
    }
  }
  return null;
};

export type CursorCliStatusProbeResult = {
  readonly authenticated: boolean;
  readonly failed: boolean;
};

export type CursorCliStatusProbe = (command: string) => Promise<CursorCliStatusProbeResult>;

export const parseCursorAgentStatusOutput = (stdout: string, stderr: string): boolean => {
  const combined = `${stdout}\n${stderr}`.toLowerCase();
  if (/not logged in|login required|sign in required|not signed in|unauthenticated|run .* login/.test(combined)) {
    return false;
  }
  return /logged in|✓/.test(combined);
};

export const defaultCursorCliStatusProbe: CursorCliStatusProbe = async (command) => {
  try {
    const { stdout, stderr } = await execFileAsync(command, ["status"], { timeout: 5000 });
    return {
      authenticated: parseCursorAgentStatusOutput(stdout ?? "", stderr ?? ""),
      failed: false
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return { authenticated: false, failed: false };
    }
    const stdout = typeof error === "object" && error !== null && "stdout" in error && typeof error.stdout === "string"
      ? error.stdout
      : "";
    const stderr = typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr
      : "";
    if (stdout || stderr) {
      return {
        authenticated: parseCursorAgentStatusOutput(stdout, stderr),
        failed: false
      };
    }
    return { authenticated: false, failed: true };
  }
};

const resolveCursorAgentModel = (model: CursorAgentModel | undefined): CursorAgentModel => model ?? CURSOR_AGENT_DEFAULT_MODEL;

const cursorAgentBaseArgs = (model: CursorAgentModel | undefined): string[] => [
  "--trust",
  "--print",
  "--model",
  resolveCursorAgentModel(model)
];

const cursorAgentRunArgs = (
  prompt: string,
  options: {
    readonly model?: CursorAgentModel;
    readonly resumeSessionId?: string | null;
    readonly outputFormat?: string | null;
    readonly streamPartialOutput?: boolean;
  } = {}
): string[] => {
  const args = [...cursorAgentBaseArgs(options.model)];
  if (options.outputFormat) {
    args.push("--output-format", options.outputFormat);
  }
  if (options.streamPartialOutput) {
    args.push("--stream-partial-output");
  }
  if (options.resumeSessionId) {
    args.push("--resume", options.resumeSessionId);
  }
  args.push(prompt);
  return args;
};

export const structuredPromptForCursorAgent = (prompt: string): string =>
  `${prompt.trim()}\n\n${CURSOR_STRUCTURED_JSON_INSTRUCTION}`;

const cursorAgentCliNotFoundMessage = (): string =>
  "Cursor agent CLI was not found on PATH. Install `cursor-agent` or `agent`.";

const cursorCliLaneForKind = (kind: string): CursorCliLane => (kind === "ticket.implementation" ? "implementation" : "interactive");

const cursorCliCapacityForRequest = (request: Pick<StructuredAgentRequest | TextAgentRequest, "kind">): number =>
  request.kind === "ticket.implementation" ? 3 : 1;

const defaultRunCommandFor = (lane: CursorCliLane, capacity: number): CliCommandRunner => async (command, args, options) =>
  withCursorCliLane(lane, capacity, async () => {
    const result = await execFileAsync(command, [...args], {
      cwd: options.cwd,
      signal: options.signal,
      maxBuffer: 10 * 1024 * 1024
    });
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? ""
    };
  });

const createAsyncQueue = <T>() => {
  const buffered: T[] = [];
  const waiters: Array<{
    resolve: (value: IteratorResult<T>) => void;
    reject: (error?: unknown) => void;
  }> = [];
  let closed = false;
  let failure: unknown = null;

  const push = (value: T): void => {
    if (closed) return;
    const waiter = waiters.shift();
    if (waiter) {
      waiter.resolve({ value, done: false });
      return;
    }
    buffered.push(value);
  };

  const close = (): void => {
    if (closed) return;
    closed = true;
    while (waiters.length > 0) {
      waiters.shift()?.resolve({ value: undefined, done: true });
    }
  };

  const fail = (error: unknown): void => {
    if (closed) return;
    failure = error;
    closed = true;
    while (waiters.length > 0) {
      waiters.shift()?.reject(error);
    }
  };

  const iterable: AsyncIterable<T> = {
    [Symbol.asyncIterator]() {
      return {
        next: () => {
          if (buffered.length > 0) {
            const value = buffered.shift()!;
            return Promise.resolve({ value, done: false });
          }
          if (failure) return Promise.reject(failure);
          if (closed) return Promise.resolve({ value: undefined, done: true });
          return new Promise<IteratorResult<T>>((resolve, reject) => {
            waiters.push({ resolve, reject });
          });
        }
      };
    }
  };

  return { push, close, fail, iterable };
};

const defaultStreamCommandFor = (lane: CursorCliLane, capacity: number): CliCommandStreamRunner => (command, args, options) => {
  const queue = createAsyncQueue<{ stream: "stdout" | "stderr"; text: string }>();
  let stdout = "";
  let stderr = "";

  const completed = (async (): Promise<{ stdout: string; stderr: string }> => {
    try {
      return await withCursorCliLane(lane, capacity, async () => {
      const child = spawn(command, [...args], {
        cwd: options.cwd,
        signal: options.signal,
        stdio: ["ignore", "pipe", "pipe"]
      });

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");

      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
        queue.push({ stream: "stdout", text: chunk });
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
        queue.push({ stream: "stderr", text: chunk });
      });

      return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        child.on("error", (error) => {
          queue.fail(error);
          reject(error);
        });
        child.on("close", (code, signal) => {
          queue.close();
          if (options.signal?.aborted) {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
            return;
          }
          if (typeof code === "number" && code !== 0) {
            const error = new Error(`Cursor agent CLI exited with code ${code}.`);
            Object.assign(error, { code, signal, stdout, stderr });
            reject(error);
            return;
          }
          resolve({ stdout, stderr });
        });
      });
      });
    } catch (error) {
      queue.fail(error);
      throw error;
    }
  })();

  void completed.catch(() => undefined);

  return {
    chunks: queue.iterable,
    completed
  };
};

const cursorAgentResponseText = (stdout: string, stderr: string): string =>
  stdout.trim() || stderr.trim();

const extractSessionId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const value = record.sessionId ?? record.session_id ?? record.conversationId ?? record.conversation_id ?? record.threadId ?? record.id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const sessionIdFromResponseText = (text: string, fallback: string | null = null): string | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return fallback;
  try {
    return extractSessionId(JSON.parse(trimmed)) ?? fallback;
  } catch {
    return fallback;
  }
};

const parseJsonLines = (value: string): Record<string, unknown>[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const parseJsonLine = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

type CursorAgentEnvelope = {
  readonly type?: unknown;
  readonly subtype?: unknown;
  readonly result?: unknown;
  readonly output?: unknown;
  readonly response?: unknown;
  readonly content?: unknown;
  readonly sessionId?: unknown;
  readonly session_id?: unknown;
};

export class CursorIncompleteResultError extends Error {
  readonly code = "cursor_incomplete_result";

  constructor(message = "Cursor returned progress, but did not include a final structured JSON object.") {
    super(message);
    this.name = "CursorIncompleteResultError";
  }
}

const extractFinalStructuredJsonFromCursorText = <T>(value: string): T => {
  try {
    return parseStructuredAgentJsonResponse(value) as T;
  } catch (error) {
    if (error instanceof Error && error.message.includes("valid JSON")) {
      throw new CursorIncompleteResultError();
    }
    throw error;
  }
};

const structuredOutputFromCursorEnvelope = <T>(payload: CursorAgentEnvelope): { output: T; sessionId: string | null } => {
  const sessionId = extractSessionId(payload);
  const nested = payload.output ?? payload.result ?? payload.response ?? payload.content;
  if (nested && typeof nested === "object") {
    return { output: nested as T, sessionId };
  }
  if (typeof nested === "string" && nested.trim()) {
    return { output: extractFinalStructuredJsonFromCursorText<T>(nested), sessionId };
  }
  throw new CursorIncompleteResultError();
};

const structuredOutputFromText = <T>(text: string): { output: T; sessionId: string | null } => {
  const parsed = parseStructuredAgentJsonResponse(text);
  if (parsed && typeof parsed === "object") {
    const record = parsed as CursorAgentEnvelope;
    if (record.type === "result" || "result" in record || "output" in record || "response" in record || "content" in record) {
      return structuredOutputFromCursorEnvelope<T>(record);
    }
  }
  return { output: parsed as T, sessionId: extractSessionId(parsed) };
};

const cursorEventTextFromContent = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!Array.isArray(value)) return null;
  const parts = value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item.trim()];
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    return [
      typeof record.text === "string" && record.text.trim() ? record.text.trim() : null,
      typeof record.content === "string" && record.content.trim() ? record.content.trim() : null
    ].filter((part): part is string => Boolean(part));
  });
  const joined = parts.join("");
  return joined.trim() ? joined : null;
};

const extractCursorEventText = (event: Record<string, unknown>): string | null => {
  for (const key of ["result", "output", "output_text", "text", "message", "delta"]) {
    const value = event[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const contentText = cursorEventTextFromContent(event.content);
  if (contentText) return contentText;
  const responseText = cursorEventTextFromContent(event.response);
  if (responseText) return responseText;
  return null;
};

const cursorProviderEventType = (event: Record<string, unknown>): string =>
  [event.type, event.event, event.kind, event.subtype]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(".")
    .toLowerCase();

const cursorEventLooksAnswerLike = (event: Record<string, unknown>): boolean => {
  const type = cursorProviderEventType(event);
  return /^(result|assistant)(\.|$)|message\.completed|message\.delta|text\.delta|content\.delta|assistant\.delta/.test(type);
};

const cursorAnswerTextFromEvents = (events: readonly Record<string, unknown>[]): string => {
  const fragments: string[] = [];
  let terminalAnswer: string | null = null;

  for (const event of events) {
    const text = extractCursorEventText(event);
    if (!text) continue;
    const type = cursorProviderEventType(event);
    if (/^(result|assistant)(\.|$)|message\.completed/.test(type)) {
      terminalAnswer = text;
      continue;
    }
    if (!cursorEventLooksAnswerLike(event)) {
      continue;
    }
    if (/message\.delta|text\.delta|content\.delta|assistant\.delta/.test(type)) {
      fragments.push(text);
    }
  }

  if (terminalAnswer) {
    return terminalAnswer;
  }

  return fragments.join("").trim();
};

const cursorTextResultFromRawResponse = (
  rawResponse: string,
  fallbackSessionId: string | null = null
): { text: string; sessionId: string | null } => {
  const lines = rawResponse
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const events = lines.map(parseJsonLine).filter((value): value is Record<string, unknown> => value !== null);
  const text = cursorAnswerTextFromEvents(events);
  if (!text) {
    const fallbackText = lines.join("\n").trim();
    if (!fallbackText) {
      throw new Error("Cursor agent CLI did not return a text response.");
    }
    return {
      text: fallbackText,
      sessionId: extractSessionId(events.find((event) => extractSessionId(event)) ?? null) ?? sessionIdFromResponseText(fallbackText, fallbackSessionId)
    };
  }
  return {
    text,
    sessionId: extractSessionId(events.find((event) => extractSessionId(event)) ?? null) ?? fallbackSessionId
  };
};

export type CursorProviderDependencies = {
  readonly command?: string;
  readonly runCommand?: CliCommandRunner;
  readonly streamCommand?: CliCommandStreamRunner;
  readonly probeCommand?: CursorCliProbe;
};

const sessionRefFor = (sessionId: string | null) =>
  sessionId
    ? {
        providerId: "cursor",
        externalId: sessionId,
        parts: { sessionId }
      }
    : null;

export const createCursorAgentProvider = (dependencies: CursorProviderDependencies = {}): AgentProvider => {
  let resolvedCommand = dependencies.command ?? null;

  const ensureCommand = async (): Promise<string> => {
    if (resolvedCommand) return resolvedCommand;
    const resolved = await resolveCursorAgentCli(dependencies.probeCommand ?? defaultCursorCliProbe);
    if (!resolved) {
      throw new Error(cursorAgentCliNotFoundMessage());
    }
    resolvedCommand = resolved.command;
    return resolvedCommand;
  };

  return {
    providerId: "cursor",
    runStructured: async <T = unknown>(request: StructuredAgentRequest) => {
      const command = await ensureCommand();
      const runCommand = dependencies.runCommand ?? defaultRunCommandFor(cursorCliLaneForKind(request.kind), cursorCliCapacityForRequest(request));
      const runOptions = { cwd: request.projectPath, signal: request.signal };
      const { stdout, stderr } = await runCommand(
        command,
        cursorAgentRunArgs(structuredPromptForCursorAgent(request.prompt), { model: request.agentModel }),
        runOptions
      );
      const text = cursorAgentResponseText(stdout, stderr);
      if (!text) {
        throw new Error("Cursor agent CLI did not return a response.");
      }
      const { output, sessionId } = structuredOutputFromText<T>(text);
      return {
        providerId: "cursor",
        output,
        rawResponse: text,
        providerSessionRef: sessionRefFor(sessionId)
      };
    },
    runTextStream: async (request: TextAgentRequest) => {
      const command = await ensureCommand();
      const streamCommand =
        dependencies.streamCommand ?? defaultStreamCommandFor(cursorCliLaneForKind(request.kind), cursorCliCapacityForRequest(request));
      const streamed = streamCommand(
        command,
        cursorAgentRunArgs(request.prompt, {
          model: request.agentModel,
          resumeSessionId: request.providerSessionRef?.externalId,
          outputFormat: CURSOR_AGENT_OUTPUT_FORMAT_STREAM_JSON,
          streamPartialOutput: true
        }),
        { cwd: request.projectPath, signal: request.signal }
      );
      const events = (async function*(): AsyncIterable<TextAgentStreamEvent> {
        let stdoutBuffer = "";
        let stderrBuffer = "";
        for await (const chunk of streamed.chunks) {
          if (chunk.stream === "stdout") {
            stdoutBuffer += chunk.text;
            let newlineIndex = stdoutBuffer.indexOf("\n");
            while (newlineIndex >= 0) {
              const line = stdoutBuffer.slice(0, newlineIndex).trim();
              stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
              if (line) {
                const parsed = parseJsonLine(line);
                if (parsed) {
                  yield {
                    rawEvent: parsed,
                    providerSessionRef: sessionRefFor(extractSessionId(parsed))
                  };
                } else {
                  yield { rawEvent: { type: "command.output", stdout: line } };
                }
              }
              newlineIndex = stdoutBuffer.indexOf("\n");
            }
            continue;
          }
          stderrBuffer += chunk.text;
          let newlineIndex = stderrBuffer.indexOf("\n");
          while (newlineIndex >= 0) {
            const line = stderrBuffer.slice(0, newlineIndex).trim();
            stderrBuffer = stderrBuffer.slice(newlineIndex + 1);
            if (line) {
              const parsed = parseJsonLine(line);
              if (parsed) {
                yield {
                  rawEvent: parsed,
                  providerSessionRef: sessionRefFor(extractSessionId(parsed))
                };
              } else {
                yield { rawEvent: { type: "command.output", stderr: line } };
              }
            }
            newlineIndex = stderrBuffer.indexOf("\n");
          }
        }

        const trailingStdout = stdoutBuffer.trim();
        if (trailingStdout) {
          const parsed = parseJsonLine(trailingStdout);
          if (parsed) {
            yield {
              rawEvent: parsed,
              providerSessionRef: sessionRefFor(extractSessionId(parsed))
            };
          } else {
            yield { rawEvent: { type: "command.output", stdout: trailingStdout } };
          }
        }
        const trailingStderr = stderrBuffer.trim();
        if (trailingStderr) {
          const parsed = parseJsonLine(trailingStderr);
          if (parsed) {
            yield {
              rawEvent: parsed,
              providerSessionRef: sessionRefFor(extractSessionId(parsed))
            };
          } else {
            yield { rawEvent: { type: "command.output", stderr: trailingStderr } };
          }
        }
      })();

      const completed: Promise<TextAgentResult> = streamed.completed.then(({ stdout, stderr }) => {
        const rawResponse = cursorAgentResponseText(stdout, stderr);
        if (!rawResponse) {
          throw new Error("Cursor agent CLI did not return a text response.");
        }
        const { text, sessionId } = cursorTextResultFromRawResponse(rawResponse, request.providerSessionRef?.externalId ?? null);
        return {
          providerId: "cursor",
          text,
          rawResponse,
          providerSessionRef: sessionRefFor(sessionId)
        };
      });

      return {
        providerId: "cursor",
        events,
        completed
      };
    },
    runText: async (request: TextAgentRequest) => {
      const command = await ensureCommand();
      const runCommand = dependencies.runCommand ?? defaultRunCommandFor(cursorCliLaneForKind(request.kind), cursorCliCapacityForRequest(request));
      const { stdout, stderr } = await runCommand(
        command,
        cursorAgentRunArgs(request.prompt, {
          model: request.agentModel,
          resumeSessionId: request.providerSessionRef?.externalId,
          outputFormat: CURSOR_AGENT_OUTPUT_FORMAT_STREAM_JSON,
          streamPartialOutput: true
        }),
        { cwd: request.projectPath, signal: request.signal }
      );
      const rawResponse = cursorAgentResponseText(stdout, stderr);
      if (!rawResponse) {
        throw new Error("Cursor agent CLI did not return a text response.");
      }
      const { text, sessionId } = cursorTextResultFromRawResponse(rawResponse, request.providerSessionRef?.externalId ?? null);
      return {
        providerId: "cursor",
        text,
        rawResponse,
        providerSessionRef: sessionRefFor(sessionId)
      };
    }
  };
};
