import { Schema } from "effect";
import { cursorAgentModelSchema } from "./agents";
import {
  mutableArray,
  nonEmptyString,
  nullableStringWithDefault,
  numberSchema,
  passthroughStruct,
  strictStruct,
  stringArrayWithDefault,
  withDefault,
  isoString,
  type SchemaType
} from "./common";
import {
  draftScopeSchema,
  draftPlanKindSchema,
  type DraftPlanKind,
  runStatusSchema,
  ticketAuthoringStateSchema,
  ticketEffortSchema,
  ticketPrioritySchema,
  finalTicketTypeSchema,
  ticketTypeSchema,
  type FinalTicketType,
  type TicketType
} from "./primitives";

const ticketFrontMatterFields = {
  schemaVersion: Schema.Literal(1),
  id: nonEmptyString,
  title: nonEmptyString,
  ticketType: withDefault(ticketTypeSchema, () => "task" as const),
  draftTargetType: Schema.optional(Schema.NullOr(finalTicketTypeSchema)),
  status: nonEmptyString,
  position: numberSchema,
  priority: ticketPrioritySchema,
  effort: withDefault(ticketEffortSchema, () => "medium" as const),
  labels: stringArrayWithDefault(),
  parentEpicId: nullableStringWithDefault(),
  parentFeatureId: nullableStringWithDefault(),
  subticketIds: stringArrayWithDefault(),
  plannedFiles: stringArrayWithDefault(),
  blockedByIds: stringArrayWithDefault(),
  relatedTicketIds: stringArrayWithDefault(),
  createdAt: isoString,
  updatedAt: isoString,
  authoringState: withDefault(ticketAuthoringStateSchema, () => "rough" as const),
  summary: withDefault(Schema.String, () => ""),
  codexThreadId: nullableStringWithDefault(),
  runStatus: runStatusSchema,
  lastRunId: nullableStringWithDefault(),
  lastRunStartedAt: nullableStringWithDefault()
} as const;

export const ticketFrontMatterSchema = passthroughStruct(ticketFrontMatterFields);
export type TicketFrontMatter = SchemaType<typeof ticketFrontMatterSchema>;

export const ticketChecklistSummarySchema = Schema.Struct({
  total: withDefault(numberSchema, () => 0),
  completed: withDefault(numberSchema, () => 0),
  open: withDefault(numberSchema, () => 0)
});
export type TicketChecklistSummary = SchemaType<typeof ticketChecklistSummarySchema>;

export const ticketRecordSchema = Schema.Struct({
  frontMatter: ticketFrontMatterSchema,
  markdown: Schema.String,
  filePath: Schema.String,
  checklist: withDefault(ticketChecklistSummarySchema, () => ({ total: 0, completed: 0, open: 0 }))
});
export type TicketRecord = SchemaType<typeof ticketRecordSchema>;

export const ticketSummarySchema = passthroughStruct({
  ...ticketFrontMatterFields,
  excerpt: Schema.String,
  filePath: Schema.String,
  checklist: withDefault(ticketChecklistSummarySchema, () => ({ total: 0, completed: 0, open: 0 }))
});
export type TicketSummary = SchemaType<typeof ticketSummarySchema>;

export const ticketReferenceCandidateSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  status: Schema.String,
  columnName: Schema.String,
  relativePath: Schema.String,
  linkPath: Schema.String
});
export type TicketReferenceCandidate = SchemaType<typeof ticketReferenceCandidateSchema>;

const defaultTicketDraftResearchLimits = () => ({
  maxResearchMs: 0,
  maxUrls: 0,
  maxUrlFetchMs: 0,
  maxUrlContentChars: 0,
  maxFilesToScan: 0,
  maxFilesToRead: 0,
  maxFileReadChars: 0,
  maxMatchesPerFile: 0
});

const defaultTicketDraftResearch = () => ({
  generatedAt: "",
  checkedUrls: [],
  inspectedFiles: [],
  limitations: [],
  limits: defaultTicketDraftResearchLimits()
});

