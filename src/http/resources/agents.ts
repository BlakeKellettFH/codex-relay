import { agentEndpoints } from "@shared/http";
import { fromPromise } from "../../runtime";
import { configureLocalVoiceInput, readLocalVoiceInputStatus, transcribeLocalVoiceInput } from "../../services/agents/localVoiceInput";
import { readAgentProviderInventory, switchAgentProviderSelection } from "../../services/registry";
import { route, type HttpResourceRoute } from "./types";

export const agentRoutes = [
  route(agentEndpoints.providers, () => fromPromise(() => readAgentProviderInventory())),
  route(agentEndpoints.switchProvider, (input) => fromPromise(() => switchAgentProviderSelection(input))),
  route(agentEndpoints.voiceInputStatus, () => fromPromise(() => readLocalVoiceInputStatus())),
  route(agentEndpoints.configureVoiceInput, (input) => fromPromise(() => configureLocalVoiceInput(input))),
  route(agentEndpoints.transcribeVoiceInput, (input) => fromPromise(() => transcribeLocalVoiceInput(input)))
] satisfies ReadonlyArray<HttpResourceRoute>;
