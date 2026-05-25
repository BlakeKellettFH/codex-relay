import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  AgentProviderInventory,
  AgentProviderSwitchResult,
  AgentTicketUpdateInput,
  BoardSnapshot,
  CancelRunInput,
  ClarificationAnswerInput,
  CodexStatus,
  CreateDraftInput,
  EpicSubticketCreateInput,
  EpicSubticketLinkInput,
  EpicSubticketUnlinkInput,
  FeatureSubticketLinkInput,
  FeatureTaskCreateRequest,
  GitMetadata,
  GitMetadataOptions,
  LocalVoiceInputStatus,
  ProjectOpenInEditorInput,
  RendererRunEvent,
  RepositoryChatInput,
  RepositoryChatSaveInput,
  RepositoryChatStore,
  RepositoryChatStreamEvent,
  RunSummary,
  StartRunInput,
  TicketAttachmentSaveInput,
  TicketMoveInput,
  TicketRedraftInput,
  TicketRecord,
  TicketSaveInput
} from "@shared/schemas";
import type { TicketArchiveInput } from "@shared/http";
import { relayApi } from "./relayApi";

type ProjectPath = string | null | undefined;
type TicketId = string | null | undefined;
type RunId = string | null | undefined;

export const relayQueryKeys = {
  projects: ["relay", "projects"] as const,
  providerInventory: ["relay", "agents", "providers"] as const,
  voiceInputStatus: ["relay", "agents", "voice-input-status"] as const,
  board: (projectPath: ProjectPath) => ["relay", "board", projectPath ?? null] as const,
  ticket: (projectPath: ProjectPath, ticketId: TicketId) => ["relay", "ticket", projectPath ?? null, ticketId ?? null] as const,
  ticketClarifications: (projectPath: ProjectPath, ticketId: TicketId) =>
    ["relay", "ticket", projectPath ?? null, ticketId ?? null, "clarifications"] as const,
  ticketReferences: (projectPath: ProjectPath) => ["relay", "ticket-references", projectPath ?? null] as const,
  codexStatus: ["relay", "codex", "status"] as const,
  gitMetadata: (projectPath: ProjectPath) => ["relay", "git-metadata", projectPath ?? null] as const,
  runEvents: (projectPath: ProjectPath, ticketId: TicketId, runId: RunId) =>
    ["relay", "run-events", projectPath ?? null, ticketId ?? null, runId ?? null] as const,
  runSummary: (projectPath: ProjectPath, ticketId: TicketId) => ["relay", "run-summary", projectPath ?? null, ticketId ?? null] as const,
  repositoryChat: (projectPath: ProjectPath) => ["relay", "repository-chat", projectPath ?? null] as const
};

export const relayErrorMessage = (error: unknown, fallback: string): string => (error instanceof Error ? error.message : fallback);

const invalidateProjectData = async (queryClient: QueryClient, projectPath?: string | null): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: relayQueryKeys.projects }),
    projectPath ? queryClient.invalidateQueries({ queryKey: relayQueryKeys.board(projectPath) }) : Promise.resolve(),
    projectPath ? queryClient.invalidateQueries({ queryKey: relayQueryKeys.ticketReferences(projectPath) }) : Promise.resolve(),
    projectPath ? queryClient.invalidateQueries({ queryKey: relayQueryKeys.gitMetadata(projectPath) }) : Promise.resolve()
  ]);
};

const invalidateTicketData = async (queryClient: QueryClient, projectPath: string, ticketId?: string | null): Promise<void> => {
  await Promise.all([
    invalidateProjectData(queryClient, projectPath),
    ticketId ? queryClient.invalidateQueries({ queryKey: relayQueryKeys.ticket(projectPath, ticketId) }) : Promise.resolve(),
    ticketId ? queryClient.invalidateQueries({ queryKey: relayQueryKeys.ticketClarifications(projectPath, ticketId) }) : Promise.resolve(),
    ticketId ? queryClient.invalidateQueries({ queryKey: relayQueryKeys.runSummary(projectPath, ticketId) }) : Promise.resolve(),
    ticketId ? queryClient.invalidateQueries({ queryKey: ["relay", "run-events", projectPath, ticketId] }) : Promise.resolve()
  ]);
};