const ticketDraftResearchLimitsSchema = Schema.Struct({
  maxResearchMs: numberSchema,
  maxUrls: numberSchema,
  maxUrlFetchMs: numberSchema,
  maxUrlContentChars: numberSchema,
  maxFilesToScan: numberSchema,
  maxFilesToRead: numberSchema,
  maxFileReadChars: numberSchema,
  maxMatchesPerFile: numberSchema
});
export type TicketDraftResearchLimits = SchemaType<typeof ticketDraftResearchLimitsSchema>;

const ticketDraftResearchUrlSchema = Schema.Struct({
  url: Schema.String,
  status: Schema.Literals(["fetched", "failed", "skipped"]),
  title: nullableStringWithDefault(),
  reason: nullableStringWithDefault(),
  charactersRead: withDefault(numberSchema, () => 0)
});
export type TicketDraftResearchUrl = SchemaType<typeof ticketDraftResearchUrlSchema>;

const ticketDraftResearchFileSchema = Schema.Struct({
  path: Schema.String,
  reason: Schema.String,
  symbols: stringArrayWithDefault(),
  matches: stringArrayWithDefault(),
  charactersRead: withDefault(numberSchema, () => 0)
});
export type TicketDraftResearchFile = SchemaType<typeof ticketDraftResearchFileSchema>;

const ticketDraftResearchSchema = Schema.Struct({
  generatedAt: withDefault(Schema.String, () => ""),
  checkedUrls: withDefault(mutableArray(ticketDraftResearchUrlSchema), () => []),
  inspectedFiles: withDefault(mutableArray(ticketDraftResearchFileSchema), () => []),
  limitations: stringArrayWithDefault(),
  limits: withDefault(ticketDraftResearchLimitsSchema, defaultTicketDraftResearchLimits)
});
export type TicketDraftResearch = SchemaType<typeof ticketDraftResearchSchema>;

const repoRelativePathSchema = nonEmptyString.check(
  Schema.makeFilter((value: string) => {
    if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) {
      return "Expected an exact repo-relative file path.";
    }
    if (value.includes("\\") || /\/{2,}/.test(value)) {
      return "Expected forward-slash repo-relative paths without duplicate separators.";
    }
    return undefined;
  })
);

const ticketDraftBaseFields = {
  title: nonEmptyString,
  summary: withDefault(Schema.String, () => ""),
  priority: ticketPrioritySchema,
  labels: stringArrayWithDefault(),
  context: withDefault(Schema.String, () => ""),
  researchFindings: stringArrayWithDefault(),
  requirements: stringArrayWithDefault(),
  implementationPlan: stringArrayWithDefault(),
  testPlan: stringArrayWithDefault(),
  acceptanceCriteria: stringArrayWithDefault(),
  clarificationQuestions: stringArrayWithDefault(),
  assumptions: stringArrayWithDefault(),
  implementationNotes: stringArrayWithDefault(),
  plannedFiles: withDefault(mutableArray(repoRelativePathSchema), () => [])
} as const;

const ticketDraftBaseSchema = strictStruct(ticketDraftBaseFields);
export type TicketDraftSubticket = SchemaType<typeof ticketDraftBaseSchema>;

const nonEmptyRepoRelativePathArraySchema = mutableArray(repoRelativePathSchema).pipe(
  Schema.check(Schema.makeFilter((items: readonly string[]) => (items.length > 0 ? undefined : "Expected at least one planned file path.")))
);

export const leanTaskDraftSchema = strictStruct({
  title: nonEmptyString,
  summary: withDefault(Schema.String, () => ""),
  priority: ticketPrioritySchema,
  labels: stringArrayWithDefault(),
  context: withDefault(Schema.String, () => ""),
  goal: withDefault(Schema.String, () => ""),
  requirements: stringArrayWithDefault(),
  acceptanceCriteria: stringArrayWithDefault(),
  implementationPlan: stringArrayWithDefault(),
  assumptions: stringArrayWithDefault(),
  plannedFiles: nonEmptyRepoRelativePathArraySchema,
  blockedByTitles: stringArrayWithDefault()
});
export type LeanTaskDraft = SchemaType<typeof leanTaskDraftSchema>;

