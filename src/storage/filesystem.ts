import { Effect, FileSystem, Path } from "effect";
import matter from "gray-matter";
import { effectiveDraftPreferredTicketType } from "@shared/draftTicket";
import { ticketPreviewSummary } from "@shared/ticketSummary";
import {
  boardVisibleColumns,
  DEFAULT_COLUMNS,
  RELAY_ARCHIVE_STATUS,
  RELAY_IN_PROGRESS_STATUS,
  RELAY_NEEDS_CLARIFICATION_STATUS,
  RELAY_READY_STATUS,
  RELAY_REVIEW_STATUS,
  RELAY_COMPLETED_STATUS,
  RELAY_SCHEMA_VERSION,
  RELAY_TODO_STATUS,
  type BoardSnapshot,
  type ClarificationQuestion,
  type ClarificationQuestionStore,
  type ClarificationQuestionCreateInput,
  type CreateDraftInput,
  type InvalidTicket,
  type ProjectConfig,
  type ProjectSettings,
  type ProjectSummary,
  type ProjectSwimlaneSummary,
  type RelayActor,
  type RelayColumn,
  type RelayEventSource,
  type RelayAuditEvent,
  type EpicSubticketCreateInput,
  type EpicFeatureCreateInput,
  type FeatureSubticketCreateInput,
  type FeatureSubticketLinkInput,
  type FeatureTaskCreateInput,
  type HierarchyDraftPlan,
  type LeanTaskDraft,
  type FeatureStubDraft,
  type TicketAttachmentSaveInput,
  type TicketAttachmentSaveResult,
  type TicketCreateInput,
  type TicketDraft,
  type TicketDraftResearch,
  type TicketDraftSubticket,
  type TicketFrontMatter,
  type SubticketCreateInput,
  type TicketMoveInput,
  type TicketReferenceCandidate,
  type TicketRecord,
  type TicketSaveInput,
  type FinalTicketType,
  type RepositoryChatStore,
  type TicketSummary,
  type TicketType
} from "@shared/schemas";
import { imageAttachmentExtension, isSupportedImageAttachment } from "@shared/attachments";
import { uniqueTicketIds } from "@shared/blockers";
import {
  buildLeanTaskTitleToIdMap,
  normalizeLeanTaskTitle,
  resolveLeanTaskBlockedByTitles
} from "@shared/leanTaskDependencies";
import { clarificationStoreSchema, projectConfigSchema, repositoryChatStoreSchema, ticketFrontMatterSchema } from "@shared/schemas";
import { extractTicketChecklist } from "@shared/ticketMetadata";
import { BackendClock } from "../platform";
import { type BackendEffect, runBackendEffect } from "../runtime";
import { logInfo, logWarn } from "../runtime/Logging";
import { showElectronItemInFolder } from "../platform";
import { isFileNotFoundError } from "../platform/PlatformError";
import { parseSchema } from "../services/schemas";
import { TicketNotFoundError, isTicketNotFoundError } from "./errors";
import { atomicWriteJson, atomicWriteText } from "./files";
import { newId } from "./ids";
import {
  attachmentsPath,
  auditLogPath,
  backupsPath,
  clarificationStorePath,
  clarificationsPath,
  contextPath,
  projectConfigPath,
  repositoryChatPath,
  resolveProjectPath,
  runsPath,
  slashPath,
  ticketPath,
  ticketsPath,
  trashPath
} from "./paths";

const CONTEXT_README_FILENAME = "README.md";

const contextReadmeMarkdown = (): string => `# Project agent context

Add markdown files in this folder (for example \`coding-standards.md\` or \`architecture.md\`).

Relay agents read other top-level \`.md\` files here and include them in prompts. This \`README.md\` is documentation only and is **not** injected into agent runs.

Use one topic per file so you can edit or remove context without merging large documents.

For Cursor CLI ticket drafting, Relay also reads \`.relay/context/cursor/draft-ticket.md\` (provider-specific; not injected as general project context). Edit that file to customize the required JSON response example and rules.
`;

const defaultSettings = (): ProjectSettings => ({
  defaultModel: null,
  defaultModelReasoningEffort: null,
  defaultTicketEffort: "medium",
  defaultApprovalPolicy: "on-request",
  defaultSandboxMode: "workspace-write",
  allowNonGitCodexRuns: false,
  ticketDraftingEnabled: true,
  codexExecutionEnabled: true,
  codexNetworkAccessEnabled: false,
  codexWebSearchMode: "disabled",
  codexAdditionalDirectories: [],
  agentConcurrency: 3
});

const nowIso = (): string => new Date().toISOString();
const backendPath = (): Promise<Path.Path> => runBackendEffect(Path.Path.use((path) => Effect.succeed(path)));

const isSidebarActiveRunStatus = (status: TicketSummary["runStatus"]): boolean => status === "running";

const normalizeProjectColumns = (columns: RelayColumn[]): RelayColumn[] => {
  const normalized = columns.map((column) => ({ ...column }));
  const columnIds = new Set(normalized.map((column) => column.id));
  for (const defaultColumn of DEFAULT_COLUMNS) {
    if (columnIds.has(defaultColumn.id)) continue;
    if (defaultColumn.id === RELAY_READY_STATUS) {
      const after = normalized.find((column) => column.id === RELAY_TODO_STATUS)?.position ?? 1000;
      const before = normalized.find((column) => column.id === RELAY_IN_PROGRESS_STATUS)?.position ?? defaultColumn.position;
      normalized.push({
        ...defaultColumn,
        position: before > after ? (after + before) / 2 : defaultColumn.position
      });
    } else if (defaultColumn.id === RELAY_REVIEW_STATUS) {
      const after = normalized.find((column) => column.id === RELAY_NEEDS_CLARIFICATION_STATUS)?.position ?? 4000;
      const before =
        normalized.find((column) => column.id === "not_doing")?.position ??
        normalized.find((column) => column.id === "completed")?.position ??
        defaultColumn.position;
      normalized.push({
        ...defaultColumn,
        position: before > after ? (after + before) / 2 : defaultColumn.position
      });
    } else {
      normalized.push({ ...defaultColumn });
    }
  }
  return normalized.sort((a, b) => a.position - b.position);
};

const normalizeProjectConfig = (config: ProjectConfig): ProjectConfig => ({
  ...config,
  columns: normalizeProjectColumns(config.columns)
});

export const isGitRepository = async (projectPath: string): Promise<boolean> => {
  const path = await backendPath();
  return runBackendEffect(FileSystem.FileSystem.use((fs) => fs.exists(path.join(projectPath, ".git"))));
};

const appendAuditEventEffect = (
  projectPath: string,
  event: Omit<RelayAuditEvent, "schemaVersion" | "timestamp">
): BackendEffect<void> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const clock = yield* BackendClock;
    const record: RelayAuditEvent = {
      schemaVersion: RELAY_SCHEMA_VERSION,
      timestamp: clock.nowIso(),
      ...event
    };
    const target = auditLogPath(path, projectPath);
    yield* fs.makeDirectory(path.dirname(target), { recursive: true });
    yield* fs.writeFileString(target, `${JSON.stringify(record)}\n`, { flag: "a" });
  });

const appendAuditEvent = (projectPath: string, event: Omit<RelayAuditEvent, "schemaVersion" | "timestamp">): Promise<void> =>
  runBackendEffect(appendAuditEventEffect(projectPath, event));

const assertDirectory = async (projectPath: string): Promise<void> => {
  const info = await runBackendEffect(FileSystem.FileSystem.use((fs) => fs.stat(projectPath)));
  if (info.type !== "Directory") {
    throw new Error(`Project path is not a directory: ${projectPath}`);
  }
};

export const isRelayInitialized = async (projectPath: string): Promise<boolean> => {
  const path = await backendPath();
  return runBackendEffect(FileSystem.FileSystem.use((fs) => fs.exists(projectConfigPath(path, projectPath))));
};

export const initializeProject = async (projectPath: string): Promise<ProjectConfig> => {
  const path = await backendPath();
  const resolved = resolveProjectPath(path, projectPath);
  await assertDirectory(resolved);
  const existing = await isRelayInitialized(resolved);
  if (existing) return readProjectConfig(resolved);

  const now = nowIso();
  const config: ProjectConfig = {
    schemaVersion: RELAY_SCHEMA_VERSION,
    projectId: newId("prj"),
    name: path.basename(resolved),
    createdAt: now,
    updatedAt: now,
    columns: DEFAULT_COLUMNS.map((column) => ({ ...column })),
    settings: defaultSettings()
  };

  await runBackendEffect(
    FileSystem.FileSystem.use((fs) =>
      Effect.gen(function*() {
        yield* fs.makeDirectory(ticketsPath(path, resolved), { recursive: true });
        yield* fs.makeDirectory(runsPath(path, resolved), { recursive: true });
        yield* fs.makeDirectory(clarificationsPath(path, resolved), { recursive: true });
        yield* fs.makeDirectory(attachmentsPath(path, resolved), { recursive: true });
        yield* fs.makeDirectory(backupsPath(path, resolved), { recursive: true });
        const contextDirectory = contextPath(path, resolved);
        const contextExisted = yield* fs.exists(contextDirectory);
        yield* fs.makeDirectory(contextDirectory, { recursive: true });
        if (!contextExisted) {
          yield* fs.writeFileString(path.join(contextDirectory, CONTEXT_README_FILENAME), contextReadmeMarkdown());
        }
      })
    )
  );
  await atomicWriteJson(projectConfigPath(path, resolved), config);
  return config;
};

export const readProjectConfig = async (projectPath: string): Promise<ProjectConfig> => {
  const path = await backendPath();
  const raw = await runBackendEffect(FileSystem.FileSystem.use((fs) => fs.readFileString(projectConfigPath(path, projectPath), "utf8")));
  return normalizeProjectConfig(parseSchema(projectConfigSchema, JSON.parse(raw)));
};

export const writeProjectConfig = async (projectPath: string, config: ProjectConfig): Promise<ProjectConfig> => {
  const path = await backendPath();
  const updated = normalizeProjectConfig({ ...config, updatedAt: nowIso() });
  await atomicWriteJson(projectConfigPath(path, projectPath), updated);
  return updated;
};

