import {
  agentEndpoints,
  boardEndpoints,
  codexEndpoints,
  decodeHttpPayload,
  projectEndpoints,
  ticketEndpoints,
  type AnyHttpEndpoint,
  type HttpEndpoint,
  type HttpEndpointRequest,
  type HttpEndpointResponse,
  type TicketArchiveInput,
  type TicketArchiveResult
} from "@shared/http";
import { rendererRunEventSchema, repositoryChatStreamEventSchema } from "@shared/schemas";
import type {
  AddProjectResult,
  AgentProviderInventory,
  AgentProviderSwitchInput,
  AgentProviderSwitchResult,
  AgentTicketUpdateInput,
  AgentTicketUpdateStartResult,
  BoardSnapshot,
  CancelRunInput,
  ClarificationAnswerInput,
  ClarificationQuestion,
  CodexCancelRunResult,
  CodexRunPreflightResult,
  CodexRunStartResult,
  CodexStatus,
  CreateDraftInput,
  DraftIntakeInput,
  DraftIntakeResult,
  EpicSubticketCreateInput,
  EpicSubticketLinkInput,
  FeatureSubticketCreateInput,
  FeatureSubticketLinkInput,
  FeatureTaskCreateRequest,
  GitMetadata,
  GitMetadataOptions,
  LocalVoiceInputStatus,
  LocalVoiceInputTranscriptionResult,
  ProjectOpenInEditorInput,
  ProjectOpenInEditorResult,
  ProjectSummary,
  RepositoryChatSaveInput,
  RepositoryChatStore,
  RendererRunEvent,
  RepositoryChatInput,
  RepositoryChatStreamEvent,
  RepositoryChatResponse,
  RunSummary,
  StartRunInput,
  TicketAttachmentSaveInput,
  TicketAttachmentSaveResult,
  TicketCreateInput,
  TicketDraftStartResult,
  TicketMoveInput,
  TicketRecord,
  TicketRedraftInput,
  TicketReferenceCandidate,
  TicketSaveInput
} from "@shared/schemas";

type RelayApiConfig = {
  readonly baseUrl: string;
  readonly token: string;
};

export class RelayApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RelayApiError";
    this.status = status;
    this.code = code;
  }
}