export const featureStubDraftSchema = strictStruct({
  title: nonEmptyString,
  summary: withDefault(Schema.String, () => ""),
  priority: ticketPrioritySchema,
  labels: stringArrayWithDefault(),
  context: withDefault(Schema.String, () => ""),
  requirements: stringArrayWithDefault(),
  acceptanceCriteria: stringArrayWithDefault(),
  implementationNotes: stringArrayWithDefault()
});
export type FeatureStubDraft = SchemaType<typeof featureStubDraftSchema>;

export const ticketDraftSchema = strictStruct({
  ...ticketDraftBaseFields,
  draftState: withDefault(Schema.Literals(["ready", "needs_clarification"]), () => "ready" as const),
  blockingClarificationQuestions: stringArrayWithDefault(),
  ticketType: withDefault(finalTicketTypeSchema, () => "feature" as const),
  subtickets: withDefault(mutableArray(ticketDraftBaseSchema), () => []),
  featureStubs: withDefault(mutableArray(featureStubDraftSchema), () => []),
  leanTasks: withDefault(mutableArray(leanTaskDraftSchema), () => []),
  research: withDefault(ticketDraftResearchSchema, defaultTicketDraftResearch)
}).check(
  Schema.makeFilter((draft: { readonly ticketType: TicketType; readonly subtickets: readonly unknown[]; readonly featureStubs: readonly unknown[]; readonly leanTasks: readonly unknown[] }) => {
    if (draft.ticketType === "task" && (draft.subtickets.length > 0 || draft.featureStubs.length > 0 || draft.leanTasks.length > 0)) {
      return { path: ["subtickets"], issue: "Task drafts cannot contain child tickets." };
    }
    if (draft.ticketType === "feature" && draft.subtickets.length > 0) {
      return { path: ["subtickets"], issue: "Feature drafts use leanTasks, not legacy subtickets." };
    }
    if (draft.ticketType === "epic" && (draft.leanTasks.length > 0 || draft.subtickets.length > 0)) {
      return { path: ["featureStubs"], issue: "Epic drafts use featureStubs only." };
    }
    return undefined;
  })
);
export type TicketDraft = SchemaType<typeof ticketDraftSchema>;
export type TaskPlanDraft = TicketDraftSubticket;
export type EpicPlanDraft = TicketDraft & { ticketType: "epic" };
export type FeaturePlanDraft = TicketDraft & { ticketType: "feature" };

export const ticketDraftErrorPayloadSchema = Schema.Struct({
  code: Schema.Literals([
    "codex_unavailable",
    "codex_unauthenticated",
    "timeout",
    "cancelled",
    "clarification_required",
    "cursor_incomplete_result",
    "invalid_response",
    "backend_failure"
  ]),
  message: Schema.String,
  recoverable: Schema.Boolean,
  requestId: Schema.String,
  durationMs: numberSchema,
  reason: Schema.String,
  timeoutMs: Schema.optional(numberSchema)
});
export type TicketDraftErrorPayload = SchemaType<typeof ticketDraftErrorPayloadSchema>;
export type TicketDraftErrorCode = TicketDraftErrorPayload["code"];

export const ticketDraftResultSchema = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), draft: ticketDraftSchema }),
  Schema.Struct({ ok: Schema.Literal(false), error: ticketDraftErrorPayloadSchema })
]);
export type TicketDraftResult = SchemaType<typeof ticketDraftResultSchema>;

export const ticketDraftStartResultSchema = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), ticket: ticketRecordSchema, runId: Schema.String }),
  Schema.Struct({ ok: Schema.Literal(false), error: ticketDraftErrorPayloadSchema })
]);
export type TicketDraftStartResult = SchemaType<typeof ticketDraftStartResultSchema>;

export const agentTicketUpdateSchema = strictStruct({
  title: nonEmptyString,
  priority: ticketPrioritySchema,
  labels: stringArrayWithDefault(),
  authoringState: Schema.Literals(["rough", "reviewing", "needs_input", "ready"]),
  plannedFiles: Schema.optional(Schema.NullOr(mutableArray(repoRelativePathSchema))),
  patch: strictStruct({
    summary: nonEmptyString,
    fullMarkdown: Schema.optional(Schema.NullOr(Schema.String)),
    appendMarkdown: Schema.optional(Schema.NullOr(Schema.String))
  }),
  clarificationQuestions: stringArrayWithDefault()
});
export type AgentTicketUpdate = SchemaType<typeof agentTicketUpdateSchema>;