export const invalidateRelayProjectData = invalidateProjectData;
export const invalidateRelayTicketData = invalidateTicketData;

const invalidateTicketQueries = async (
  queryClient: QueryClient,
  projectPath: string,
  ticketId?: string | null
): Promise<void> => {
  await Promise.all([
    ticketId ? queryClient.invalidateQueries({ queryKey: relayQueryKeys.ticket(projectPath, ticketId) }) : Promise.resolve(),
    ticketId
      ? queryClient.invalidateQueries({ queryKey: relayQueryKeys.ticketClarifications(projectPath, ticketId) })
      : Promise.resolve(),
    ticketId ? queryClient.invalidateQueries({ queryKey: relayQueryKeys.runSummary(projectPath, ticketId) }) : Promise.resolve(),
    ticketId ? queryClient.invalidateQueries({ queryKey: ["relay", "run-events", projectPath, ticketId] }) : Promise.resolve()
  ]);
};

const relayTicketInvalidateTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Coalesce rapid SSE invalidations (e.g. many status_changed events during a run). */
export const debouncedInvalidateRelayTicketData = (
  queryClient: QueryClient,
  projectPath: string,
  ticketId?: string | null,
  delayMs = 200
): void => {
  const key = `${projectPath}:${ticketId ?? ""}`;
  const existing = relayTicketInvalidateTimers.get(key);
  if (existing) clearTimeout(existing);
  relayTicketInvalidateTimers.set(
    key,
    setTimeout(() => {
      relayTicketInvalidateTimers.delete(key);
      void invalidateTicketData(queryClient, projectPath, ticketId);
    }, delayMs)
  );
};

/** After extend_feature (or similar) removes a draft placeholder, refresh the real ticket without refetching the deleted id. */
export const handleDraftPlaceholderResolved = async (
  queryClient: QueryClient,
  projectPath: string,
  placeholderTicketId: string,
  resolvedTicketId: string
): Promise<void> => {
  await invalidateRelayTicketData(queryClient, projectPath, resolvedTicketId);
  await Promise.all([
    queryClient.removeQueries({ queryKey: relayQueryKeys.ticket(projectPath, placeholderTicketId) }),
    queryClient.removeQueries({ queryKey: relayQueryKeys.ticketClarifications(projectPath, placeholderTicketId) }),
    queryClient.removeQueries({ queryKey: relayQueryKeys.runSummary(projectPath, placeholderTicketId) }),
    queryClient.removeQueries({ queryKey: ["relay", "run-events", projectPath, placeholderTicketId] })
  ]);
};

export const useProjectsQuery = () =>
  useQuery({
    queryKey: relayQueryKeys.projects,
    queryFn: () => relayApi.projects.list()
  });

export const useProviderInventoryQuery = () =>
  useQuery({
    queryKey: relayQueryKeys.providerInventory,
    queryFn: () => relayApi.agents.providers(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 4_000)
  });