export type RelayApiClient = {
  readonly agents: {
    readonly providers: () => Promise<AgentProviderInventory>;
    readonly switchProvider: (input: AgentProviderSwitchInput) => Promise<AgentProviderSwitchResult>;
    readonly voiceInputStatus: () => Promise<LocalVoiceInputStatus>;
    readonly configureVoiceInput: (input: { readonly commandPath: string }) => Promise<LocalVoiceInputStatus>;
    readonly transcribeVoiceInput: (input: { readonly audioBase64: string }) => Promise<LocalVoiceInputTranscriptionResult>;
  };
  readonly projects: {
    readonly list: () => Promise<ProjectSummary[]>;
    readonly addFolder: () => Promise<AddProjectResult | null>;
    readonly addPath: (input: { readonly projectPath: string; readonly initializeIfMissing?: boolean }) => Promise<AddProjectResult>;
    readonly removeFromSidebar: (input: { readonly projectPath: string }) => Promise<ProjectSummary[]>;
    readonly read: (input: { readonly projectPath: string }) => Promise<ProjectSummary>;
    readonly gitMetadata: (input: { readonly projectPath: string; readonly options?: GitMetadataOptions }) => Promise<GitMetadata>;
    readonly revealInFinder: (input: { readonly projectPath: string }) => Promise<void>;
    readonly openInEditor: (input: ProjectOpenInEditorInput) => Promise<ProjectOpenInEditorResult>;
    readonly readRepositoryChat: (input: { readonly projectPath: string }) => Promise<RepositoryChatStore>;
    readonly saveRepositoryChat: (input: RepositoryChatSaveInput) => Promise<RepositoryChatStore>;
    readonly clearRepositoryChat: (input: { readonly projectPath: string }) => Promise<RepositoryChatStore>;
  };
  readonly board: {
    readonly read: (input: { readonly projectPath: string }) => Promise<BoardSnapshot>;
  };
  readonly tickets: {
    readonly intakeDraft: (input: DraftIntakeInput) => Promise<DraftIntakeResult>;
    readonly createDraft: (input: CreateDraftInput) => Promise<TicketDraftStartResult>;
    readonly redraft: (input: TicketRedraftInput) => Promise<TicketDraftStartResult>;
    readonly createManual: (input: { readonly projectPath: string; readonly input: TicketCreateInput }) => Promise<TicketRecord>;
    readonly createSubticket: (input: EpicSubticketCreateInput) => Promise<TicketRecord>;
    readonly linkSubticket: (input: EpicSubticketLinkInput) => Promise<BoardSnapshot>;
    readonly unlinkSubticket: (input: EpicSubticketLinkInput) => Promise<BoardSnapshot>;
    readonly createTaskUnderFeature: (input: FeatureTaskCreateRequest) => Promise<TicketRecord>;
    readonly createFeatureSubticket: (input: FeatureSubticketCreateInput) => Promise<TicketRecord>;
    readonly linkFeatureSubticket: (input: FeatureSubticketLinkInput) => Promise<BoardSnapshot>;
    readonly unlinkFeatureSubticket: (input: FeatureSubticketLinkInput) => Promise<BoardSnapshot>;
    readonly startAgentUpdate: (input: AgentTicketUpdateInput) => Promise<AgentTicketUpdateStartResult>;
    readonly cancelAgentUpdate: (input: { readonly runId: string }) => Promise<void>;
    readonly references: (input: { readonly projectPath: string }) => Promise<TicketReferenceCandidate[]>;
    readonly read: (input: { readonly projectPath: string; readonly ticketId: string }) => Promise<TicketRecord>;
    readonly save: (input: TicketSaveInput) => Promise<TicketRecord>;
    readonly saveAttachment: (input: TicketAttachmentSaveInput) => Promise<TicketAttachmentSaveResult>;
    readonly move: (input: TicketMoveInput) => Promise<BoardSnapshot>;
    readonly archive: (input: TicketArchiveInput) => Promise<TicketArchiveResult>;
    readonly clarifications: (input: { readonly projectPath: string; readonly ticketId: string }) => Promise<ClarificationQuestion[]>;
    readonly answerClarification: (input: ClarificationAnswerInput) => Promise<ClarificationQuestion>;
    readonly approveScopeClarification: (input: { readonly projectPath: string; readonly ticketId: string; readonly clarificationQuestionId: string }) => Promise<AgentTicketUpdateStartResult>;
    readonly delete: (input: { readonly projectPath: string; readonly ticketId: string }) => Promise<BoardSnapshot>;
    readonly duplicate: (input: { readonly projectPath: string; readonly ticketId: string }) => Promise<TicketRecord>;
    readonly revealFile: (input: { readonly projectPath: string; readonly ticketId: string }) => Promise<void>;
  };
  readonly codex: {
    readonly status: () => Promise<CodexStatus>;
    readonly preflightRun: (input: StartRunInput) => Promise<CodexRunPreflightResult>;
    readonly startRun: (input: StartRunInput) => Promise<CodexRunStartResult>;
    readonly resumeRun: (input: StartRunInput) => Promise<CodexRunStartResult>;
    readonly cancelRun: (input: CancelRunInput) => Promise<CodexCancelRunResult>;
    readonly approveAction: (input: { readonly approvalId: string; readonly decision: "accept" | "acceptForSession" | "decline" | "cancel" }) => Promise<void>;
    readonly sendRepositoryChatMessage: (input: RepositoryChatInput) => Promise<RepositoryChatResponse>;
    readonly readRunEvents: (input: { readonly projectPath: string; readonly ticketId: string; readonly runId: string }) => Promise<RendererRunEvent[]>;
    readonly readLatestRunSummary: (input: { readonly projectPath: string; readonly ticketId: string }) => Promise<RunSummary | null>;
  };
  readonly subscribeRunEvents: (listener: (event: RendererRunEvent) => void) => () => void;
  readonly subscribeRepositoryChatEvents: (listener: (event: RepositoryChatStreamEvent) => void) => () => void;
};

let testClient: RelayApiClient | null = null;
let browserClient: RelayApiClient | null = null;
let browserClientConfig: RelayApiConfig | null = null;

const normalizeBaseUrl = (value: string): string => value.endsWith("/") ? value : `${value}/`;

const defaultRelayApiBaseUrl = (): string => {
  if (typeof window !== "undefined" && window.location.protocol.startsWith("http")) {
    return window.location.origin;
  }
  return "http://127.0.0.1:17654";
};

