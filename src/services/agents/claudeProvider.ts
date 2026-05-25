import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AgentProvider, CliCommandRunner, StructuredAgentRequest, TextAgentRequest } from "./index";
import { parseStructuredAgentJsonResponse } from "./index";

const execFileAsync = promisify(execFile);

const defaultRunCommand: CliCommandRunner = async (command, args, options) => {
  const result = await execFileAsync(command, [...args], {
    cwd: options.cwd,
    signal: options.signal,
    maxBuffer: 10 * 1024 * 1024
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
};

const parseJsonLines = (value: string): Record<string, unknown>[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const stringValue = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

const extractSessionId = (events: readonly Record<string, unknown>[]): string | null => {
  for (const event of events) {
    for (const key of ["session_id", "sessionId", "conversation_id", "conversationId"]) {
      const value = stringValue(event[key]);
      if (value) return value;
    }
  }
  return null;
};

const extractEventText = (event: Record<string, unknown>): string | null => {
  for (const key of ["result", "output_text", "text", "message", "content"]) {
    const value = stringValue(event[key]);
    if (value) return value;
  }
  return null;
};

const extractStructuredOutput = <T>(events: readonly Record<string, unknown>[]): T => {
  for (const event of [...events].reverse()) {
    for (const key of ["result", "output", "response", "content"]) {
      const value = event[key];
      if (value && typeof value === "object") return value as T;
      if (typeof value === "string" && value.trim()) return parseStructuredAgentJsonResponse(value) as T;
    }
  }
  const combinedText = events.map(extractEventText).filter((value): value is string => Boolean(value)).join("\n").trim();
  if (!combinedText) {
    throw new Error("Claude did not return structured JSON output. Check that Claude CLI supports --print --output-format stream-json.");
  }
  return parseStructuredAgentJsonResponse(combinedText) as T;
};

export type ClaudeProviderDependencies = {
  readonly command?: string;
  readonly runCommand?: CliCommandRunner;
};

const sessionRefFor = (sessionId: string | null) =>
  sessionId
    ? {
        providerId: "claude",
        externalId: sessionId,
        parts: { sessionId }
      }
    : null;

export const createClaudeAgentProvider = (dependencies: ClaudeProviderDependencies = {}): AgentProvider => {
  const command = dependencies.command ?? "claude";
  const runCommand = dependencies.runCommand ?? defaultRunCommand;

  return {
    providerId: "claude",
    runStructured: async <T = unknown>(request: StructuredAgentRequest) => {
      const args = ["--print", "--output-format", "stream-json", "--cwd", request.projectPath, request.prompt];
      const { stdout, stderr } = await runCommand(command, args, { cwd: request.projectPath, signal: request.signal });
      const rawResponse = stdout.trim() || stderr.trim();
      if (!rawResponse) throw new Error("Claude did not return any output.");
      let events: Record<string, unknown>[];
      try {
        events = parseJsonLines(rawResponse);
      } catch {
        throw new Error("Claude did not return valid stream-json output.");
      }
      return {
        providerId: "claude",
        output: extractStructuredOutput<T>(events),
        rawResponse,
        providerSessionRef: sessionRefFor(extractSessionId(events))
      };
    },
    runText: async (request: TextAgentRequest) => {
      const args = ["--print", "--output-format", "stream-json", "--cwd", request.projectPath];
      if (request.providerSessionRef?.externalId) {
        args.push("--resume", request.providerSessionRef.externalId);
      }
      args.push(request.prompt);
      const { stdout, stderr } = await runCommand(command, args, { cwd: request.projectPath, signal: request.signal });
      const rawResponse = stdout.trim() || stderr.trim();
      if (!rawResponse) throw new Error("Claude did not return any output.");
      let events: Record<string, unknown>[];
      try {
        events = parseJsonLines(rawResponse);
      } catch {
        throw new Error("Claude did not return valid stream-json output.");
      }
      const text = events.map(extractEventText).filter((value): value is string => Boolean(value)).join("\n").trim();
      if (!text) throw new Error("Claude did not return a text response.");
      return {
        providerId: "claude",
        text,
        rawResponse,
        providerSessionRef: sessionRefFor(extractSessionId(events) ?? request.providerSessionRef?.externalId ?? null)
      };
    }
  };
};