export const useVoiceInputStatusQuery = () =>
  useQuery({
    queryKey: relayQueryKeys.voiceInputStatus,
    queryFn: () => relayApi.agents.voiceInputStatus(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1
  });

export const useBoardQuery = (projectPath: ProjectPath) =>
  useQuery({
    queryKey: relayQueryKeys.board(projectPath),
    queryFn: () => relayApi.board.read({ projectPath: projectPath as string }),
    enabled: Boolean(projectPath)
  });

export const useTicketQuery = (projectPath: ProjectPath, ticketId: TicketId) =>
  useQuery({
    queryKey: relayQueryKeys.ticket(projectPath, ticketId),
    queryFn: () => relayApi.tickets.read({ projectPath: projectPath as string, ticketId: ticketId as string }),
    enabled: Boolean(projectPath && ticketId)
  });

export const useTicketClarificationsQuery = (projectPath: ProjectPath, ticketId: TicketId) =>
  useQuery({
    queryKey: relayQueryKeys.ticketClarifications(projectPath, ticketId),
    queryFn: () => relayApi.tickets.clarifications({ projectPath: projectPath as string, ticketId: ticketId as string }),
    enabled: Boolean(projectPath && ticketId)
  });

export const useTicketReferencesQuery = (projectPath: ProjectPath) =>
  useQuery({
    queryKey: relayQueryKeys.ticketReferences(projectPath),
    queryFn: () => relayApi.tickets.references({ projectPath: projectPath as string }),
    enabled: Boolean(projectPath)
  });

export const useCodexStatusQuery = () =>
  useQuery({
    queryKey: relayQueryKeys.codexStatus,
    queryFn: () => relayApi.codex.status(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 4_000)
  });

export const useProjectGitMetadataQuery = (projectPath: ProjectPath, options?: GitMetadataOptions) =>
  useQuery({
    queryKey: relayQueryKeys.gitMetadata(projectPath),
    queryFn: () => relayApi.projects.gitMetadata({ projectPath: projectPath as string, options }),
    enabled: Boolean(projectPath),
    retry: false
  });

export const useRunEventsQuery = (projectPath: ProjectPath, ticketId: TicketId, runId: RunId) =>
  useQuery({
    queryKey: relayQueryKeys.runEvents(projectPath, ticketId, runId),
    queryFn: () =>
      relayApi.codex.readRunEvents({
        projectPath: projectPath as string,
        ticketId: ticketId as string,
        runId: runId as string
      }),
    enabled: Boolean(projectPath && ticketId && runId)
  });

export const useRunSummaryQuery = (projectPath: ProjectPath, ticketId: TicketId) =>
  useQuery({
    queryKey: relayQueryKeys.runSummary(projectPath, ticketId),
    queryFn: () => relayApi.codex.readLatestRunSummary({ projectPath: projectPath as string, ticketId: ticketId as string }),
    enabled: Boolean(projectPath && ticketId)
  });

export const useAddProjectMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => relayApi.projects.addFolder(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: relayQueryKeys.projects });
    }
  });
};

export const useRemoveProjectMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectPath: string) => relayApi.projects.removeFromSidebar({ projectPath }),
    onSuccess: async (_projects, projectPath) => {
      await invalidateProjectData(queryClient, projectPath);
    }
  });
};

export const useRevealProjectMutation = () => useMutation({ mutationFn: (projectPath: string) => relayApi.projects.revealInFinder({ projectPath }) });

export const relayOpenProjectInEditor = (input: ProjectOpenInEditorInput) => relayApi.projects.openInEditor(input);

export const useOpenProjectInEditorMutation = () =>
  useMutation({ mutationFn: relayOpenProjectInEditor });

export const useRefreshCodexStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => relayApi.codex.status(),
    onSuccess: (status) => {
      queryClient.setQueryData(relayQueryKeys.codexStatus, status);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: relayQueryKeys.codexStatus });
    }
  });
};

export const setProviderInventoryQueryData = (queryClient: QueryClient, inventory: AgentProviderInventory): void => {
  queryClient.setQueryData(relayQueryKeys.providerInventory, inventory);
};

export const syncProviderInventoryAfterSwitch = (queryClient: QueryClient, result: AgentProviderSwitchResult): void => {
  if (!result.ok) return;
  setProviderInventoryQueryData(queryClient, result.inventory);
};

export const useSwitchAgentProviderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (providerId: AgentProviderInventory["selectedProviderId"]) => relayApi.agents.switchProvider({ providerId }),
    onSuccess: async (result) => {
      syncProviderInventoryAfterSwitch(queryClient, result);
      await queryClient.invalidateQueries({ queryKey: relayQueryKeys.providerInventory });
    }
  });
};