const sanitizeAttachmentBaseName = (path: Path.Path, fileName: string): string => {
  const baseName = path.basename(fileName.trim() || "image");
  const extension = path.extname(baseName);
  const withoutExtension = extension ? baseName.slice(0, -extension.length) : baseName;
  const sanitized = withoutExtension
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+/g, "")
    .slice(0, 64);
  return sanitized || "image";
};

const decodeBase64Content = (contentBase64: string): Uint8Array => {
  const normalized = contentBase64.replace(/\s+/g, "");
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("Attachment content must be valid base64.");
  }
  const binary = globalThis.atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const saveTicketAttachment = async (input: TicketAttachmentSaveInput): Promise<TicketAttachmentSaveResult> => {
  const path = await backendPath();
  const projectPath = resolveProjectPath(path, input.projectPath);
  const mimeType = input.mimeType ?? null;
  if (!isSupportedImageAttachment({ fileName: input.fileName, mimeType })) {
    throw new Error("Only image attachments can be saved.");
  }

  const content = decodeBase64Content(input.contentBase64);
  const extension = imageAttachmentExtension(input.fileName, mimeType);
  const safeBaseName = sanitizeAttachmentBaseName(path, input.fileName);
  const fileName = `${safeBaseName}-${newId("att")}${extension}`;
  const attachmentDirectory = attachmentsPath(path, projectPath);
  const absolutePath = path.join(attachmentDirectory, fileName);

  await runBackendEffect(
    FileSystem.FileSystem.use((fs) =>
      Effect.gen(function*() {
        yield* fs.makeDirectory(attachmentDirectory, { recursive: true });
        yield* fs.writeFile(absolutePath, content);
      })
    )
  );

  return {
    fileName,
    markdownPath: slashPath(path.relative(projectPath, absolutePath)),
    absolutePath
  };
};

export const summarizeProject = async (projectPath: string, lastOpenedAt?: string): Promise<ProjectSummary> => {
  const path = await backendPath();
  const resolved = resolveProjectPath(path, projectPath);
  const exists = await runBackendEffect(FileSystem.FileSystem.use((fs) => fs.exists(resolved)));
  const healthMessages: string[] = [];
  let config: ProjectConfig | null = null;
  let relayInitialized = false;
  let activeRunCount = 0;
  let swimlanes: ProjectSwimlaneSummary[] = [];

  if (!exists) {
    return {
      projectId: null,
      name: path.basename(resolved),
      path: resolved,
      exists: false,
      isGitRepository: false,
      relayInitialized: false,
      health: "error",
      healthMessages: ["Project folder is missing."],
      activeRunCount: 0,
      swimlanes,
      lastOpenedAt
    };
  }

  relayInitialized = await isRelayInitialized(resolved);
  const git = await isGitRepository(resolved);

  if (!relayInitialized) {
    healthMessages.push("Relay has not initialized this project yet.");
  } else {
    try {
      config = await readProjectConfig(resolved);
      const tickets = await readTickets(resolved, config.columns);
      const ticketCountsByStatus = new Map<string, number>();
      const activeRunCountsByStatus = new Map<string, number>();
      for (const ticket of tickets.tickets) {
        if (ticket.ticketType !== "task") continue;
        ticketCountsByStatus.set(ticket.status, (ticketCountsByStatus.get(ticket.status) ?? 0) + 1);
        if (isSidebarActiveRunStatus(ticket.runStatus)) {
          activeRunCountsByStatus.set(ticket.status, (activeRunCountsByStatus.get(ticket.status) ?? 0) + 1);
        }
      }
      swimlanes = boardVisibleColumns(config.columns)
        .sort((a, b) => a.position - b.position)
        .map((column) => ({
          id: column.id,
          name: column.name,
          position: column.position,
          ticketCount: ticketCountsByStatus.get(column.id) ?? 0,
          activeRunCount: activeRunCountsByStatus.get(column.id) ?? 0
        }));
      activeRunCount = tickets.tickets.filter((ticket) => isSidebarActiveRunStatus(ticket.runStatus)).length;
      if (tickets.invalidTickets.length > 0) {
        healthMessages.push(`${tickets.invalidTickets.length} ticket file(s) need attention.`);
      }
    } catch (error) {
      healthMessages.push(error instanceof Error ? error.message : "Project metadata is invalid.");
    }
  }

  if (!git) {
    healthMessages.push("This folder is not a Git repository. Codex execution is disabled by default.");
  }

  const hasError = exists && relayInitialized && !config;
  const health = hasError ? "error" : healthMessages.length > 0 ? "warning" : "ok";

  return {
    projectId: config?.projectId ?? null,
    name: config?.name ?? path.basename(resolved),
    path: resolved,
    exists,
    isGitRepository: git,
    relayInitialized,
    health,
    healthMessages,
    activeRunCount,
    swimlanes,
    lastOpenedAt
  };
};

const authoringStateFromLegacyRunStatus = (frontMatter: TicketFrontMatter): TicketFrontMatter["authoringState"] => {
  if (frontMatter.authoringState && frontMatter.authoringState !== "rough") return frontMatter.authoringState;
  switch (frontMatter.runStatus) {
    case "drafting":
      return "drafting";
    case "draft_complete":
    case "completed":
      return "reviewing";
    case "blocked":
      return "needs_input";
    case "queued":
    case "running":
      return "ready";
    default:
      return frontMatter.authoringState ?? "rough";
  }
};

const normalizeDraftTargetType = (draftTargetType: FinalTicketType | null | undefined): FinalTicketType | null => {
  if (draftTargetType == null) return null;
  return effectiveDraftPreferredTicketType(draftTargetType) ?? null;
};

const normalizeFrontMatterForRead = (frontMatter: TicketFrontMatter): TicketFrontMatter => ({
  ...frontMatter,
  authoringState: authoringStateFromLegacyRunStatus(frontMatter),
  draftTargetType:
    frontMatter.ticketType === "draft_ticket"
      ? normalizeDraftTargetType(frontMatter.draftTargetType)
      : frontMatter.draftTargetType,
  plannedFiles: normalizePlannedFiles(frontMatter.plannedFiles),
  relatedTicketIds: uniqueTicketIds(frontMatter.relatedTicketIds ?? [])
});

const readTicketFile = async (filePath: string): Promise<TicketRecord> => {
  const raw = await runBackendEffect(FileSystem.FileSystem.use((fs) => fs.readFileString(filePath, "utf8")));
  const parsed = matter(raw);
  const frontMatter = parseSchema(ticketFrontMatterSchema, parsed.data);
  const markdown = parsed.content.trimStart();
  return {
    frontMatter: normalizeFrontMatterForRead(frontMatter),
    markdown,
    filePath,
    checklist: extractTicketChecklist(markdown)
  };
};

const readTickets = async (
  projectPath: string,
  columns: RelayColumn[]
): Promise<{ tickets: TicketSummary[]; records: TicketRecord[]; invalidTickets: InvalidTicket[] }> => {
  const path = await backendPath();
  const ticketDirectory = ticketsPath(path, projectPath);
  const entries = await runBackendEffect(
    FileSystem.FileSystem.use((fs) =>
      Effect.gen(function*() {
        yield* fs.makeDirectory(ticketDirectory, { recursive: true });
        return yield* fs.readDirectory(ticketDirectory);
      })
    )
  );
  const validColumnIds = new Set(columns.map((column) => column.id));
  const tickets: TicketSummary[] = [];
  const records: TicketRecord[] = [];
  const invalidTickets: InvalidTicket[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = path.join(ticketDirectory, entry);
    const info = await runBackendEffect(FileSystem.FileSystem.use((fs) => fs.stat(filePath)));
    if (info.type !== "File") continue;
    try {
      const record = await readTicketFile(filePath);
      if (!validColumnIds.has(record.frontMatter.status)) {
        invalidTickets.push({ filePath, reason: `Unknown status: ${record.frontMatter.status}` });
        continue;
      }
      records.push(record);
      tickets.push({
        ...record.frontMatter,
        excerpt: ticketPreviewSummary(record.frontMatter, record.markdown),
        filePath,
        checklist: record.checklist
      });
    } catch (error) {
      invalidTickets.push({
        filePath,
        reason: error instanceof Error ? error.message : "Unable to parse ticket."
      });
    }
  }

  tickets.sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return a.position - b.position;
  });

  return { tickets, records, invalidTickets };
};

export const readBoard = async (projectPath: string, lastOpenedAt?: string): Promise<BoardSnapshot> => {
  const path = await backendPath();
  const resolved = resolveProjectPath(path, projectPath);
  const project = await summarizeProject(resolved, lastOpenedAt);

  if (!project.exists || !project.relayInitialized) {
    return {
      project,
      config: null,
      columns: DEFAULT_COLUMNS.map((column) => ({ ...column })),
      tickets: [],
      invalidTickets: []
    };
  }

  const config = await readProjectConfig(resolved);
  const { tickets, invalidTickets } = await readTickets(resolved, config.columns);
  return {
    project,
    config,
    columns: [...config.columns].sort((a, b) => a.position - b.position),
    tickets,
    invalidTickets
  };
};

const normalizeFrontMatterRelationships = (frontMatter: TicketFrontMatter): TicketFrontMatter => {
  const ticketType = frontMatter.ticketType ?? "task";
  if (ticketType === "draft_ticket") {
    return {
      ...frontMatter,
      ticketType,
      draftTargetType: normalizeDraftTargetType(frontMatter.draftTargetType),
      parentEpicId: null,
      parentFeatureId: null,
      subticketIds: [],
      plannedFiles: [],
      blockedByIds: uniqueTicketIds(frontMatter.blockedByIds ?? []),
      relatedTicketIds: uniqueTicketIds(frontMatter.relatedTicketIds ?? [])
    };
  }
  const ownsChildren = ticketType === "epic" || ticketType === "feature";
  return {
    ...frontMatter,
    ticketType,
    draftTargetType: null,
    parentEpicId: ticketType === "epic" ? null : frontMatter.parentEpicId ?? null,
    parentFeatureId: ticketType === "task" ? frontMatter.parentFeatureId ?? null : null,
    subticketIds: ownsChildren ? uniqueTicketIds(frontMatter.subticketIds ?? []) : [],
    plannedFiles: ticketType === "task" ? normalizePlannedFiles(frontMatter.plannedFiles) : [],
    blockedByIds: uniqueTicketIds(frontMatter.blockedByIds ?? []),
    relatedTicketIds: uniqueTicketIds(frontMatter.relatedTicketIds ?? [])
  };
};

