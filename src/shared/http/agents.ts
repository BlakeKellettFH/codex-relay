import {
  agentProviderInventorySchema,
  localVoiceInputConfigSchema,
  localVoiceInputStatusSchema,
  localVoiceInputTranscriptionRequestSchema,
  localVoiceInputTranscriptionResultSchema,
  agentProviderSwitchInputSchema,
  agentProviderSwitchResultSchema
} from "../schemas";
import { defineEndpoint } from "./contract";

export const agentEndpoints = {
  providers: defineEndpoint({
    method: "GET",
    path: "/api/agents/providers",
    response: agentProviderInventorySchema
  }),
  switchProvider: defineEndpoint({
    method: "POST",
    path: "/api/agents/providers/switch",
    request: { location: "body", schema: agentProviderSwitchInputSchema },
    response: agentProviderSwitchResultSchema
  }),
  voiceInputStatus: defineEndpoint({
    method: "GET",
    path: "/api/agents/voice/status",
    response: localVoiceInputStatusSchema
  }),
  configureVoiceInput: defineEndpoint({
    method: "POST",
    path: "/api/agents/voice/configure",
    request: { location: "body", schema: localVoiceInputConfigSchema },
    response: localVoiceInputStatusSchema
  }),
  transcribeVoiceInput: defineEndpoint({
    method: "POST",
    path: "/api/agents/voice/transcribe",
    request: { location: "body", schema: localVoiceInputTranscriptionRequestSchema },
    response: localVoiceInputTranscriptionResultSchema
  })
} as const;