export const setVoiceInputStatusQueryData = (queryClient: QueryClient, status: LocalVoiceInputStatus): void => {
  queryClient.setQueryData(relayQueryKeys.voiceInputStatus, status);
};

export const useTranscribeVoiceInputMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { readonly audioBase64: string }) => relayApi.agents.transcribeVoiceInput(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: relayQueryKeys.voiceInputStatus });
    }
  });
};

export const useConfigureVoiceInputMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { readonly commandPath: string }) => relayApi.agents.configureVoiceInput(input),
    onSuccess: (status) => {
      setVoiceInputStatusQueryData(queryClient, status);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: relayQueryKeys.voiceInputStatus });
    }
  });
};

export const useMoveTicketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketMoveInput) => relayApi.tickets.move(input),
    onSuccess: async (board, input) => {
      queryClient.setQueryData(relayQueryKeys.board(input.projectPath), board);
      await invalidateTicketQueries(queryClient, input.projectPath, input.ticketId);
    }
  });
};

export const useArchiveTicketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketArchiveInput) => relayApi.tickets.archive(input),
    onSuccess: async (result, input) => {
      queryClient.setQueryData(relayQueryKeys.board(input.projectPath), result.board);
      queryClient.setQueryData(relayQueryKeys.ticket(input.projectPath, result.ticket.frontMatter.id), result.ticket);
      const ticketIds =
        input.ticketIds?.filter((ticketId) => ticketId.trim().length > 0) ??
        (input.ticketId?.trim() ? [input.ticketId.trim()] : [result.ticket.frontMatter.id]);
      await Promise.all(
        ticketIds.map((ticketId) => invalidateTicketQueries(queryClient, input.projectPath, ticketId))
      );
    }
  });
};

export const useCreateDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDraftInput) => relayApi.tickets.createDraft(input),
    onSuccess: async (_result, input) => {
      await invalidateProjectData(queryClient, input.projectPath);
    }
  });
};

export const useRedraftTicketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketRedraftInput) => relayApi.tickets.redraft(input),
    onSuccess: async (_result, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.ticketId);
    }
  });
};

export const useSaveTicketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketSaveInput) => relayApi.tickets.save(input),
    onSuccess: async (ticket, input) => {
      queryClient.setQueryData(relayQueryKeys.ticket(input.projectPath, ticket.frontMatter.id), ticket);
      await invalidateTicketData(queryClient, input.projectPath, ticket.frontMatter.id);
    }
  });
};

export const useSaveTicketAttachmentMutation = () =>
  useMutation({ mutationFn: (input: TicketAttachmentSaveInput) => relayApi.tickets.saveAttachment(input) });

export const useStartTicketUpdateMutation = () =>
  useMutation({ mutationFn: (input: AgentTicketUpdateInput) => relayApi.tickets.startAgentUpdate(input) });

export const useCancelTicketUpdateMutation = () =>
  useMutation({ mutationFn: (runId: string) => relayApi.tickets.cancelAgentUpdate({ runId }) });

export const usePreflightRunMutation = () => useMutation({ mutationFn: (input: StartRunInput) => relayApi.codex.preflightRun(input) });

export const useStartRunMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resume, input }: { resume: boolean; input: StartRunInput }) =>
      resume ? relayApi.codex.resumeRun(input) : relayApi.codex.startRun(input),
    onSuccess: async (_result, { input }) => {
      await invalidateTicketData(queryClient, input.projectPath, input.ticketId);
    }
  });
};

export const useCancelRunMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelRunInput) => relayApi.codex.cancelRun(input),
    onSuccess: async (_result, input) => {
      await Promise.all([
        invalidateTicketData(queryClient, input.projectPath, input.ticketId),
        queryClient.invalidateQueries({ queryKey: relayQueryKeys.gitMetadata(input.projectPath) })
      ]);
    }
  });
};