const assertRelationshipShape = (frontMatter: TicketFrontMatter): void => {
  if (frontMatter.parentEpicId && frontMatter.parentEpicId === frontMatter.id) {
    throw new Error("A ticket cannot be linked as its own epic.");
  }
  if (frontMatter.parentFeatureId && frontMatter.parentFeatureId === frontMatter.id) {
    throw new Error("A ticket cannot be linked as its own feature.");
  }
  if (frontMatter.ticketType === "epic") {
    if (frontMatter.parentEpicId) throw new Error("Nested epics are not supported.");
    if (frontMatter.parentFeatureId) throw new Error("Epics cannot belong to a feature.");
  }
  if (frontMatter.ticketType === "feature" && frontMatter.parentFeatureId) {
    throw new Error("Features cannot belong to another feature.");
  }
  if (frontMatter.ticketType === "draft_ticket") {
    if (frontMatter.parentEpicId || frontMatter.parentFeatureId) {
      throw new Error("Draft tickets cannot be linked to epics or features.");
    }
    if (frontMatter.subticketIds.length > 0) {
      throw new Error("Draft tickets cannot own child tickets.");
    }
  }
  if (frontMatter.ticketType === "task" && frontMatter.subticketIds.length > 0) {
    throw new Error("Only epic and feature tickets can own child tickets.");
  }
  if ((frontMatter.ticketType === "epic" || frontMatter.ticketType === "feature") && frontMatter.subticketIds.includes(frontMatter.id)) {
    throw new Error("A ticket cannot include itself as a child.");
  }
  if (frontMatter.blockedByIds.includes(frontMatter.id)) {
    throw new Error("A ticket cannot block itself.");
  }
};

const relativeMarkdownPath = (path: Path.Path, fromDirectory: string, toFile: string): string => {
  const relativePath = slashPath(path.relative(fromDirectory, toFile));
  if (relativePath.startsWith(".") || relativePath.startsWith("/")) return relativePath;
  return `./${relativePath}`;
};

export const listTicketReferenceCandidates = async (projectPath: string): Promise<TicketReferenceCandidate[]> => {
  const path = await backendPath();
  const resolvedProjectPath = resolveProjectPath(path, projectPath);
  const config = await readProjectConfig(resolvedProjectPath);
  const columnNames = new Map(config.columns.map((column) => [column.id, column.name]));
  const columnPositions = new Map(config.columns.map((column) => [column.id, column.position]));
  const { tickets } = await readTickets(resolvedProjectPath, config.columns);
  const ticketDirectory = ticketsPath(path, resolvedProjectPath);

  return [...tickets]
    .sort((a, b) => {
      const columnDelta = (columnPositions.get(a.status) ?? Number.MAX_SAFE_INTEGER) - (columnPositions.get(b.status) ?? Number.MAX_SAFE_INTEGER);
      if (columnDelta !== 0) return columnDelta;
      return a.position - b.position;
    })
    .map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      columnName: columnNames.get(ticket.status) ?? ticket.status,
      relativePath: slashPath(path.relative(resolvedProjectPath, ticket.filePath)),
      linkPath: relativeMarkdownPath(path, ticketDirectory, ticket.filePath)
    }));
};

export const readTicket = async (projectPath: string, ticketId: string): Promise<TicketRecord> => {
  const path = await backendPath();
  const resolvedProjectPath = resolveProjectPath(path, projectPath);
  const target = ticketPath(path, resolvedProjectPath, ticketId);
  try {
    return await readTicketFile(target);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      throw new TicketNotFoundError(resolvedProjectPath, ticketId, target, error);
    }
    throw error;
  }
};

const assertEpicTicket = async (projectPath: string, epicId: string): Promise<TicketRecord> => {
  const epic = await readTicket(projectPath, epicId);
  if (epic.frontMatter.ticketType !== "epic") {
    throw new Error(`Ticket ${epicId} is not an epic.`);
  }
  return epic;
};

const assertFeatureTicket = async (projectPath: string, featureId: string): Promise<TicketRecord> => {
  const feature = await readTicket(projectPath, featureId);
  if (feature.frontMatter.ticketType !== "feature") {
    throw new Error(`Ticket ${featureId} is not a feature.`);
  }
  return feature;
};

const addSubticketIdToEpic = (projectPath: string, epicId: string, ticketId: string): Promise<TicketRecord> =>
  addSubticketIdToParent(projectPath, epicId, ticketId, "epic");

const removeSubticketIdFromEpic = (projectPath: string, epicId: string, ticketId: string): Promise<TicketRecord | null> =>
  removeSubticketIdFromParent(projectPath, epicId, ticketId, "epic");

const addSubticketIdToFeature = (projectPath: string, featureId: string, ticketId: string): Promise<TicketRecord> =>
  addSubticketIdToParent(projectPath, featureId, ticketId, "feature");

const removeSubticketIdFromFeature = (projectPath: string, featureId: string, ticketId: string): Promise<TicketRecord | null> =>
  removeSubticketIdFromParent(projectPath, featureId, ticketId, "feature");

const addSubticketIdToParent = async (
  projectPath: string,
  parentId: string,
  ticketId: string,
  parentType: "epic" | "feature"
): Promise<TicketRecord> => {
  if (parentId === ticketId) {
    throw new Error("A ticket cannot include itself as a child.");
  }
  const parent =
    parentType === "epic" ? await assertEpicTicket(projectPath, parentId) : await assertFeatureTicket(projectPath, parentId);
  if (parent.frontMatter.subticketIds.includes(ticketId)) return parent;
  return writeTicket(projectPath, {
    ...parent,
    frontMatter: {
      ...parent.frontMatter,
      subticketIds: [...parent.frontMatter.subticketIds, ticketId]
    }
  });
};

const removeSubticketIdFromParent = async (
  projectPath: string,
  parentId: string,
  ticketId: string,
  parentType: "epic" | "feature"
): Promise<TicketRecord | null> => {
  try {
    const parent =
      parentType === "epic" ? await assertEpicTicket(projectPath, parentId) : await assertFeatureTicket(projectPath, parentId);
    if (!parent.frontMatter.subticketIds.includes(ticketId)) return parent;
    return writeTicket(projectPath, {
      ...parent,
      frontMatter: {
        ...parent.frontMatter,
        subticketIds: parent.frontMatter.subticketIds.filter((id) => id !== ticketId)
      }
    });
  } catch (error) {
    if (isTicketNotFoundError(error)) return null;
    throw error;
  }
};

const validateParentRelationships = async (projectPath: string, frontMatter: TicketFrontMatter): Promise<void> => {
  assertRelationshipShape(frontMatter);
  if (frontMatter.parentEpicId) {
    await assertEpicTicket(projectPath, frontMatter.parentEpicId);
  }
  if (frontMatter.parentFeatureId) {
    try {
      await assertFeatureTicket(projectPath, frontMatter.parentFeatureId);
    } catch (error) {
      if (!isTicketNotFoundError(error)) throw error;
    }
  }
};

const stringifyTicket = (ticket: TicketRecord): string => {
  const body = ticket.markdown.trimStart();
  return matter.stringify(body.endsWith("\n") ? body : `${body}\n`, ticket.frontMatter);
};

export const writeTicket = async (projectPath: string, ticket: TicketRecord): Promise<TicketRecord> => {
  const path = await backendPath();
  const target = ticketPath(path, projectPath, ticket.frontMatter.id);
  const frontMatter = normalizeFrontMatterRelationships(ticket.frontMatter);
  assertRelationshipShape(frontMatter);
  const next: TicketRecord = {
    ...ticket,
    filePath: target,
    checklist: extractTicketChecklist(ticket.markdown),
    frontMatter: {
      ...frontMatter,
      updatedAt: nowIso()
    }
  };
  await atomicWriteText(target, stringifyTicket(next));
  return next;
};

type TicketMarkdownDraft = TicketDraftSubticket & { research?: TicketDraft["research"] };

const markdownList = (items: readonly string[] | undefined): string => {
  if (!items) return "- None.";
  const cleaned = items.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.map((item) => `- ${item}`).join("\n") : "- None.";
};

const normalizePlannedFiles = (items: readonly string[] | undefined): string[] =>
  [...new Set((items ?? []).map((item) => item.trim()).filter(Boolean))];

const researchMetadataMarkdown = (research?: TicketDraftResearch): string => {
  if (
    !research ||
    (research.checkedUrls.length === 0 && research.inspectedFiles.length === 0 && research.limitations.length === 0)
  ) {
    return "- No research metadata recorded.";
  }
  const urls = research.checkedUrls.map((source) => {
    const title = source.title ? ` (${source.title})` : "";
    const reason = source.reason ? ` - ${source.reason}` : "";
    return `- URL ${source.status}: ${source.url}${title}; characters read: ${source.charactersRead}${reason}`;
  });
  const files = research.inspectedFiles.map((file) => {
    const symbols = file.symbols.length > 0 ? `; symbols: ${file.symbols.slice(0, 6).join(", ")}` : "";
    const matches =
      file.matches.length > 0 ? `\n  Matched lines:\n${file.matches.map((match) => `  - ${match}`).join("\n")}` : "";
    return `- File inspected: ${file.path} - ${file.reason}; characters read: ${file.charactersRead}${symbols}${matches}`;
  });
  const limitations = research.limitations.map((limitation) => `- Limitation: ${limitation}`);
  return [...urls, ...files, ...limitations].join("\n");
};

const draftGoal = (draft: TicketMarkdownDraft): string =>
  draft.requirements.find((item) => item.trim().length > 0) ?? `Deliver ${draft.title}.`;

const draftDecisionList = (draft: TicketMarkdownDraft): string[] => [
  ...(draft.assumptions ?? []),
  ...(draft.clarificationQuestions ?? [])
];

const draftImplementationNotes = (draft: TicketMarkdownDraft): string[] => [
  ...(draft.researchFindings ?? []).map((finding) => `Codebase finding: ${finding}`),
  ...(draft.implementationPlan ?? []).map((step) => `Implementation: ${step}`),
  ...(draft.implementationNotes ?? [])
];

export const ticketMarkdownFromDraft = (draft: TicketMarkdownDraft): string => {
  return `# ${draft.title}

## Context

${draft.context || "No additional context provided."}

## Goal

${draftGoal(draft)}

## Decisions / Assumptions

${markdownList(draftDecisionList(draft))}

## Requirements

${markdownList(draft.requirements)}

## Acceptance Criteria

${markdownList(draft.acceptanceCriteria)}

## Test Plan

${markdownList(draft.testPlan)}

## Implementation Notes

${markdownList(draftImplementationNotes(draft))}

## Codex Handoff

No Codex run has been started.
`;
};

