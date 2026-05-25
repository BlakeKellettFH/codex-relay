import clsx from "clsx";
import { AlertTriangle, Loader2 } from "lucide-react";
import { memo } from "react";
import type { ReactElement } from "react";
import type { RepositoryChatMessage } from "@shared/schemas";
import { MarkdownBlock } from "./MarkdownBlock";

const repositoryChatMessageHasVisibleText = (message: RepositoryChatMessage | undefined): boolean =>
  Boolean(message && message.text.trim().length > 0);

export type RepositoryChatTranscriptProps = {
  messages: readonly RepositoryChatMessage[];
  pendingChat: boolean;
  pendingThinking: boolean;
  pendingDraft: boolean;
  errorMessage: string | null;
  onAnswerCopied?: (kind: "markdown" | "code") => void;
  onAnswerCopyError?: (error: unknown) => void;
};

function RepositoryChatTranscriptInner({
  messages,
  pendingChat,
  pendingThinking,
  pendingDraft,
  errorMessage,
  onAnswerCopied,
  onAnswerCopyError
}: RepositoryChatTranscriptProps): ReactElement {
  const pending = pendingChat || pendingDraft;

  return (
    <div className="repository-chat-transcript" aria-live="polite">
      {messages.length === 0 && !pending ? (
        <div className="repository-chat-empty" role="status">
          Ask about this repository with Enter, or turn the same idea into a ticket draft with the ticket action.
        </div>
      ) : (
        messages.map((message) => {
          const isPendingAssistant =
            message.role === "assistant" && pendingChat && !repositoryChatMessageHasVisibleText(message);
          return (
            <article
              className={clsx("repository-chat-message", message.role, isPendingAssistant && "thinking")}
              key={message.id}
            >
              <span>{message.role === "user" ? "You" : "Agent"}</span>
              {message.role === "assistant" ? (
                isPendingAssistant ? (
                  <p>
                    <Loader2 className="spin" size={14} />
                    Thinking...
                  </p>
                ) : (
                  <MarkdownBlock
                    className="repository-chat-answer"
                    source={message.text}
                    compact
                    onCopied={onAnswerCopied}
                    onCopyError={onAnswerCopyError}
                  />
                )
              ) : (
                <p>{message.text}</p>
              )}
            </article>
          );
        })
      )}

      {pendingThinking && !messages.some((message) => message.role === "assistant") && (
        <div className="repository-chat-message assistant thinking" role="status" aria-busy="true">
          <span>Agent</span>
          <p>
            <Loader2 className="spin" size={14} />
            Thinking...
          </p>
        </div>
      )}

      {pendingDraft && (
        <div className="repository-chat-message assistant pending" role="status" aria-busy="true">
          <span>Agent</span>
          <p>
            <Loader2 className="spin" size={14} />
            Drafting ticket idea.
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="repository-chat-error" role="alert">
          <AlertTriangle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

export const RepositoryChatTranscript = memo(RepositoryChatTranscriptInner);