export const agentTicketUpdateStartResultSchema = Schema.Struct({
  runId: Schema.String,
  threadId: Schema.String
});
export type AgentTicketUpdateStartResult = SchemaType<typeof agentTicketUpdateStartResultSchema>;

const draftIntakeQuestionFields = {
  question: nonEmptyString,
  whyItMatters: nonEmptyString,
  recommendedAnswer: nonEmptyString
} as const;

export const draftIntakeQuestionSchema = strictStruct(draftIntakeQuestionFields);
export type DraftIntakeQuestion = SchemaType<typeof draftIntakeQuestionSchema>;

export const draftIntakeAnswerSchema = passthroughStruct({
  question: nonEmptyString,
  answer: nonEmptyString,
  whyItMatters: Schema.optional(Schema.NullOr(Schema.String)),
  recommendedAnswer: Schema.optional(Schema.NullOr(Schema.String))
});
export type DraftIntakeAnswer = SchemaType<typeof draftIntakeAnswerSchema>;

export const draftIntakeInputSchema = passthroughStruct({
  projectPath: Schema.String,
  idea: Schema.String,
  scopeOverride: Schema.optional(draftScopeSchema),
  effort: Schema.optional(ticketEffortSchema),
  agentModel: Schema.optional(cursorAgentModelSchema),
  autoHierarchy: Schema.optional(Schema.Boolean)
});
export type DraftIntakeInput = SchemaType<typeof draftIntakeInputSchema>;

export const draftIntakeResultSchema = strictStruct({
  scope: draftScopeSchema,
  planKind: draftPlanKindSchema,
  confidence: numberSchema,
  estimatedTouchPoints: withDefault(numberSchema, () => 0),
  rationale: withDefault(Schema.String, () => ""),
  matchedEpicId: nullableStringWithDefault(),
  matchedFeatureId: nullableStringWithDefault(),
  knownFacts: stringArrayWithDefault(),
  relatedTicketIds: stringArrayWithDefault(),
  questions: withDefault(mutableArray(draftIntakeQuestionSchema), () => [])
});
export type DraftIntakeResult = SchemaType<typeof draftIntakeResultSchema>;

export const hierarchyDraftFeaturePlanSchema = strictStruct({
  stub: featureStubDraftSchema,
  leanTasks: withDefault(mutableArray(leanTaskDraftSchema), () => [])
});

export const hierarchyDraftExtendFeatureSchema = strictStruct({
  leanTasks: withDefault(mutableArray(leanTaskDraftSchema), () => [])
});

export const hierarchyDraftPlanSchema = strictStruct({
  planKind: draftPlanKindSchema,
  draftState: withDefault(Schema.Literals(["ready", "needs_clarification"]), () => "ready" as const),
  blockingClarificationQuestions: stringArrayWithDefault(),
  matchedEpicId: nullableStringWithDefault(),
  matchedFeatureId: nullableStringWithDefault(),
  root: Schema.optional(ticketDraftBaseSchema),
  features: withDefault(mutableArray(hierarchyDraftFeaturePlanSchema), () => []),
  leanTasks: withDefault(mutableArray(leanTaskDraftSchema), () => []),
  extendFeature: Schema.optional(hierarchyDraftExtendFeatureSchema),
  research: withDefault(ticketDraftResearchSchema, defaultTicketDraftResearch)
}).check(
  Schema.makeFilter((plan: { readonly planKind: DraftPlanKind; readonly features: readonly unknown[]; readonly leanTasks: readonly unknown[] }) => {
    if (plan.planKind === "feature_tree" && plan.features.length > 0) {
      return { path: ["features"], issue: "Feature tree plans use leanTasks on the root feature." };
    }
    if (plan.planKind === "epic_tree" && plan.leanTasks.length > 0) {
      return { path: ["leanTasks"], issue: "Epic tree plans use features with nested lean tasks." };
    }
    if ((plan.planKind === "extend_epic" || plan.planKind === "extend_feature") && plan.features.length > 0) {
      return { path: ["features"], issue: "Extend plans cannot include epic feature stubs." };
    }
    return undefined;
  })
);
export type HierarchyDraftPlan = SchemaType<typeof hierarchyDraftPlanSchema>;
export type HierarchyDraftFeaturePlan = SchemaType<typeof hierarchyDraftFeaturePlanSchema>;