export const ticketMarkdownFromLeanTaskDraft = (draft: LeanTaskDraft, parentTitle: string): string => `# ${draft.title}

## Context

Parent feature: ${parentTitle}

${draft.context || "No additional context provided."}

## Goal

${draft.goal || (draft.requirements.find((item) => item.trim().length > 0) ?? `Deliver ${draft.title}.`)}

## Requirements

${markdownList(draft.requirements)}

## Acceptance Criteria

${markdownList(draft.acceptanceCriteria)}

## Implementation Plan

${markdownList(draft.implementationPlan)}

## Assumptions

${markdownList(draft.assumptions)}

## Codex Handoff

No Codex run has been started.
`;

export const ticketMarkdownFromUserTaskInput = (
  title: string,
  description: string | undefined,
  parentFeatureTitle: string
): string => {
  const trimmedDescription = description?.trim();
  return `# ${title.trim()}

## Context

Parent feature: ${parentFeatureTitle}

${trimmedDescription || "No additional description provided."}

## Codex Handoff

No Codex run has been started.
`;
};

export const ticketMarkdownFromFeatureStubDraft = (draft: FeatureStubDraft, parentTitle: string): string => `# ${draft.title}

## Context

Parent epic: ${parentTitle}

${draft.context || "No additional context provided."}

## Requirements

${markdownList(draft.requirements)}

## Acceptance Criteria

${markdownList(draft.acceptanceCriteria)}

## Implementation Notes

${markdownList(draft.implementationNotes)}

## Codex Handoff

Feature planning ticket — tasks are created under this feature before Codex execution.
`;

export const ticketMarkdownFromSubticketDraft = (draft: TicketDraftSubticket, parentTitle: string): string => `# ${draft.title}

## Context

Parent: ${parentTitle}

${draft.context || "No additional context provided."}

## Goal

${draftGoal(draft)}

## Decisions / Assumptions

${markdownList(draftDecisionList(draft))}

## Requirements

${markdownList(draft.requirements)}

## Acceptance Criteria

${markdownList(draft.acceptanceCriteria)}

## Test Plan

${markdownList(draft.testPlan)}

## Implementation Notes

${markdownList(draftImplementationNotes(draft))}

## Codex Handoff

No Codex run has been started.
`;

const normalizeDraftIdea = (idea: string): string => idea.replace(/\s+/g, " ").trim();

const truncateTitle = (value: string, maxLength = 80): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
};

