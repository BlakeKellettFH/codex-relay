import type { CursorAgentModel, TicketEffort } from "@shared/schemas";
import type { ProviderSessionRef } from "../work";

export type AgentWorkMode = "read_only" | "write";

export type AgentWorkKind =
  | "ticket.draft"
  | "ticket.draft_intake"
  | "ticket.hierarchy_draft"
  | "ticket.update"
  | "ticket.implementation"
  | "repository.chat";

export type AgentWebSearchMode = "disabled" | "cached" | "live";

export type StructuredAgentRequest = {
  readonly kind: AgentWorkKind;
  readonly projectPath: string;
  readonly prompt: string;
  readonly outputSchema: unknown;
  readonly mode: AgentWorkMode;
  readonly effort?: TicketEffort;
  readonly agentModel?: CursorAgentModel;
  readonly networkAccessEnabled?: boolean;
  readonly webSearchMode?: AgentWebSearchMode;
  readonly signal?: AbortSignal;
};

export type TextAgentRequest = {
  readonly kind: AgentWorkKind;
  readonly projectPath: string;
  readonly prompt: string;
  readonly mode: AgentWorkMode;
  readonly effort?: TicketEffort;
  readonly agentModel?: CursorAgentModel;
  readonly networkAccessEnabled?: boolean;
  readonly webSearchMode?: AgentWebSearchMode;
  readonly signal?: AbortSignal;
  readonly providerSessionRef?: ProviderSessionRef | null;
};

export type StructuredAgentResult<T = unknown> = {
  readonly providerId: string;
  readonly output: T;
  readonly rawResponse: string;
  readonly providerSessionRef?: ProviderSessionRef | null;
};

export type StructuredAgentProvider = {
  readonly providerId: string;
  readonly runStructured: <T = unknown>(request: StructuredAgentRequest) => Promise<StructuredAgentResult<T>>;
};

export type TextAgentResult = {
  readonly providerId: string;
  readonly text: string;
  readonly rawResponse: string;
  readonly providerSessionRef?: ProviderSessionRef | null;
};

export type TextAgentStreamEvent = {
  readonly rawEvent?: Record<string, unknown> | null;
  readonly providerSessionRef?: ProviderSessionRef | null;
};

export type TextAgentStreamResult = {
  readonly providerId: string;
  readonly events: AsyncIterable<TextAgentStreamEvent>;
  readonly completed: Promise<TextAgentResult>;
};

export type AgentProvider = StructuredAgentProvider & {
  readonly runText: (request: TextAgentRequest) => Promise<TextAgentResult>;
  readonly runTextStream?: (request: TextAgentRequest) => Promise<TextAgentStreamResult>;
};

export type CliCommandRunner = (
  command: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly signal?: AbortSignal;
  }
) => Promise<{
  readonly stdout: string;
  readonly stderr: string;
}>;

export type CliCommandStreamChunk = {
  readonly stream: "stdout" | "stderr";
  readonly text: string;
};

export type CliCommandStreamRunner = (
  command: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly signal?: AbortSignal;
  }
) => {
  readonly chunks: AsyncIterable<CliCommandStreamChunk>;
  readonly completed: Promise<{
    readonly stdout: string;
    readonly stderr: string;
  }>;
};

export const parseStructuredAgentJsonResponse = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    const first = value.indexOf("{");
    const last = value.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(value.slice(first, last + 1));
    }
    throw new Error("Agent did not return valid JSON.");
  }
};