const subticketCreateInputFields = {
  title: Schema.String,
  summary: Schema.optional(Schema.String),
  priority: ticketPrioritySchema,
  effort: Schema.optional(ticketEffortSchema),
  labels: stringArrayWithDefault(),
  markdown: Schema.String,
  status: Schema.optional(Schema.String),
  plannedFiles: Schema.optional(mutableArray(repoRelativePathSchema)),
  blockedByIds: Schema.optional(mutableArray(Schema.String)),
  relatedTicketIds: Schema.optional(mutableArray(Schema.String)),
  authoringState: Schema.optional(ticketAuthoringStateSchema)
} as const;

export const subticketCreateInputSchema = passthroughStruct(subticketCreateInputFields);
export type SubticketCreateInput = SchemaType<typeof subticketCreateInputSchema>;

export const ticketCreateInputSchema = passthroughStruct({
  ...subticketCreateInputFields,
  ticketType: Schema.optional(ticketTypeSchema),
  draftTargetType: Schema.optional(Schema.NullOr(finalTicketTypeSchema)),
  parentEpicId: Schema.optional(Schema.NullOr(Schema.String)),
  parentFeatureId: Schema.optional(Schema.NullOr(Schema.String)),
  subticketIds: Schema.optional(mutableArray(Schema.String)),
  subtickets: Schema.optional(mutableArray(subticketCreateInputSchema)),
  allowOrphanTask: Schema.optional(Schema.Boolean)
});
export type TicketCreateInput = SchemaType<typeof ticketCreateInputSchema>;

export const epicSubticketCreateInputSchema = passthroughStruct({
  projectPath: Schema.String,
  epicId: Schema.String,
  ticket: subticketCreateInputSchema
});
export type EpicSubticketCreateInput = SchemaType<typeof epicSubticketCreateInputSchema>;

export const epicSubticketLinkInputSchema = passthroughStruct({
  projectPath: Schema.String,
  epicId: Schema.String,
  ticketId: Schema.String
});
export type EpicSubticketLinkInput = SchemaType<typeof epicSubticketLinkInputSchema>;
export type EpicSubticketUnlinkInput = EpicSubticketLinkInput;

export const featureTaskCreateInputSchema = passthroughStruct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  priority: Schema.optional(ticketPrioritySchema),
  effort: Schema.optional(ticketEffortSchema),
  labels: Schema.optional(stringArrayWithDefault()),
  plannedFiles: Schema.optional(mutableArray(repoRelativePathSchema)),
  status: Schema.optional(Schema.String)
});
export type FeatureTaskCreateInput = SchemaType<typeof featureTaskCreateInputSchema>;

export const featureTaskCreateRequestSchema = passthroughStruct({
  projectPath: Schema.String,
  featureId: Schema.String,
  input: featureTaskCreateInputSchema
});
export type FeatureTaskCreateRequest = SchemaType<typeof featureTaskCreateRequestSchema>;

export const featureSubticketCreateInputSchema = passthroughStruct({
  projectPath: Schema.String,
  featureId: Schema.String,
  ticket: subticketCreateInputSchema
});
export type FeatureSubticketCreateInput = SchemaType<typeof featureSubticketCreateInputSchema>;

export const featureSubticketLinkInputSchema = passthroughStruct({
  projectPath: Schema.String,
  featureId: Schema.String,
  ticketId: Schema.String
});
export type FeatureSubticketLinkInput = SchemaType<typeof featureSubticketLinkInputSchema>;
export type FeatureSubticketUnlinkInput = FeatureSubticketLinkInput;

export const epicFeatureCreateInputSchema = passthroughStruct({
  projectPath: Schema.String,
  epicId: Schema.String,
  ticket: subticketCreateInputSchema
});
export type EpicFeatureCreateInput = SchemaType<typeof epicFeatureCreateInputSchema>;

export const ticketSaveInputSchema = passthroughStruct({
  projectPath: Schema.String,
  ticket: ticketRecordSchema
});
export type TicketSaveInput = SchemaType<typeof ticketSaveInputSchema>;