const pendingTicketDraftTitle = (idea: string, draftTargetType?: FinalTicketType | null): string => {
  const normalized = normalizeDraftIdea(idea).replace(/^#+\s*/, "");
  const fallback =
    draftTargetType === "epic"
      ? "Untitled epic draft"
      : "Untitled feature draft";
  return `Draft: ${truncateTitle(normalized || fallback)}`;
};

const plannedFilesForTaskOnlyDraft = (draft: TicketDraft): string[] => {
  const root = normalizePlannedFiles(draft.plannedFiles);
  if (root.length > 0) return root;
  for (const leanTask of draft.leanTasks) {
    const fromLean = normalizePlannedFiles(leanTask.plannedFiles);
    if (fromLean.length > 0) return fromLean;
  }
  return [];
};

const coerceTaskOnlyDraftToFeature = (draft: TicketDraft): TicketDraft => {
  if (draft.ticketType !== "task") return draft;
  const plannedFiles = plannedFilesForTaskOnlyDraft(draft);
  return {
    ...draft,
    ticketType: "feature",
    subtickets: [],
    featureStubs: [],
    leanTasks: [
      {
        title: draft.title,
        summary: draft.summary,
        priority: draft.priority,
        labels: draft.labels,
        context: draft.context,
        goal: draft.context,
        requirements: draft.requirements,
        acceptanceCriteria: draft.acceptanceCriteria,
        implementationPlan: draft.implementationPlan,
        assumptions: draft.assumptions,
        plannedFiles
      }
    ]
  };
};

const ticketMarkdownFromPendingDraft = (title: string, idea: string): string => `# ${title}

## Drafting State

The agent is drafting this ticket. The generated plan will replace this placeholder when the draft run completes.

## Original Idea

${idea.trim() || "No idea was provided."}

## Codex Handoff

Ticket draft generation is in progress.
`;

const ticketMarkdownFromDraftFailure = (title: string, idea: string, message: string): string => `# ${title}

## Drafting State

Agent ticket drafting failed. The original idea is preserved so this ticket can be edited manually or retried later.

## Recoverable Error

${message.trim() || "Ticket drafting failed."}

## Original Idea

${idea.trim() || "No idea was provided."}

## Codex Handoff

Ticket draft generation failed before a generated plan could be applied.
`;

const ticketMarkdownFromDraftClarification = (
  title: string,
  idea: string,
  questions: readonly string[],
  research?: TicketDraftResearch
): string => `# ${title}

## Drafting State

The agent researched this draft but needs user input before it can produce an implementation-ready ticket. Answer the clarification questions below; drafting will resume automatically once every question is answered.

## Original Idea

${idea.trim() || "No idea was provided."}

## Open Clarification Questions

${markdownList(questions)}

## Research Metadata

${researchMetadataMarkdown(research)}

## Codex Handoff

Ticket draft generation is blocked on clarification.
`;

const createSingleTicket = async (projectPath: string, input: TicketCreateInput): Promise<TicketRecord> => {
  const config = await readProjectConfig(projectPath);
  const status = input.status ?? "todo";
  if (!config.columns.some((column) => column.id === status)) {
    throw new Error(`Unknown ticket status: ${status}`);
  }
  const ticketType: TicketType = input.ticketType ?? "task";
  if (ticketType === "epic" && input.parentEpicId) {
    throw new Error("Nested epics are not supported.");
  }
  if (ticketType === "draft_ticket") {
    if (input.parentEpicId || input.parentFeatureId) {
      throw new Error("Draft tickets cannot be linked to epics or features.");
    }
  } else if (ticketType === "task" && !input.parentFeatureId && input.allowOrphanTask !== true) {
    throw new Error("Tasks must belong to a feature. Create tasks from a feature detail page.");
  } else if (ticketType === "task" && input.parentEpicId && input.allowOrphanTask !== true) {
    throw new Error("Tasks cannot be linked directly to epics. Link the task under a feature instead.");
  }
  const board = await readBoard(projectPath);
  const lastPosition = Math.max(0, ...board.tickets.filter((ticket) => ticket.status === status).map((ticket) => ticket.position));
  const createdAt = nowIso();
  const id = newId("tkt");
  const frontMatter: TicketFrontMatter = {
    schemaVersion: RELAY_SCHEMA_VERSION,
    id,
    title: input.title.trim(),
    ticketType,
    status,
    position: lastPosition + 1000,
    priority: input.priority,
    effort: input.effort ?? config.settings.defaultTicketEffort,
    labels: input.labels.map((label) => label.trim()).filter(Boolean),
    draftTargetType: ticketType === "draft_ticket" ? (input.draftTargetType ?? null) : null,
    parentEpicId:
      ticketType === "feature" ? input.parentEpicId ?? null : ticketType === "task" ? input.parentEpicId ?? null : null,
    parentFeatureId: ticketType === "task" ? input.parentFeatureId ?? null : null,
    subticketIds: [],
    plannedFiles: ticketType === "task" ? normalizePlannedFiles(input.plannedFiles) : [],
    blockedByIds: uniqueTicketIds(input.blockedByIds ?? []),
    relatedTicketIds: uniqueTicketIds(input.relatedTicketIds ?? []),
    createdAt,
    updatedAt: createdAt,
    authoringState: input.authoringState ?? "rough",
    summary: input.summary?.trim() ?? "",
    codexThreadId: null,
    runStatus: "idle",
    lastRunId: null,
    lastRunStartedAt: null
  };
  await validateParentRelationships(projectPath, frontMatter);
  const path = await backendPath();
  const ticket: TicketRecord = {
    frontMatter,
    markdown: input.markdown,
    filePath: ticketPath(path, projectPath, frontMatter.id),
    checklist: extractTicketChecklist(input.markdown)
  };
  return writeTicket(projectPath, ticket);
};

export const createPendingTicketDraft = async (
  projectPath: string,
  input: CreateDraftInput,
  runId: string
): Promise<TicketRecord> => {
  const idea = input.idea.trim();
  if (!idea) {
    throw new Error("Describe the ticket idea before drafting with the agent.");
  }

  const autoHierarchy = input.autoHierarchy === true;
  const draftTargetType: FinalTicketType =
    effectiveDraftPreferredTicketType(input.preferredTicketType) ?? "feature";
  const title = autoHierarchy
    ? `Draft: ${truncateTitle(normalizeDraftIdea(idea) || "Untitled")}`
    : pendingTicketDraftTitle(idea, draftTargetType);
  const placeholder = await createSingleTicket(projectPath, {
    title,
    priority: input.priority ?? "medium",
    effort: input.effort ?? "medium",
    labels: [],
    markdown: ticketMarkdownFromPendingDraft(title, idea),
    status: RELAY_TODO_STATUS,
    ticketType: "draft_ticket",
    draftTargetType,
    relatedTicketIds: input.relatedTicketIds
  });

  return writeTicket(projectPath, {
    ...placeholder,
    frontMatter: {
      ...placeholder.frontMatter,
      authoringState: "drafting",
      runStatus: "drafting",
      lastRunId: runId
    }
  });
};

const createEpicFeatureRecord = async (
  projectPath: string,
  epicId: string,
  input: SubticketCreateInput
): Promise<TicketRecord> => {
  await assertEpicTicket(projectPath, epicId);
  const child = await createSingleTicket(projectPath, {
    ...input,
    ticketType: "feature",
    parentEpicId: epicId,
    parentFeatureId: null,
    subtickets: []
  });
  await addSubticketIdToEpic(projectPath, epicId, child.frontMatter.id);
  return readTicket(projectPath, child.frontMatter.id);
};

const createTaskUnderFeatureRecord = async (
  projectPath: string,
  featureId: string,
  input: SubticketCreateInput | FeatureTaskCreateInput,
  markdown: string
): Promise<TicketRecord> => {
  const feature = await assertFeatureTicket(projectPath, featureId);
  const child = await createSingleTicket(projectPath, {
    title: input.title,
    priority: input.priority ?? "medium",
    effort: "effort" in input ? input.effort : undefined,
    labels: input.labels ?? [],
    plannedFiles: "plannedFiles" in input ? input.plannedFiles : undefined,
    markdown,
    status: "status" in input ? input.status : undefined,
    ticketType: "task",
    parentFeatureId: featureId,
    parentEpicId: null,
    subtickets: []
  });
  await addSubticketIdToFeature(projectPath, featureId, child.frontMatter.id);
  return readTicket(projectPath, child.frontMatter.id);
};

export const createTicket = async (projectPath: string, input: TicketCreateInput): Promise<TicketRecord> => {
  const subtickets = input.subtickets ?? [];
  const ticketType: TicketType = input.ticketType ?? "task";
  if (ticketType === "feature" && subtickets.length > 0) {
    throw new Error("Features cannot be created with nested subtickets in one request.");
  }
  if (ticketType !== "epic" && subtickets.length > 0) {
    throw new Error("Only epic tickets can be created with child stubs in one request.");
  }
  const ticket = await createSingleTicket(projectPath, {
    ...input,
    ticketType,
    subtickets: [],
    subticketIds: [],
    allowOrphanTask:
      input.allowOrphanTask ??
      (ticketType === "task" && !input.parentFeatureId
        ? process.env.RELAY_TEST_RUN === "1"
          ? true
          : false
        : undefined)
  });

  if (ticket.frontMatter.parentEpicId && ticket.frontMatter.ticketType === "feature") {
    await addSubticketIdToEpic(projectPath, ticket.frontMatter.parentEpicId, ticket.frontMatter.id);
  }

  for (const subticket of subtickets) {
    await createEpicFeatureRecord(projectPath, ticket.frontMatter.id, subticket);
  }

  return readTicket(projectPath, ticket.frontMatter.id);
};

export const applyTicketDraftToTicket = async (
  projectPath: string,
  ticketId: string,
  draft: TicketDraft,
  runId: string
): Promise<TicketRecord> => {
  const normalizedDraft = coerceTaskOnlyDraftToFeature(draft);
  const existing = await readTicket(projectPath, ticketId);
  const updated = await writeTicket(projectPath, {
    ...existing,
    markdown: ticketMarkdownFromDraft(normalizedDraft),
    frontMatter: {
      ...existing.frontMatter,
      title: normalizedDraft.title.trim(),
      ticketType: normalizedDraft.ticketType,
      draftTargetType: null,
      priority: normalizedDraft.priority,
      labels: normalizedDraft.labels.map((label) => label.trim()).filter(Boolean),
      summary: normalizedDraft.summary.trim(),
      parentEpicId: null,
      subticketIds: [],
      authoringState: "reviewing",
      runStatus: "draft_complete",
      lastRunId: runId
    }
  });

  if (normalizedDraft.ticketType === "epic") {
    for (const featureStub of normalizedDraft.featureStubs) {
      await createEpicFeatureRecord(projectPath, updated.frontMatter.id, {
        title: featureStub.title,
        summary: featureStub.summary,
        priority: featureStub.priority,
        effort: updated.frontMatter.effort,
        labels: featureStub.labels,
        markdown: ticketMarkdownFromFeatureStubDraft(featureStub, normalizedDraft.title)
      });
    }
    for (const subticket of normalizedDraft.subtickets) {
      await createEpicFeatureRecord(projectPath, updated.frontMatter.id, {
        title: subticket.title,
        summary: subticket.summary,
        priority: subticket.priority,
        effort: updated.frontMatter.effort,
        labels: subticket.labels,
        markdown: ticketMarkdownFromFeatureStubDraft(
          {
            title: subticket.title,
            summary: subticket.summary,
            priority: subticket.priority,
            labels: subticket.labels,
            context: subticket.context,
            requirements: subticket.requirements,
            acceptanceCriteria: subticket.acceptanceCriteria,
            implementationNotes: subticket.implementationNotes ?? []
          },
          normalizedDraft.title
        )
      });
    }
  }

  if (normalizedDraft.ticketType === "feature") {
    for (const leanTask of normalizedDraft.leanTasks) {
      await createTaskUnderFeatureRecord(
        projectPath,
        updated.frontMatter.id,
        {
          title: leanTask.title,
          summary: leanTask.summary,
          priority: leanTask.priority,
          labels: leanTask.labels,
          plannedFiles: leanTask.plannedFiles
        },
        ticketMarkdownFromLeanTaskDraft(leanTask, normalizedDraft.title)
      );
    }
  }

  return readTicket(projectPath, updated.frontMatter.id);
};

export const applyImplementationScopeRedraftToTicket = async (
  projectPath: string,
  ticketId: string,
  draft: TicketDraft,
  runId: string
): Promise<TicketRecord> => {
  if (draft.ticketType !== "task") {
    throw new Error("Implementation scope redraft must return a task draft.");
  }

  const plannedFiles = normalizePlannedFiles(draft.plannedFiles);
  if (plannedFiles.length === 0) {
    throw new Error("Implementation scope redraft must include at least one planned file path.");
  }

  const existing = await readTicket(projectPath, ticketId);
  const clarifications = await readClarificationQuestions(projectPath, ticketId);
  const hasOpenClarifications = clarifications.some((question) => !question.answer?.trim());

  return writeTicket(projectPath, {
    ...existing,
    markdown: ticketMarkdownFromDraft(draft),
    frontMatter: {
      ...existing.frontMatter,
      title: draft.title.trim(),
      priority: draft.priority,
      labels: draft.labels.map((label) => label.trim()).filter(Boolean),
      summary: draft.summary.trim(),
      plannedFiles,
      authoringState: hasOpenClarifications ? "needs_input" : "ready",
      runStatus: "idle",
      codexThreadId: null,
      lastRunId: runId
    }
  });
};

const emptyTicketDraftResearch = (): TicketDraftResearch => ({
  generatedAt: "",
  checkedUrls: [],
  inspectedFiles: [],
  limitations: [],
  limits: {
    maxResearchMs: 0,
    maxUrls: 0,
    maxUrlFetchMs: 0,
    maxUrlContentChars: 0,
    maxFilesToScan: 0,
    maxFilesToRead: 0,
    maxFileReadChars: 0,
    maxMatchesPerFile: 0
  }
});

const leanTaskToFeatureRoot = (leanTask: LeanTaskDraft): TicketDraftSubticket => ({
  title: leanTask.title,
  summary: leanTask.summary,
  priority: leanTask.priority,
  labels: leanTask.labels,
  context: leanTask.context || leanTask.goal,
  researchFindings: [],
  requirements: leanTask.requirements.length > 0 ? leanTask.requirements : leanTask.goal ? [leanTask.goal] : [],
  implementationPlan: [],
  testPlan: [],
  acceptanceCriteria: leanTask.acceptanceCriteria,
  clarificationQuestions: [],
  assumptions: leanTask.assumptions,
  implementationNotes: []
});

type LegacyStandaloneHierarchyPlan = Omit<HierarchyDraftPlan, "planKind" | "root" | "leanTasks"> & {
  planKind: "standalone_task";
  standaloneTask?: LeanTaskDraft;
  root?: TicketDraftSubticket;
  leanTasks?: readonly LeanTaskDraft[];
};

const normalizeHierarchyDraftPlanForApply = (plan: HierarchyDraftPlan | LegacyStandaloneHierarchyPlan): HierarchyDraftPlan => {
  if (plan.planKind !== "standalone_task") return plan;
  const standalone = plan.standaloneTask;
  if (!standalone) throw new Error("Standalone task plan is missing standaloneTask.");
  return {
    ...plan,
    planKind: "feature_tree",
    root: plan.root ?? leanTaskToFeatureRoot(standalone),
    leanTasks: plan.leanTasks && plan.leanTasks.length > 0 ? [...plan.leanTasks] : [standalone]
  };
};

const patchTicketBlockedByIds = async (
  projectPath: string,
  ticketId: string,
  blockedByIds: readonly string[]
): Promise<TicketRecord> => {
  const existing = await readTicket(projectPath, ticketId);
  return writeTicket(projectPath, {
    ...existing,
    frontMatter: {
      ...existing.frontMatter,
      blockedByIds: uniqueTicketIds([...blockedByIds])
    }
  });
};

const logLeanTaskDependencyWarnings = async (
  warnings: readonly string[],
  context: { featureId: string; planKind: string }
): Promise<void> => {
  for (const warning of warnings) {
    await logWarn("hierarchy:lean-task-deps", warning, context);
  }
};

const createLeanTasksUnderFeatureWithDependencies = async (
  projectPath: string,
  featureId: string,
  featureTitle: string,
  leanTasks: readonly LeanTaskDraft[],
  planKind: string
): Promise<void> => {
  const created: TicketRecord[] = [];
  for (const leanTask of leanTasks) {
    created.push(
      await createTaskUnderFeatureRecord(
        projectPath,
        featureId,
        {
          title: leanTask.title,
          summary: leanTask.summary,
          priority: leanTask.priority,
          labels: leanTask.labels,
          plannedFiles: leanTask.plannedFiles
        },
        ticketMarkdownFromLeanTaskDraft(leanTask, featureTitle)
      )
    );
  }

  if (created.length === 0) return;

  const titleToIdMap = buildLeanTaskTitleToIdMap(
    created.map((record) => ({ title: record.frontMatter.title, id: record.frontMatter.id }))
  );
  const resolutions = resolveLeanTaskBlockedByTitles(leanTasks, titleToIdMap);
  await logLeanTaskDependencyWarnings(resolutions.warnings, { featureId, planKind });

  for (const record of created) {
    const resolution = resolutions.byNormalizedTitle.get(normalizeLeanTaskTitle(record.frontMatter.title));
    if (!resolution || resolution.blockedByIds.length === 0) continue;
    await patchTicketBlockedByIds(projectPath, record.frontMatter.id, resolution.blockedByIds);
  }
};

const applyFeatureTreePlan = async (
  projectPath: string,
  placeholderTicketId: string,
  root: TicketDraftSubticket,
  leanTasks: readonly LeanTaskDraft[],
  runId: string
): Promise<string> => {
  const featureDraft = hierarchyRootAsTicketDraft(root, "feature");
  const feature = await applyDraftedTicketFrontMatter(projectPath, placeholderTicketId, featureDraft, runId, { finalizeDraft: false });
  await createLeanTasksUnderFeatureWithDependencies(
    projectPath,
    feature.frontMatter.id,
    feature.frontMatter.title,
    leanTasks,
    "feature_tree"
  );
  await finalizeDraftedHierarchyRoot(projectPath, feature.frontMatter.id, runId);
  return feature.frontMatter.id;
};

const hierarchyRootAsTicketDraft = (root: TicketDraftSubticket, ticketType: TicketType): TicketDraft => ({
  ...root,
  draftState: "ready",
  blockingClarificationQuestions: [],
  ticketType,
  subtickets: [],
  featureStubs: [],
  leanTasks: [],
  research: emptyTicketDraftResearch()
});

const applyDraftedTicketFrontMatter = async (
  projectPath: string,
  ticketId: string,
  draft: TicketDraft,
  runId: string,
  options?: {
    parentEpicId?: string | null;
    parentFeatureId?: string | null;
    allowOrphanTask?: boolean;
    finalizeDraft?: boolean;
  }
): Promise<TicketRecord> => {
  const existing = await readTicket(projectPath, ticketId);
  const finalizeDraft = options?.finalizeDraft ?? true;
  return writeTicket(projectPath, {
    ...existing,
    markdown: ticketMarkdownFromDraft(draft),
    frontMatter: {
      ...existing.frontMatter,
      title: draft.title.trim(),
      ticketType: draft.ticketType,
      draftTargetType: null,
      priority: draft.priority,
      labels: draft.labels.map((label) => label.trim()).filter(Boolean),
      summary: draft.summary.trim(),
      parentEpicId: options?.parentEpicId ?? null,
      parentFeatureId: options?.parentFeatureId ?? null,
      subticketIds: [],
      authoringState: finalizeDraft ? "reviewing" : existing.frontMatter.authoringState,
      runStatus: finalizeDraft ? "draft_complete" : existing.frontMatter.runStatus,
      lastRunId: runId
    }
  });
};

const finalizeDraftedHierarchyRoot = async (projectPath: string, ticketId: string, runId: string): Promise<TicketRecord> => {
  const ticket = await readTicket(projectPath, ticketId);
  return writeTicket(projectPath, {
    ...ticket,
    frontMatter: {
      ...ticket.frontMatter,
      authoringState: "reviewing",
      runStatus: "draft_complete",
      lastRunId: runId
    }
  });
};

export const applyHierarchyDraftPlan = async (
  projectPath: string,
  placeholderTicketId: string,
  plan: HierarchyDraftPlan | LegacyStandaloneHierarchyPlan,
  runId: string
): Promise<string> => {
  const normalizedPlan = normalizeHierarchyDraftPlanForApply(plan);
  switch (normalizedPlan.planKind) {
    case "feature_tree": {
      if (!normalizedPlan.root) throw new Error("Feature tree plan is missing root.");
      return applyFeatureTreePlan(projectPath, placeholderTicketId, normalizedPlan.root, normalizedPlan.leanTasks, runId);
    }
    case "epic_tree": {
      if (!normalizedPlan.root) throw new Error("Epic tree plan is missing root.");
      const epicDraft = hierarchyRootAsTicketDraft(normalizedPlan.root, "epic");
      const epic = await applyDraftedTicketFrontMatter(projectPath, placeholderTicketId, epicDraft, runId, { finalizeDraft: false });
      for (const featurePlan of normalizedPlan.features) {
        const featureRecord = await createEpicFeatureRecord(projectPath, epic.frontMatter.id, {
          title: featurePlan.stub.title,
          summary: featurePlan.stub.summary,
          priority: featurePlan.stub.priority,
          effort: epic.frontMatter.effort,
          labels: featurePlan.stub.labels,
          markdown: ticketMarkdownFromFeatureStubDraft(featurePlan.stub, epic.frontMatter.title)
        });
        await createLeanTasksUnderFeatureWithDependencies(
          projectPath,
          featureRecord.frontMatter.id,
          featureRecord.frontMatter.title,
          featurePlan.leanTasks,
          "epic_tree"
        );
      }
      await finalizeDraftedHierarchyRoot(projectPath, epic.frontMatter.id, runId);
      return epic.frontMatter.id;
    }
    case "extend_epic": {
      if (!normalizedPlan.root) throw new Error("Extend epic plan is missing root.");
      const epicId = normalizedPlan.matchedEpicId?.trim();
      if (!epicId) throw new Error("Extend epic plan requires matchedEpicId.");
      const featureDraft = hierarchyRootAsTicketDraft(normalizedPlan.root, "feature");
      const feature = await applyDraftedTicketFrontMatter(projectPath, placeholderTicketId, featureDraft, runId, {
        parentEpicId: epicId,
        finalizeDraft: false
      });
      await linkSubticket(projectPath, epicId, feature.frontMatter.id);
      await createLeanTasksUnderFeatureWithDependencies(
        projectPath,
        feature.frontMatter.id,
        feature.frontMatter.title,
        normalizedPlan.leanTasks,
        "extend_epic"
      );
      await finalizeDraftedHierarchyRoot(projectPath, feature.frontMatter.id, runId);
      return feature.frontMatter.id;
    }
    case "extend_feature": {
      const featureId = normalizedPlan.matchedFeatureId?.trim();
      if (!featureId) throw new Error("Extend feature plan requires matchedFeatureId.");
      const feature = await readTicket(projectPath, featureId);
      const leanTasks = normalizedPlan.extendFeature?.leanTasks ?? [];
      await deleteTicket(projectPath, placeholderTicketId);
      await createLeanTasksUnderFeatureWithDependencies(
        projectPath,
        featureId,
        feature.frontMatter.title,
        leanTasks,
        "extend_feature"
      );
      return featureId;
    }
    default: {
      const unsupported: string = plan.planKind;
      throw new Error(`Unsupported hierarchy plan kind: ${unsupported}`);
    }
  }
};

export const failPendingTicketDraft = async (
  projectPath: string,
  ticketId: string,
  idea: string,
  runId: string,
  message: string
): Promise<TicketRecord> => {
  const existing = await readTicket(projectPath, ticketId);
  return writeTicket(projectPath, {
    ...existing,
    markdown: ticketMarkdownFromDraftFailure(existing.frontMatter.title, idea, message),
    frontMatter: {
      ...existing.frontMatter,
      authoringState: "rough",
      runStatus: "draft_failed",
      lastRunId: runId
    }
  });
};

export const blockPendingTicketDraftForClarification = async (
  projectPath: string,
  ticketId: string,
  idea: string,
  runId: string,
  questions: readonly string[],
  research?: TicketDraftResearch
): Promise<TicketRecord> => {
  const existing = await readTicket(projectPath, ticketId);
  const config = await readProjectConfig(projectPath);
  const status = config.columns.some((column) => column.id === RELAY_NEEDS_CLARIFICATION_STATUS)
    ? RELAY_NEEDS_CLARIFICATION_STATUS
    : existing.frontMatter.status;
  return writeTicket(projectPath, {
    ...existing,
    markdown: ticketMarkdownFromDraftClarification(existing.frontMatter.title, idea, questions, research),
    frontMatter: {
      ...existing.frontMatter,
      status,
      authoringState: "needs_input",
      runStatus: "blocked",
      lastRunId: runId
    }
  });
};

export const createSubticket = async ({ projectPath, epicId, ticket }: EpicSubticketCreateInput): Promise<TicketRecord> =>
  createEpicFeatureRecord(projectPath, epicId, ticket);

export const createEpicFeature = async ({ projectPath, epicId, ticket }: EpicFeatureCreateInput): Promise<TicketRecord> =>
  createEpicFeatureRecord(projectPath, epicId, ticket);

export const createTaskUnderFeature = async ({
  projectPath,
  featureId,
  input
}: {
  projectPath: string;
  featureId: string;
  input: FeatureTaskCreateInput;
}): Promise<TicketRecord> => {
  const feature = await assertFeatureTicket(projectPath, featureId);
  return createTaskUnderFeatureRecord(
    projectPath,
    featureId,
    input,
    ticketMarkdownFromUserTaskInput(input.title, input.description, feature.frontMatter.title)
  );
};

export const createFeatureSubticket = async ({ projectPath, featureId, ticket }: FeatureSubticketCreateInput): Promise<TicketRecord> =>
  createTaskUnderFeatureRecord(projectPath, featureId, ticket, ticket.markdown);

export const linkSubticket = async (projectPath: string, epicId: string, ticketId: string): Promise<BoardSnapshot> => {
  if (epicId === ticketId) {
    throw new Error("An epic cannot include itself as a child.");
  }
  await assertEpicTicket(projectPath, epicId);
  const child = await readTicket(projectPath, ticketId);
  if (child.frontMatter.ticketType === "epic") {
    throw new Error("Nested epics are not supported.");
  }
  if (child.frontMatter.ticketType === "task") {
    const epic = await readTicket(projectPath, epicId);
    const isLegacyLink = epic.frontMatter.subticketIds.includes(ticketId) && child.frontMatter.parentEpicId === epicId;
    if (!isLegacyLink) {
      throw new Error("Epics can only link feature tickets. Link tasks under a feature instead.");
    }
  }
  if (child.frontMatter.ticketType !== "feature" && child.frontMatter.ticketType !== "task") {
    throw new Error("Epics can only link feature tickets.");
  }
  if (child.frontMatter.parentEpicId && child.frontMatter.parentEpicId !== epicId) {
    await removeSubticketIdFromEpic(projectPath, child.frontMatter.parentEpicId, ticketId);
  }
  await writeTicket(projectPath, {
    ...child,
    frontMatter: {
      ...child.frontMatter,
      parentEpicId: child.frontMatter.ticketType === "feature" ? epicId : child.frontMatter.parentEpicId,
      parentFeatureId: child.frontMatter.ticketType === "task" ? child.frontMatter.parentFeatureId : null,
      subticketIds: []
    }
  });
  await addSubticketIdToEpic(projectPath, epicId, ticketId);
  return readBoard(projectPath);
};

export const linkFeatureSubticket = async (projectPath: string, featureId: string, ticketId: string): Promise<BoardSnapshot> => {
  if (featureId === ticketId) {
    throw new Error("A feature cannot include itself as a child.");
  }
  await assertFeatureTicket(projectPath, featureId);
  const child = await readTicket(projectPath, ticketId);
  if (child.frontMatter.ticketType !== "task") {
    throw new Error("Features can only link task tickets.");
  }
  if (child.frontMatter.parentFeatureId && child.frontMatter.parentFeatureId !== featureId) {
    await removeSubticketIdFromFeature(projectPath, child.frontMatter.parentFeatureId, ticketId);
  }
  const feature = await readTicket(projectPath, featureId);
  await writeTicket(projectPath, {
    ...child,
    frontMatter: {
      ...child.frontMatter,
      parentFeatureId: featureId,
      parentEpicId: feature.frontMatter.parentEpicId,
      subticketIds: []
    }
  });
  await addSubticketIdToFeature(projectPath, featureId, ticketId);
  return readBoard(projectPath);
};

export const unlinkSubticket = async (projectPath: string, epicId: string, ticketId: string): Promise<BoardSnapshot> => {
  await assertEpicTicket(projectPath, epicId);
  const child = await readTicket(projectPath, ticketId);
  if (child.frontMatter.parentEpicId === epicId && child.frontMatter.ticketType === "feature") {
    await writeTicket(projectPath, {
      ...child,
      frontMatter: {
        ...child.frontMatter,
        parentEpicId: null
      }
    });
  }
  await removeSubticketIdFromEpic(projectPath, epicId, ticketId);
  return readBoard(projectPath);
};

export const unlinkFeatureSubticket = async (_projectPath: string, _featureId: string, _ticketId: string): Promise<BoardSnapshot> => {
  throw new Error("Tasks must stay linked to a feature. Delete the task or link it under another feature instead of unlinking.");
};

const calculatePosition = (tickets: TicketSummary[], targetStatus: string, beforeId?: string | null, afterId?: string | null): number => {
  const targetTickets = tickets
    .filter((ticket) => ticket.status === targetStatus && ticket.id !== beforeId && ticket.id !== afterId)
    .sort((a, b) => a.position - b.position);
  const before = beforeId ? tickets.find((ticket) => ticket.id === beforeId) : null;
  const after = afterId ? tickets.find((ticket) => ticket.id === afterId) : null;

  if (before && after) return (before.position + after.position) / 2;
  if (before) return before.position - 1000;
  if (after) return after.position + 1000;
  return (targetTickets.at(-1)?.position ?? 0) + 1000;
};

export type StatusTransitionOptions = {
  actor: RelayActor;
  source: RelayEventSource;
  runId?: string | null;
  beforeTicketId?: string | null;
  afterTicketId?: string | null;
};

export const transitionTicketStatus = async (
  projectPath: string,
  ticketId: string,
  targetStatus: string,
  options: StatusTransitionOptions
): Promise<TicketRecord> => {
  const config = await readProjectConfig(projectPath);
  if (!config.columns.some((column) => column.id === targetStatus)) {
    throw new Error(`Unknown ticket status: ${targetStatus}`);
  }

  const board = await readBoard(projectPath);
  const record = await readTicket(projectPath, ticketId);
  if (record.frontMatter.ticketType === "epic" || record.frontMatter.ticketType === "feature") {
    const allowedContainerStatuses = new Set([RELAY_REVIEW_STATUS, RELAY_COMPLETED_STATUS, RELAY_ARCHIVE_STATUS]);
    if (options.source === "archive_queue") {
      allowedContainerStatuses.add(RELAY_READY_STATUS);
    }
    if (options.source === "archive_processing") {
      allowedContainerStatuses.add(RELAY_IN_PROGRESS_STATUS);
    }
    if (!allowedContainerStatuses.has(targetStatus)) {
      throw new Error(
        "Epic and feature tickets can only move to Review, Completed, or Archive. Move child tasks between columns instead."
      );
    }
  }
  const fromStatus = record.frontMatter.status;
  const position =
    fromStatus === targetStatus
      ? record.frontMatter.position
      : calculatePosition(board.tickets, targetStatus, options.beforeTicketId, options.afterTicketId);

  const updated = await writeTicket(projectPath, {
    ...record,
    frontMatter: {
      ...record.frontMatter,
      status: targetStatus,
      position
    }
  });

  if (fromStatus !== targetStatus) {
    await appendAuditEvent(projectPath, {
      actor: options.actor,
      source: options.source,
      eventType: "ticket.status_changed",
      ticketId,
      runId: options.runId ?? null,
      payload: {
        fromStatus,
        toStatus: targetStatus,
        position
      }
    });
  }

  return updated;
};

export const setTicketQueued = async (projectPath: string, ticketId: string, runId: string): Promise<TicketRecord> => {
  const config = await readProjectConfig(projectPath);
  const current = await readTicket(projectPath, ticketId);
  const targetStatus = config.columns.some((column) => column.id === RELAY_READY_STATUS)
    ? RELAY_READY_STATUS
    : current.frontMatter.status;
  const queuedInLane =
    current.frontMatter.status === targetStatus
      ? current
      : await transitionTicketStatus(projectPath, ticketId, targetStatus, {
          actor: "codex",
          source: "agent_execution",
          runId
        });

  return writeTicket(projectPath, {
    ...queuedInLane,
    frontMatter: {
      ...queuedInLane.frontMatter,
      authoringState: "ready",
      runStatus: "queued",
      lastRunId: runId
    }
  });
};

export const setTicketQueuedInPlace = async (projectPath: string, ticketId: string, runId: string): Promise<TicketRecord> => {
  const current = await readTicket(projectPath, ticketId);
  return writeTicket(projectPath, {
    ...current,
    frontMatter: {
      ...current.frontMatter,
      authoringState: "ready",
      runStatus: "queued",
      lastRunId: runId
    }
  });
};

export const clearQueuedTicket = async (
  projectPath: string,
  ticketId: string,
  targetStatus?: string | null,
  expectedRunId?: string | null
): Promise<TicketRecord> => {
  const current = await readTicket(projectPath, ticketId);
  if (current.frontMatter.runStatus !== "queued") return current;
  if (expectedRunId && current.frontMatter.lastRunId !== expectedRunId) return current;

  const runId = current.frontMatter.lastRunId;
  const cleared = await writeTicket(projectPath, {
    ...current,
    frontMatter: {
      ...current.frontMatter,
      authoringState: "reviewing",
      runStatus: "idle",
      lastRunId: null
    }
  });

  if (!targetStatus || cleared.frontMatter.status === targetStatus) return cleared;
  const config = await readProjectConfig(projectPath);
  if (!config.columns.some((column) => column.id === targetStatus)) return cleared;
  return transitionTicketStatus(projectPath, ticketId, targetStatus, {
    actor: "system",
    source: "system_reconciliation",
    runId
  });
};

export const listQueuedReadyTickets = async (projectPath: string): Promise<TicketSummary[]> => {
  const board = await readBoard(projectPath);
  return board.tickets
    .filter(
      (ticket) =>
        (ticket.status === RELAY_READY_STATUS || ticket.status === RELAY_IN_PROGRESS_STATUS) &&
        ticket.runStatus === "queued" &&
        Boolean(ticket.lastRunId)
    )
    .sort((a, b) => a.position - b.position);
};

export const saveTicket = async (input: TicketSaveInput): Promise<TicketRecord> => {
  const config = await readProjectConfig(input.projectPath);
  const targetStatus = input.ticket.frontMatter.status;
  if (!config.columns.some((column) => column.id === targetStatus)) {
    throw new Error(`Unknown ticket status: ${targetStatus}`);
  }

  const existing = await readTicket(input.projectPath, input.ticket.frontMatter.id);
  const normalizedFrontMatter = normalizeFrontMatterRelationships(input.ticket.frontMatter);
  await validateParentRelationships(input.projectPath, normalizedFrontMatter);
  const statusChanged = existing.frontMatter.status !== targetStatus;
  let position = input.ticket.frontMatter.position;
  if (statusChanged) {
    const board = await readBoard(input.projectPath);
    position = calculatePosition(board.tickets, targetStatus);
  }

  const updated = await writeTicket(input.projectPath, {
    ...input.ticket,
    frontMatter: {
      ...normalizedFrontMatter,
      position
    }
  });

  if (existing.frontMatter.parentEpicId && existing.frontMatter.parentEpicId !== updated.frontMatter.parentEpicId) {
    await removeSubticketIdFromEpic(input.projectPath, existing.frontMatter.parentEpicId, updated.frontMatter.id);
  }
  if (updated.frontMatter.parentEpicId && existing.frontMatter.parentEpicId !== updated.frontMatter.parentEpicId) {
    await addSubticketIdToEpic(input.projectPath, updated.frontMatter.parentEpicId, updated.frontMatter.id);
  }

  if (statusChanged) {
    await appendAuditEvent(input.projectPath, {
      actor: "user",
      source: "manual_ticket_edit",
      eventType: "ticket.status_changed",
      ticketId: updated.frontMatter.id,
      runId: updated.frontMatter.lastRunId,
      payload: {
        fromStatus: existing.frontMatter.status,
        toStatus: targetStatus,
        position
      }
    });
  }

  return updated;
};

export const moveTicket = async (input: TicketMoveInput): Promise<BoardSnapshot> => {
  const updated = await transitionTicketStatus(input.projectPath, input.ticketId, input.targetStatus, {
    actor: "user",
    source: "manual_board",
    beforeTicketId: input.beforeTicketId,
    afterTicketId: input.afterTicketId
  });
  if (updated.frontMatter.ticketType === "task" && !input.suppressContainerReconciliation) {
    const { maybePromoteOrDemoteContainers } = await import("./boardReconciliation");
    await maybePromoteOrDemoteContainers(input.projectPath, input.ticketId);
  }
  return readBoard(input.projectPath);
};

const writeClarificationQuestions = async (
  projectPath: string,
  ticketId: string,
  questions: ClarificationQuestion[]
): Promise<ClarificationQuestion[]> => {
  const store: ClarificationQuestionStore = {
    schemaVersion: RELAY_SCHEMA_VERSION,
    ticketId,
    questions
  };
  const path = await backendPath();
  await atomicWriteJson(clarificationStorePath(path, projectPath, ticketId), store);
  return questions;
};

export const readClarificationQuestions = async (projectPath: string, ticketId: string): Promise<ClarificationQuestion[]> => {
  const path = await backendPath();
  const target = clarificationStorePath(path, projectPath, ticketId);
  const raw = await runBackendEffect(
    FileSystem.FileSystem.use((fs) =>
      fs.readFileString(target, "utf8").pipe(
        Effect.catchIf(isFileNotFoundError, () => Effect.succeed(null as string | null))
      )
    )
  );
  if (raw === null) return [];
  const parsed = parseSchema(clarificationStoreSchema, JSON.parse(raw));
  return parsed.questions;
};

export const emptyRepositoryChatStore = (): RepositoryChatStore => ({
  schemaVersion: RELAY_SCHEMA_VERSION,
  threadId: null,
  messages: [],
  draft: ""
});

export const readRepositoryChat = async (projectPath: string): Promise<RepositoryChatStore> => {
  const path = await backendPath();
  const target = repositoryChatPath(path, projectPath);
  const raw = await runBackendEffect(
    FileSystem.FileSystem.use((fs) =>
      fs.readFileString(target, "utf8").pipe(
        Effect.catchIf(isFileNotFoundError, () => Effect.succeed(null as string | null))
      )
    )
  );
  if (raw === null) return emptyRepositoryChatStore();
  return parseSchema(repositoryChatStoreSchema, JSON.parse(raw));
};

export const saveRepositoryChat = async (projectPath: string, store: RepositoryChatStore): Promise<RepositoryChatStore> => {
  const path = await backendPath();
  const normalized = parseSchema(repositoryChatStoreSchema, {
    schemaVersion: RELAY_SCHEMA_VERSION,
    threadId: store.threadId ?? null,
    messages: store.messages,
    draft: store.draft ?? ""
  });
  await atomicWriteJson(repositoryChatPath(path, projectPath), normalized);
  return normalized;
};

export const clearRepositoryChat = async (projectPath: string): Promise<RepositoryChatStore> =>
  saveRepositoryChat(projectPath, emptyRepositoryChatStore());

export type ClarificationQuestionCreateOptions = {
  readonly actor: RelayActor;
  readonly source: RelayEventSource;
  readonly runId?: string | null;
  readonly codexThreadId?: string | null;
};

export const createClarificationQuestions = async (
  projectPath: string,
  ticketId: string,
  inputs: ClarificationQuestionCreateInput[],
  options: ClarificationQuestionCreateOptions
): Promise<ClarificationQuestion[]> => {
  await readTicket(projectPath, ticketId);
  const existing = await readClarificationQuestions(projectPath, ticketId);
  const now = nowIso();
  const created = inputs
    .map((input) => ({
      question: input.question.trim(),
      answerType: input.answerType ?? "text"
    }))
    .filter((input) => input.question.length > 0)
    .map((input): ClarificationQuestion => ({
      id: newId("clar"),
      ticketId,
      question: input.question,
      answerType: input.answerType,
      answer: null,
      createdAt: now,
      updatedAt: now,
      answeredAt: null,
      createdBy: options.actor,
      source: options.source,
      runId: options.runId ?? null,
      codexThreadId: options.codexThreadId ?? null
    }));

  if (created.length === 0) return [];

  await writeClarificationQuestions(projectPath, ticketId, [...existing, ...created]);
  for (const question of created) {
    await appendAuditEvent(projectPath, {
      actor: options.actor,
      source: options.source,
      eventType: "clarification.question_created",
      ticketId,
      runId: options.runId ?? null,
      payload: {
        questionId: question.id,
        question: question.question,
        answerType: question.answerType
      }
    });
  }
  return created;
};

export const answerClarificationQuestion = async (
  projectPath: string,
  ticketId: string,
  questionId: string,
  answer: string
): Promise<ClarificationQuestion> => {
  const trimmed = answer.trim();
  if (!trimmed) throw new Error("Clarification answer cannot be empty.");
  await logInfo("ticket:clarification", "clarification answer saved", { projectPath, ticketId, questionId });

  const questions = await readClarificationQuestions(projectPath, ticketId);
  const target = questions.find((question) => question.id === questionId);
  if (!target) throw new Error(`Unknown clarification question: ${questionId}`);

  const now = nowIso();
  const updated: ClarificationQuestion = {
    ...target,
    answer: trimmed,
    answeredAt: now,
    updatedAt: now
  };
  const nextQuestions = questions.map((question) => (question.id === questionId ? updated : question));
  await writeClarificationQuestions(projectPath, ticketId, nextQuestions);
  if (nextQuestions.every((question) => question.answer?.trim())) {
    const ticket = await readTicket(projectPath, ticketId);
    if (ticket.frontMatter.authoringState === "needs_input") {
      await writeTicket(projectPath, {
        ...ticket,
        frontMatter: {
          ...ticket.frontMatter,
          authoringState: "reviewing"
        }
      });
    }
  }
  await appendAuditEvent(projectPath, {
    actor: "user",
    source: "clarification_ui",
    eventType: "clarification.answer_submitted",
    ticketId,
    runId: target.runId,
    payload: {
      questionId,
      answer: trimmed
    }
  });
  return updated;
};

const unlinkTicketRelationshipsBeforeDelete = async (projectPath: string, ticket: TicketRecord): Promise<void> => {
  if (ticket.frontMatter.parentEpicId) {
    await removeSubticketIdFromEpic(projectPath, ticket.frontMatter.parentEpicId, ticket.frontMatter.id);
  }
  if (ticket.frontMatter.parentFeatureId) {
    await removeSubticketIdFromFeature(projectPath, ticket.frontMatter.parentFeatureId, ticket.frontMatter.id);
  }
};

const collectFeatureChildTaskIds = (feature: TicketRecord, records: readonly TicketRecord[]): string[] =>
  uniqueTicketIds([
    ...feature.frontMatter.subticketIds,
    ...records
      .filter((record) => record.frontMatter.parentFeatureId === feature.frontMatter.id)
      .map((record) => record.frontMatter.id)
  ]);

const collectEpicDescendantIds = (
  epic: TicketRecord,
  records: readonly TicketRecord[]
): { featureIds: string[]; taskIds: string[] } => {
  const epicId = epic.frontMatter.id;
  const featureIds = uniqueTicketIds([
    ...epic.frontMatter.subticketIds.filter((childId) => {
      const child = records.find((record) => record.frontMatter.id === childId);
      return child?.frontMatter.ticketType === "feature";
    }),
    ...records
      .filter((record) => record.frontMatter.parentEpicId === epicId && record.frontMatter.ticketType === "feature")
      .map((record) => record.frontMatter.id)
  ]);
  const taskIds = uniqueTicketIds([
    ...records
      .filter((record) => record.frontMatter.parentEpicId === epicId && record.frontMatter.ticketType === "task")
      .map((record) => record.frontMatter.id),
    ...records
      .filter((record) => record.frontMatter.parentFeatureId && featureIds.includes(record.frontMatter.parentFeatureId))
      .map((record) => record.frontMatter.id),
    ...featureIds.flatMap((featureId) => {
      const feature = records.find((record) => record.frontMatter.id === featureId);
      return feature ? collectFeatureChildTaskIds(feature, records) : [];
    })
  ]);
  return { featureIds, taskIds };
};

const trashTicketFile = async (projectPath: string, ticketId: string): Promise<void> => {
  const path = await backendPath();
  const source = ticketPath(path, projectPath, ticketId);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(trashPath(path, projectPath), stamp, `${ticketId}.md`);
  await runBackendEffect(
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.rename(source, target);
    })
  );
};