export const useAnswerClarificationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClarificationAnswerInput) => relayApi.tickets.answerClarification(input),
    onSuccess: async (_question, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.ticketId);
    }
  });
};

export const useApproveScopeClarificationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectPath: string; ticketId: string; clarificationQuestionId: string }) =>
      relayApi.tickets.approveScopeClarification(input),
    onSuccess: async (_result, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.ticketId);
    }
  });
};

export const useDeleteTicketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectPath, ticketId }: { projectPath: string; ticketId: string }) => relayApi.tickets.delete({ projectPath, ticketId }),
    onSuccess: async (_board, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.ticketId);
    }
  });
};

export const useDuplicateTicketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectPath, ticketId }: { projectPath: string; ticketId: string }) => relayApi.tickets.duplicate({ projectPath, ticketId }),
    onSuccess: async (_ticket, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.ticketId);
    }
  });
};

export const useCreateSubticketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EpicSubticketCreateInput) => relayApi.tickets.createSubticket(input),
    onSuccess: async (_ticket, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.epicId);
    }
  });
};

export const useLinkSubticketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EpicSubticketLinkInput) => relayApi.tickets.linkSubticket(input),
    onSuccess: async (_board, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.epicId);
    }
  });
};

export const useUnlinkSubticketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EpicSubticketUnlinkInput) => relayApi.tickets.unlinkSubticket(input),
    onSuccess: async (_board, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.epicId);
    }
  });
};

export const useCreateTaskUnderFeatureMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeatureTaskCreateRequest) => relayApi.tickets.createTaskUnderFeature(input),
    onSuccess: async (_ticket, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.featureId);
    }
  });
};

export const useLinkFeatureSubticketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeatureSubticketLinkInput) => relayApi.tickets.linkFeatureSubticket(input),
    onSuccess: async (_board, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.featureId);
    }
  });
};

export const useUnlinkFeatureSubticketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeatureSubticketLinkInput) => relayApi.tickets.unlinkFeatureSubticket(input),
    onSuccess: async (_board, input) => {
      await invalidateTicketData(queryClient, input.projectPath, input.featureId);
    }
  });
};

export const useRevealTicketFileMutation = () =>
  useMutation({ mutationFn: ({ projectPath, ticketId }: { projectPath: string; ticketId: string }) => relayApi.tickets.revealFile({ projectPath, ticketId }) });

export const useRepositoryChatMutation = () =>
  useMutation({
    mutationFn: (input: RepositoryChatInput) => relayApi.codex.sendRepositoryChatMessage(input)
  });

export const useRepositoryChatQuery = (projectPath: string | null | undefined) =>
  useQuery({
    queryKey: relayQueryKeys.repositoryChat(projectPath),
    queryFn: () => relayApi.projects.readRepositoryChat({ projectPath: projectPath! }),
    enabled: Boolean(projectPath)
  });

export const useSaveRepositoryChatMutation = () =>
  useMutation({
    mutationFn: (input: RepositoryChatSaveInput) => relayApi.projects.saveRepositoryChat(input)
  });

export const useClearRepositoryChatMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectPath: string) => relayApi.projects.clearRepositoryChat({ projectPath }),
    onSuccess: (store, projectPath) => {
      queryClient.setQueryData(relayQueryKeys.repositoryChat(projectPath), store);
    }
  });
};

export const useRunEventSubscription = (listener: (event: RendererRunEvent) => void): (() => void) => relayApi.subscribeRunEvents(listener);
export const useRepositoryChatEventSubscription = (listener: (event: RepositoryChatStreamEvent) => void): (() => void) =>
  relayApi.subscribeRepositoryChatEvents(listener);

export type BoardMoveInput = TicketMoveInput;
export type TicketMutationResult = TicketRecord | BoardSnapshot | void;
export type GitMetadataQueryData = GitMetadata;
export type RunSummaryQueryData = RunSummary | null;
