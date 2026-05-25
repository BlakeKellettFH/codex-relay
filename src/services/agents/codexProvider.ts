import type { ThreadEvent, ThreadOptions } from "@openai/codex-sdk";
import type { AgentProvider, StructuredAgentRequest, TextAgentRequest, TextAgentResult, TextAgentStreamEvent } from "./index";
import { parseStructuredAgentJsonResponse } from "./index";

type CodexProviderTurnResult = {
  readonly finalResponse: string;
};

type CodexProviderStreamedResult = {
  readonly events: AsyncIterable<ThreadEvent>;
};

type CodexProviderThread = {
  readonly id?: string | null;
  readonly run: (
    input: string,
    options?: {
      readonly outputSchema?: unknown;
      readonly signal?: AbortSignal;
    }
  ) => Promise<CodexProviderTurnResult>;
  readonly runStreamed?: (
    input: string,
    options?: {
      readonly signal?: AbortSignal;
    }
  ) => Promise<CodexProviderStreamedResult>;
};

export type CodexProviderClient = {
  readonly startThread: (options: ThreadOptions) => CodexProviderThread;
  readonly resumeThread: (threadId: string, options: ThreadOptions) => CodexProviderThread;
};

export type CodexProviderDependencies = {
  readonly createClient: () => CodexProviderClient | Promise<CodexProviderClient>;
  readonly structuredThreadOptionsForRequest: (request: StructuredAgentRequest) => Promise<ThreadOptions>;
  readonly textThreadOptionsForRequest: (request: TextAgentRequest) => Promise<ThreadOptions>;
};

const providerSessionRefFor = (threadId: string | null | undefined) =>
  threadId
    ? {
        providerId: "codex",
        externalId: threadId,
        parts: { threadId }
      }
    : null;

const textDeltaFromEventItem = (
  event: Extract<ThreadEvent, { type: "item.started" | "item.updated" | "item.completed" }>,
  offsets: Map<string, number>
): string | null => {
  const item = event.item;
  if ((item.type !== "agent_message" && item.type !== "reasoning") || !item.text) return null;
  const previousOffset = offsets.get(item.id) ?? 0;
  if (item.text.length <= previousOffset) return null;
  offsets.set(item.id, item.text.length);
  return item.text.slice(previousOffset);
};

export const createCodexAgentProvider = (dependencies: CodexProviderDependencies): AgentProvider => ({
  providerId: "codex",
  runStructured: async <T = unknown>(request: StructuredAgentRequest) => {
    const client = await dependencies.createClient();
    const thread = client.startThread(await dependencies.structuredThreadOptionsForRequest(request));
    const turn = await thread.run(request.prompt, { outputSchema: request.outputSchema, signal: request.signal });
    return {
      providerId: "codex",
      output: parseStructuredAgentJsonResponse(turn.finalResponse) as T,
      rawResponse: turn.finalResponse,
      providerSessionRef: providerSessionRefFor(thread.id)
    };
  },
  runText: async (request: TextAgentRequest) => {
    const client = await dependencies.createClient();
    const options = await dependencies.textThreadOptionsForRequest(request);
    const thread = request.providerSessionRef?.externalId
      ? client.resumeThread(request.providerSessionRef.externalId, options)
      : client.startThread(options);
    const turn = await thread.run(request.prompt, { signal: request.signal });
    return {
      providerId: "codex",
      text: turn.finalResponse.trim(),
      rawResponse: turn.finalResponse,
      providerSessionRef: providerSessionRefFor(thread.id ?? request.providerSessionRef?.externalId ?? null)
    };
  },
  runTextStream: async (request: TextAgentRequest) => {
    const client = await dependencies.createClient();
    const options = await dependencies.textThreadOptionsForRequest(request);
    const thread = request.providerSessionRef?.externalId
      ? client.resumeThread(request.providerSessionRef.externalId, options)
      : client.startThread(options);

    if (!thread.runStreamed) {
      const completed = Promise.resolve().then(async (): Promise<TextAgentResult> => {
        const turn = await thread.run(request.prompt, { signal: request.signal });
        return {
          providerId: "codex",
          text: turn.finalResponse.trim(),
          rawResponse: turn.finalResponse,
          providerSessionRef: providerSessionRefFor(thread.id ?? request.providerSessionRef?.externalId ?? null)
        };
      });
      return {
        providerId: "codex",
        events: (async function*(): AsyncIterable<TextAgentStreamEvent> {})(),
        completed
      };
    }

    const streamed = await thread.runStreamed(request.prompt, { signal: request.signal });
    let activeThreadId = thread.id ?? request.providerSessionRef?.externalId ?? null;
    let finalText = "";
    let rawResponse = "";
    let completedResolved = false;
    let resolveCompleted!: (result: TextAgentResult) => void;
    let rejectCompleted!: (error: unknown) => void;
    const completed = new Promise<TextAgentResult>((resolve, reject) => {
      resolveCompleted = resolve;
      rejectCompleted = reject;
    });

    const events = (async function*(): AsyncIterable<TextAgentStreamEvent> {
      const offsets = new Map<string, number>();
      try {
        for await (const event of streamed.events) {
          rawResponse += `${JSON.stringify(event)}\n`;
          if (event.type === "thread.started") {
            activeThreadId = event.thread_id;
            continue;
          }

          if (event.type === "item.started" || event.type === "item.updated" || event.type === "item.completed") {
            const delta = textDeltaFromEventItem(event, offsets);
            if (delta) {
              if (event.item.type === "agent_message") finalText = event.item.text;
              yield {
                rawEvent: { type: event.item.type === "agent_message" ? "message.delta" : "reasoning.delta", text: delta },
                providerSessionRef: providerSessionRefFor(activeThreadId)
              };
            } else if (event.item.type === "agent_message" && event.item.text) {
              finalText = event.item.text;
            }
            continue;
          }

          if (event.type === "turn.failed" || event.type === "error") {
            const message = event.type === "turn.failed" ? event.error.message : event.message;
            if (!completedResolved) {
              completedResolved = true;
              rejectCompleted(new Error(message));
            }
            yield {
              rawEvent: { type: "error", message },
              providerSessionRef: providerSessionRefFor(activeThreadId)
            };
            return;
          }
        }

        if (!completedResolved) {
          completedResolved = true;
          resolveCompleted({
            providerId: "codex",
            text: finalText.trim(),
            rawResponse: rawResponse.trim(),
            providerSessionRef: providerSessionRefFor(activeThreadId)
          });
        }
      } catch (error) {
        if (!completedResolved) {
          completedResolved = true;
          rejectCompleted(error);
        }
        throw error;
      }
    })();

    return {
      providerId: "codex",
      events,
      completed
    };
  }
});