export const ticketAttachmentSaveInputSchema = passthroughStruct({
  projectPath: Schema.String,
  fileName: Schema.String,
  mimeType: Schema.optional(Schema.NullOr(Schema.String)),
  contentBase64: Schema.String
});
export type TicketAttachmentSaveInput = SchemaType<typeof ticketAttachmentSaveInputSchema>;

export const ticketAttachmentSaveResultSchema = Schema.Struct({
  fileName: Schema.String,
  markdownPath: Schema.String,
  absolutePath: Schema.String
});
export type TicketAttachmentSaveResult = SchemaType<typeof ticketAttachmentSaveResultSchema>;

export const ticketMoveInputSchema = passthroughStruct({
  projectPath: Schema.String,
  ticketId: Schema.String,
  targetStatus: Schema.String,
  beforeTicketId: Schema.optional(Schema.NullOr(Schema.String)),
  afterTicketId: Schema.optional(Schema.NullOr(Schema.String)),
  suppressContainerReconciliation: Schema.optional(Schema.Boolean)
});
export type TicketMoveInput = SchemaType<typeof ticketMoveInputSchema>;

export const createDraftInputSchema = passthroughStruct({
  projectPath: Schema.String,
  idea: Schema.String,
  priority: Schema.optional(ticketPrioritySchema),
  effort: Schema.optional(ticketEffortSchema),
  agentModel: Schema.optional(cursorAgentModelSchema),
  preferredTicketType: Schema.optional(finalTicketTypeSchema),
  ticketId: Schema.optional(Schema.String),
  draftScope: Schema.optional(draftScopeSchema),
  planKind: Schema.optional(draftPlanKindSchema),
  matchedEpicId: Schema.optional(Schema.NullOr(Schema.String)),
  matchedFeatureId: Schema.optional(Schema.NullOr(Schema.String)),
  autoHierarchy: Schema.optional(Schema.Boolean),
  runIntake: Schema.optional(Schema.Boolean),
  intakeAnswers: Schema.optional(mutableArray(draftIntakeAnswerSchema)),
  intakeKnownFacts: Schema.optional(mutableArray(Schema.String)),
  relatedTicketIds: Schema.optional(mutableArray(Schema.String))
});
export type CreateDraftInput = SchemaType<typeof createDraftInputSchema>;

export const ticketRedraftPurposeSchema = Schema.Literals(["default", "implementation_scope"]);
export type TicketRedraftPurpose = SchemaType<typeof ticketRedraftPurposeSchema>;

export const ticketRedraftInputSchema = passthroughStruct({
  projectPath: Schema.String,
  ticketId: Schema.String,
  purpose: Schema.optional(ticketRedraftPurposeSchema),
  clarificationQuestionId: Schema.optional(Schema.String),
  idea: Schema.optional(Schema.String),
  priority: Schema.optional(ticketPrioritySchema),
  effort: Schema.optional(ticketEffortSchema),
  preferredTicketType: Schema.optional(finalTicketTypeSchema),
  draftScope: Schema.optional(draftScopeSchema),
  runIntake: Schema.optional(Schema.Boolean),
  intakeAnswers: Schema.optional(mutableArray(draftIntakeAnswerSchema)),
  intakeKnownFacts: Schema.optional(mutableArray(Schema.String)),
  relatedTicketIds: Schema.optional(mutableArray(Schema.String))
});
export type TicketRedraftInput = SchemaType<typeof ticketRedraftInputSchema>;

export const agentTicketUpdateInputSchema = passthroughStruct({
  projectPath: Schema.String,
  ticketId: Schema.String,
  request: Schema.String,
  purpose: Schema.optional(Schema.Literals(["default", "scope_recovery", "archive"])),
  clarificationQuestionId: Schema.optional(Schema.String)
});
export type AgentTicketUpdateInput = SchemaType<typeof agentTicketUpdateInputSchema>;

export const approveScopeClarificationInputSchema = passthroughStruct({
  projectPath: Schema.String,
  ticketId: Schema.String,
  clarificationQuestionId: Schema.String
});
export type ApproveScopeClarificationInput = SchemaType<typeof approveScopeClarificationInputSchema>;
