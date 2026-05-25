import clsx from "clsx";
import { FileText, Loader2, Mic, Square } from "lucide-react";
import type { KeyboardEvent, ReactElement, RefObject } from "react";
import type { CursorAgentModel, RepositoryChatMessage, TicketEffort, TicketPriority } from "@shared/schemas";
import { RepositoryChatOptionMenu } from "./RepositoryChatOptionMenu";
import { Button, Textarea, Tooltip } from "./ui";
import {
  repositoryChatDraftTypeOptions,
  repositoryChatEffortOptions,
  repositoryChatModelOptions,
  repositoryChatPriorityOptions,
  type RepositoryChatDraftType
} from "../lib/repositoryChatOptions";

export type RepositoryChatComposerProps = {
  messages: readonly RepositoryChatMessage[];
  draft: string;
  pendingChat: boolean;
  pendingDraft: boolean;
  usesCursorAgent: boolean;
  draftType: RepositoryChatDraftType;
  priority: TicketPriority;
  effort: TicketEffort;
  cursorAgentModel: CursorAgentModel;
  recording: boolean;
  transcribing: boolean;
  voiceSetupRequired: boolean;
  voiceButtonLabel: string;
  voiceButtonTooltip: string;
  voiceButtonDisabled: boolean;
  composerPlaceholder: string;
  onDraftChange: (value: string) => void;
  onDraftBlur: () => void;
  onSubmitChat: () => void;
  onSubmitDraft: () => void;
  onDraftTypeChange: (value: RepositoryChatDraftType) => void;
  onPriorityChange: (value: TicketPriority) => void;
  onEffortChange: (value: TicketEffort) => void;
  onCursorAgentModelChange: (value: CursorAgentModel) => void;
  onVoiceInput: () => void;
  composerRef?: RefObject<HTMLTextAreaElement | null>;
};

export function RepositoryChatComposer({
  messages,
  draft,
  pendingChat,
  pendingDraft,
  usesCursorAgent,
  draftType,
  priority,
  effort,
  cursorAgentModel,
  recording,
  transcribing,
  voiceSetupRequired,
  voiceButtonLabel,
  voiceButtonTooltip,
  voiceButtonDisabled,
  composerPlaceholder,
  onDraftChange,
  onDraftBlur,
  onSubmitChat,
  onSubmitDraft,
  onDraftTypeChange,
  onPriorityChange,
  onEffortChange,
  onCursorAgentModelChange,
  onVoiceInput,
  composerRef
}: RepositoryChatComposerProps): ReactElement {
  const pending = pendingChat || pendingDraft;
  const hasComposerText = draft.trim().length > 0;
  const hasConversation = messages.length > 0;
  const canSend = hasComposerText && !pending;
  const canCreateDraft = (hasConversation || hasComposerText) && !pending;

  const handleChatSubmit = (): void => {
    if (!canSend) return;
    onSubmitChat();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    handleChatSubmit();
  };

  return (
    <form
      className="repository-chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        handleChatSubmit();
      }}
    >
      <Textarea
        ref={composerRef}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={onDraftBlur}
        onKeyDown={handleKeyDown}
        placeholder={composerPlaceholder}
        aria-label="Repository chat question"
        rows={3}
        disabled={pending}
      />
      <div className="repository-chat-composer-footer">
        <div className="repository-chat-option-row" aria-label="Ticket draft options">
          <RepositoryChatOptionMenu
            menuLabel="Type"
            value={draftType}
            options={repositoryChatDraftTypeOptions}
            onChange={onDraftTypeChange}
            disabled={pending}
          />
          <RepositoryChatOptionMenu
            menuLabel="Priority"
            value={priority}
            options={repositoryChatPriorityOptions}
            onChange={onPriorityChange}
            disabled={pending}
          />
          {usesCursorAgent ? (
            <RepositoryChatOptionMenu
              menuLabel="Model"
              value={cursorAgentModel}
              options={repositoryChatModelOptions}
              onChange={onCursorAgentModelChange}
              disabled={pending}
            />
          ) : (
            <RepositoryChatOptionMenu
              menuLabel="Effort"
              value={effort}
              options={repositoryChatEffortOptions}
              onChange={onEffortChange}
              disabled={pending}
            />
          )}
        </div>
        <div className="repository-chat-action-row">
          <Tooltip label={voiceButtonTooltip} placement="above">
            <Button
              type="button"
              className={clsx(
                "floating-ticket-voice",
                "repository-chat-voice",
                recording && "recording",
                voiceSetupRequired && "setup-required"
              )}
              onClick={onVoiceInput}
              disabled={voiceButtonDisabled}
              aria-label={voiceButtonLabel}
              title={voiceButtonLabel}
              aria-pressed={recording || undefined}
            >
              {transcribing ? <Loader2 className="spin" size={16} /> : recording ? <Square size={16} /> : <Mic size={16} />}
            </Button>
          </Tooltip>
          <Tooltip
            label={
              hasConversation && !hasComposerText
                ? "Create ticket draft from this chat"
                : "Create ticket draft from this input"
            }
            placement="above"
          >
            <Button
              type="button"
              className="floating-ticket-submit repository-chat-ticket-send"
              onClick={onSubmitDraft}
              disabled={!canCreateDraft}
              aria-label="Create ticket draft"
              title="Create ticket draft"
            >
              {pendingDraft ? <Loader2 className="spin" size={16} /> : <FileText size={16} />}
            </Button>
          </Tooltip>
        </div>
      </div>
    </form>
  );
}