const deleteTicketWithoutCascade = async (projectPath: string, ticketId: string): Promise<void> => {
  const ticket = await readTicket(projectPath, ticketId);
  await unlinkTicketRelationshipsBeforeDelete(projectPath, ticket);
  await trashTicketFile(projectPath, ticketId);
};

export const deleteTicket = async (projectPath: string, ticketId: string): Promise<BoardSnapshot> => {
  const ticket = await readTicket(projectPath, ticketId);
  const config = await readProjectConfig(projectPath);
  const { records } = await readTickets(projectPath, config.columns);

  if (ticket.frontMatter.ticketType === "epic") {
    const { featureIds, taskIds } = collectEpicDescendantIds(ticket, records);
    for (const childTaskId of taskIds) {
      try {
        await deleteTicketWithoutCascade(projectPath, childTaskId);
      } catch (error) {
        if (!isTicketNotFoundError(error)) throw error;
      }
    }
    for (const childFeatureId of featureIds) {
      try {
        await deleteTicketWithoutCascade(projectPath, childFeatureId);
      } catch (error) {
        if (!isTicketNotFoundError(error)) throw error;
      }
    }
  } else if (ticket.frontMatter.ticketType === "feature") {
    for (const childTaskId of collectFeatureChildTaskIds(ticket, records)) {
      try {
        await deleteTicketWithoutCascade(projectPath, childTaskId);
      } catch (error) {
        if (!isTicketNotFoundError(error)) throw error;
      }
    }
  }

  await deleteTicketWithoutCascade(projectPath, ticketId);
  return readBoard(projectPath);
};

