import { Schema } from "effect";
import { mutableArray, numberSchema, type SchemaType } from "./common";

export const agentProviderIdSchema = Schema.Literals(["codex", "cursor", "claude"]);
export type AgentProviderId = SchemaType<typeof agentProviderIdSchema>;

export const localVoiceBackendSchema = Schema.Literals(["whisper.cpp", "whisper"]);
export type LocalVoiceBackend = SchemaType<typeof localVoiceBackendSchema>;

/** Cursor agent CLI `--model` values supported by Relay (extend when Composer etc. are wired). */
export const cursorAgentModelSchema = Schema.Literals(["auto"]);
export type CursorAgentModel = SchemaType<typeof cursorAgentModelSchema>;

export const agentProviderInstallStateSchema = Schema.Literals(["installed", "not_installed", "unknown"]);
export type AgentProviderInstallState = SchemaType<typeof agentProviderInstallStateSchema>;

export const agentProviderAuthStateSchema = Schema.Literals(["authenticated", "unauthenticated", "unknown"]);
export type AgentProviderAuthState = SchemaType<typeof agentProviderAuthStateSchema>;

export const agentProviderStatusSchema = Schema.Literals(["ready", "unavailable", "unauthenticated", "unknown"]);
export type AgentProviderStatus = SchemaType<typeof agentProviderStatusSchema>;

export const providerSwitchErrorCodeSchema = Schema.Literals([
  "busy",
  "provider_unavailable",
  "provider_unauthenticated",
  "provider_status_unknown"
]);
export type ProviderSwitchErrorCode = SchemaType<typeof providerSwitchErrorCodeSchema>;

export const providerSwitchabilitySchema = Schema.Struct({
  canSwitch: Schema.Boolean,
  reasonCode: Schema.NullOr(providerSwitchErrorCodeSchema),
  message: Schema.NullOr(Schema.String),
  blockingWorkCount: numberSchema
});
export type ProviderSwitchability = SchemaType<typeof providerSwitchabilitySchema>;

export const agentProviderRecordSchema = Schema.Struct({
  id: agentProviderIdSchema,
  label: Schema.String,
  installState: agentProviderInstallStateSchema,
  authState: agentProviderAuthStateSchema,
  status: agentProviderStatusSchema,
  message: Schema.String,
  version: Schema.NullOr(Schema.String),
  canSelect: Schema.Boolean,
  blockedReasonCode: Schema.NullOr(providerSwitchErrorCodeSchema),
  blockedReasonMessage: Schema.NullOr(Schema.String)
});
export type AgentProviderRecord = SchemaType<typeof agentProviderRecordSchema>;

export const agentProviderInventorySchema = Schema.Struct({
  providers: mutableArray(agentProviderRecordSchema),
  selectedProviderId: agentProviderIdSchema,
  switchability: providerSwitchabilitySchema
});
export type AgentProviderInventory = SchemaType<typeof agentProviderInventorySchema>;

export const agentProviderSwitchInputSchema = Schema.Struct({
  providerId: agentProviderIdSchema
});
export type AgentProviderSwitchInput = SchemaType<typeof agentProviderSwitchInputSchema>;

export const agentProviderSwitchResultSchema = Schema.Union([
  Schema.Struct({
    ok: Schema.Literal(true),
    selectedProviderId: agentProviderIdSchema,
    inventory: agentProviderInventorySchema
  }),
  Schema.Struct({
    ok: Schema.Literal(false),
    code: providerSwitchErrorCodeSchema,
    message: Schema.String,
    selectedProviderId: agentProviderIdSchema
  })
]);
export type AgentProviderSwitchResult = SchemaType<typeof agentProviderSwitchResultSchema>;

export const localVoiceInputStatusSchema = Schema.Struct({
  available: Schema.Boolean,
  backend: Schema.NullOr(localVoiceBackendSchema),
  command: Schema.NullOr(Schema.String),
  configuredCommandPath: Schema.NullOr(Schema.String),
  defaultCommandPath: Schema.String,
  message: Schema.String
});
export type LocalVoiceInputStatus = SchemaType<typeof localVoiceInputStatusSchema>;

export const localVoiceInputConfigSchema = Schema.Struct({
  commandPath: Schema.String
});
export type LocalVoiceInputConfig = SchemaType<typeof localVoiceInputConfigSchema>;

export const localVoiceInputTranscriptionRequestSchema = Schema.Struct({
  audioBase64: Schema.String
});
export type LocalVoiceInputTranscriptionRequest = SchemaType<typeof localVoiceInputTranscriptionRequestSchema>;

export const localVoiceInputTranscriptionResultSchema = Schema.Struct({
  transcript: Schema.String
});
export type LocalVoiceInputTranscriptionResult = SchemaType<typeof localVoiceInputTranscriptionResultSchema>;