const apiConfigFromLocation = (): RelayApiConfig => {
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  return {
    baseUrl: params.get("relayApiBaseUrl") ?? defaultRelayApiBaseUrl(),
    token: params.get("relayApiToken") ?? "relay-dev"
  };
};

const appendQuery = (url: URL, input: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
};

export class RelayNetworkError extends Error {
  readonly code = "network_error";
  readonly url: string;

  constructor(url: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Relay could not reach the local API at ${url}. ${detail}`);
    this.name = "RelayNetworkError";
    this.url = url;
  }
}

const readError = async (response: Response): Promise<RelayApiError> => {
  try {
    const body = await response.json() as { readonly error?: { readonly code?: unknown; readonly message?: unknown } };
    const code = typeof body.error?.code === "string" ? body.error.code : "api_error";
    const message = typeof body.error?.message === "string" ? body.error.message : `Relay API request failed with HTTP ${response.status}.`;
    return new RelayApiError(response.status, code, message);
  } catch {
    return new RelayApiError(response.status, "api_error", `Relay API request failed with HTTP ${response.status}.`);
  }
};

const request = async <Endpoint extends AnyHttpEndpoint>(
  config: RelayApiConfig,
  endpoint: Endpoint,
  input: HttpEndpointRequest<Endpoint>
): Promise<HttpEndpointResponse<Endpoint>> => {
  const url = new URL(endpoint.path, normalizeBaseUrl(config.baseUrl));
  const init: RequestInit = {
    method: endpoint.method,
    headers: {
      Authorization: `Bearer ${config.token}`
    }
  };

  if (endpoint.request?.location === "query") {
    appendQuery(url, input as Record<string, unknown>);
  } else if (endpoint.request?.location === "body") {
    init.headers = {
      ...init.headers,
      "Content-Type": "application/json"
    };
    init.body = JSON.stringify(input);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new RelayNetworkError(url.toString(), error);
  }
  if (!response.ok) throw await readError(response);
  if (!endpoint.response || response.status === 204) return undefined as HttpEndpointResponse<Endpoint>;
  return decodeHttpPayload(endpoint.response, await response.json()) as HttpEndpointResponse<Endpoint>;
};

const call = <Endpoint extends HttpEndpoint<unknown, unknown>>(
  config: RelayApiConfig,
  endpoint: Endpoint,
  input: HttpEndpointRequest<Endpoint>
): Promise<HttpEndpointResponse<Endpoint>> => request(config, endpoint, input);

export const createRelayApiClient = (config: RelayApiConfig): RelayApiClient => ({
  agents: {
    providers: () => call(config, agentEndpoints.providers, undefined),
    switchProvider: (input) => call(config, agentEndpoints.switchProvider, input),
    voiceInputStatus: () => call(config, agentEndpoints.voiceInputStatus, undefined),
    configureVoiceInput: (input) => call(config, agentEndpoints.configureVoiceInput, input),
    transcribeVoiceInput: (input) => call(config, agentEndpoints.transcribeVoiceInput, input)
  },
  projects: {
    list: () => call(config, projectEndpoints.list, undefined),
    addFolder: () => call(config, projectEndpoints.addFolder, undefined),
    addPath: (input) => call(config, projectEndpoints.addPath, input),
    removeFromSidebar: (input) => call(config, projectEndpoints.removeFromSidebar, input),
    read: (input) => call(config, projectEndpoints.read, input),
    gitMetadata: ({ projectPath, options }) =>
      call(config, projectEndpoints.gitMetadata, {
        projectPath,
        force: options?.force === undefined ? undefined : String(options.force)
      }),
    revealInFinder: (input) => call(config, projectEndpoints.revealInFinder, input).then(() => undefined),
    openInEditor: (input) => call(config, projectEndpoints.openInEditor, input),
    readRepositoryChat: (input) => call(config, projectEndpoints.readRepositoryChat, input),
    saveRepositoryChat: (input) => call(config, projectEndpoints.saveRepositoryChat, input),
    clearRepositoryChat: (input) => call(config, projectEndpoints.clearRepositoryChat, input)
  },
  board: {
    read: (input) => call(config, boardEndpoints.read, input)
  },
  tickets: {
    intakeDraft: (input) => call(config, ticketEndpoints.intakeDraft, input),
    createDraft: (input) => call(config, ticketEndpoints.createDraft, input),
    redraft: (input) => call(config, ticketEndpoints.redraft, input),
    createManual: (input) => call(config, ticketEndpoints.createManual, input),
    createSubticket: (input) => call(config, ticketEndpoints.createSubticket, input),
    linkSubticket: (input) => call(config, ticketEndpoints.linkSubticket, input),
    unlinkSubticket: (input) => call(config, ticketEndpoints.unlinkSubticket, input),
    createTaskUnderFeature: (input) => call(config, ticketEndpoints.createTaskUnderFeature, input),
    createFeatureSubticket: (input) => call(config, ticketEndpoints.createFeatureSubticket, input),
    linkFeatureSubticket: (input) => call(config, ticketEndpoints.linkFeatureSubticket, input),
    unlinkFeatureSubticket: (input) => call(config, ticketEndpoints.unlinkFeatureSubticket, input),
    startAgentUpdate: (input) => call(config, ticketEndpoints.startAgentUpdate, input),
    cancelAgentUpdate: (input) => call(config, ticketEndpoints.cancelAgentUpdate, input).then(() => undefined),
    references: (input) => call(config, ticketEndpoints.references, input),
    read: (input) => call(config, ticketEndpoints.read, input),
    save: (input) => call(config, ticketEndpoints.save, input),
    saveAttachment: (input) => call(config, ticketEndpoints.saveAttachment, input),
    move: (input) => call(config, ticketEndpoints.move, input),
    archive: (input) => call(config, ticketEndpoints.archive, input),
    clarifications: (input) => call(config, ticketEndpoints.clarifications, input),
    answerClarification: (input) => call(config, ticketEndpoints.answerClarification, input),
    approveScopeClarification: (input) => call(config, ticketEndpoints.approveScopeClarification, input),
    delete: (input) => call(config, ticketEndpoints.delete, input),
    duplicate: (input) => call(config, ticketEndpoints.duplicate, input),
    revealFile: (input) => call(config, ticketEndpoints.revealFile, input).then(() => undefined)
  },
  codex: {
    status: () => call(config, codexEndpoints.status, undefined),
    preflightRun: (input) => call(config, codexEndpoints.preflightRun, input),
    startRun: (input) => call(config, codexEndpoints.startRun, input),
    resumeRun: (input) => call(config, codexEndpoints.resumeRun, input),
    cancelRun: (input) => call(config, codexEndpoints.cancelRun, input),
    approveAction: (input) => call(config, codexEndpoints.approveAction, input).then(() => undefined),
    sendRepositoryChatMessage: (input) => call(config, codexEndpoints.sendRepositoryChatMessage, input),
    readRunEvents: (input) => call(config, codexEndpoints.readRunEvents, input),
    readLatestRunSummary: (input) => call(config, codexEndpoints.readLatestRunSummary, input)
  },
  subscribeRunEvents: (listener) => {
    const url = new URL("/api/events", normalizeBaseUrl(config.baseUrl));
    url.searchParams.set("token", config.token);
    const source = new EventSource(url);
    const onRunEvent = (event: MessageEvent<string>): void => {
      listener(decodeHttpPayload(rendererRunEventSchema, JSON.parse(event.data)));
    };
    source.addEventListener("run-event", onRunEvent);
    return () => source.close();
  },
  subscribeRepositoryChatEvents: (listener) => {
    const url = new URL("/api/events", normalizeBaseUrl(config.baseUrl));
    url.searchParams.set("token", config.token);
    const source = new EventSource(url);
    const onRepositoryChatEvent = (event: MessageEvent<string>): void => {
      listener(decodeHttpPayload(repositoryChatStreamEventSchema, JSON.parse(event.data)));
    };
    source.addEventListener("repository-chat-event", onRepositoryChatEvent);
    return () => source.close();
  }
});

const sameRelayApiConfig = (left: RelayApiConfig, right: RelayApiConfig): boolean =>
  left.baseUrl === right.baseUrl && left.token === right.token;

const activeClient = (): RelayApiClient => {
  if (testClient) return testClient;
  const config = apiConfigFromLocation();
  if (!browserClient || !browserClientConfig || !sameRelayApiConfig(browserClientConfig, config)) {
    browserClient = createRelayApiClient(config);
    browserClientConfig = config;
  }
  return browserClient;
};

export const relayApi: RelayApiClient = {
  agents: {
    providers: () => activeClient().agents.providers(),
    switchProvider: (input) => activeClient().agents.switchProvider(input),
    voiceInputStatus: () => activeClient().agents.voiceInputStatus(),
    configureVoiceInput: (input) => activeClient().agents.configureVoiceInput(input),
    transcribeVoiceInput: (input) => activeClient().agents.transcribeVoiceInput(input)
  },
  projects: {
    list: () => activeClient().projects.list(),
    addFolder: () => activeClient().projects.addFolder(),
    addPath: (input) => activeClient().projects.addPath(input),
    removeFromSidebar: (input) => activeClient().projects.removeFromSidebar(input),
    read: (input) => activeClient().projects.read(input),
    gitMetadata: (input) => activeClient().projects.gitMetadata(input),
    revealInFinder: (input) => activeClient().projects.revealInFinder(input),
    openInEditor: (input) => activeClient().projects.openInEditor(input),
    readRepositoryChat: (input) => activeClient().projects.readRepositoryChat(input),
    saveRepositoryChat: (input) => activeClient().projects.saveRepositoryChat(input),
    clearRepositoryChat: (input) => activeClient().projects.clearRepositoryChat(input)
  },
  board: {
    read: (input) => activeClient().board.read(input)
  },
  tickets: {
    intakeDraft: (input) => activeClient().tickets.intakeDraft(input),
    createDraft: (input) => activeClient().tickets.createDraft(input),
    redraft: (input) => activeClient().tickets.redraft(input),
    createManual: (input) => activeClient().tickets.createManual(input),
    createSubticket: (input) => activeClient().tickets.createSubticket(input),
    linkSubticket: (input) => activeClient().tickets.linkSubticket(input),
    unlinkSubticket: (input) => activeClient().tickets.unlinkSubticket(input),
    createTaskUnderFeature: (input) => activeClient().tickets.createTaskUnderFeature(input),
    createFeatureSubticket: (input) => activeClient().tickets.createFeatureSubticket(input),
    linkFeatureSubticket: (input) => activeClient().tickets.linkFeatureSubticket(input),
    unlinkFeatureSubticket: (input) => activeClient().tickets.unlinkFeatureSubticket(input),
    startAgentUpdate: (input) => activeClient().tickets.startAgentUpdate(input),
    cancelAgentUpdate: (input) => activeClient().tickets.cancelAgentUpdate(input),
    references: (input) => activeClient().tickets.references(input),
    read: (input) => activeClient().tickets.read(input),
    save: (input) => activeClient().tickets.save(input),
    saveAttachment: (input) => activeClient().tickets.saveAttachment(input),
    move: (input) => activeClient().tickets.move(input),
    archive: (input) => activeClient().tickets.archive(input),
    clarifications: (input) => activeClient().tickets.clarifications(input),
    answerClarification: (input) => activeClient().tickets.answerClarification(input),
    approveScopeClarification: (input) => activeClient().tickets.approveScopeClarification(input),
    delete: (input) => activeClient().tickets.delete(input),
    duplicate: (input) => activeClient().tickets.duplicate(input),
    revealFile: (input) => activeClient().tickets.revealFile(input)
  },
  codex: {
    status: () => activeClient().codex.status(),
    preflightRun: (input) => activeClient().codex.preflightRun(input),
    startRun: (input) => activeClient().codex.startRun(input),
    resumeRun: (input) => activeClient().codex.resumeRun(input),
    cancelRun: (input) => activeClient().codex.cancelRun(input),
    approveAction: (input) => activeClient().codex.approveAction(input),
    sendRepositoryChatMessage: (input) => activeClient().codex.sendRepositoryChatMessage(input),
    readRunEvents: (input) => activeClient().codex.readRunEvents(input),
    readLatestRunSummary: (input) => activeClient().codex.readLatestRunSummary(input)
  },
  subscribeRunEvents: (listener) => activeClient().subscribeRunEvents(listener),
  subscribeRepositoryChatEvents: (listener) => activeClient().subscribeRepositoryChatEvents(listener)
};

export const setRelayApiClientForTests = (client: RelayApiClient | null): (() => void) => {
  testClient = client;
  return () => {
    if (testClient === client) testClient = null;
  };
};