export const duplicateTicket = async (projectPath: string, ticketId: string): Promise<TicketRecord> => {
  const source = await readTicket(projectPath, ticketId);
  return createSingleTicket(projectPath, {
    title: `${source.frontMatter.title} Copy`,
    priority: source.frontMatter.priority,
    effort: source.frontMatter.effort,
    labels: source.frontMatter.labels,
    markdown: source.markdown,
    status: source.frontMatter.status,
    ticketType: source.frontMatter.ticketType,
    parentEpicId: source.frontMatter.parentEpicId,
    parentFeatureId: source.frontMatter.parentFeatureId,
    blockedByIds: source.frontMatter.blockedByIds,
    allowOrphanTask: source.frontMatter.ticketType === "task" && !source.frontMatter.parentFeatureId
  });
};

export const revealTicketFile = async (projectPath: string, ticketId: string): Promise<void> => {
  const path = await backendPath();
  showElectronItemInFolder(ticketPath(path, projectPath, ticketId));
};

export const appendCodexHandoff = (markdown: string, handoff: string): string => {
  const marker = "## Codex Handoff";
  const entry = `\n\n### ${new Date().toLocaleString()}\n\n${handoff.trim()}\n`;
  if (!markdown.includes(marker)) {
    return `${markdown.trimEnd()}\n\n${marker}${entry}`;
  }
  return markdown.replace(marker, `${marker}${entry}`);
};
