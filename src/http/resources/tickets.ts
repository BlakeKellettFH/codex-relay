import { Effect } from "effect";
import { ticketEndpoints } from "@shared/http";
import type { TicketDraftStartResult } from "@shared/schemas";
import { fromPromise } from "../../runtime";
import { BoardWorkflows, TicketWorkflows } from "../../workflows";
import {
  approveScopeClarificationRedraft,
  cancelTicketUpdateRun,
  createDraftIntake,
  maybeFinalizeImplementationScopeAfterClarification,
  maybeResumeTicketDraftAfterClarification,
  startTicketDraftRun,
  startTicketRedraftRun,
  startTicketUpdateRun,
  ticketDraftErrorToPayload
} from "../../services/codex";
import { notifyTicketReadyForScheduling } from "../../services/codex/readyTicketScheduler";
import { logError } from "../../runtime/Logging";
import { httpRunEventSink } from "./runEventSink";
import { route, type HttpResourceRoute } from "./types";

export const ticketRoutes = [
  route(ticketEndpoints.intakeDraft, (input) => fromPromise(() => createDraftIntake(input))),
  route(ticketEndpoints.createDraft, (input) =>
    fromPromise(async (): Promise<TicketDraftStartResult> => {
      try {
        return { ok: true, ...(await startTicketDraftRun(input, { runEventSink: httpRunEventSink() })) };
      } catch (error) {
        return { ok: false, error: ticketDraftErrorToPayload(error) };
      }
    })
  ),
  route(ticketEndpoints.redraft, (input) =>
    fromPromise(async (): Promise<TicketDraftStartResult> => {
      try {
        return { ok: true, ...(await startTicketRedraftRun(input, { runEventSink: httpRunEventSink() })) };
      } catch (error) {
        return { ok: false, error: ticketDraftErrorToPayload(error) };
      }
    })
  ),
  route(ticketEndpoints.createManual, ({ projectPath, input }) => TicketWorkflows.createManualTicket(projectPath, input)),
  route(ticketEndpoints.createSubticket, (input) => TicketWorkflows.createSubticket(input)),
  route(ticketEndpoints.linkSubticket, (input) => TicketWorkflows.linkSubticket(input)),
  route(ticketEndpoints.unlinkSubticket, (input) => TicketWorkflows.unlinkSubticket(input)),
  route(ticketEndpoints.createTaskUnderFeature, (input) => TicketWorkflows.createTaskUnderFeature(input)),
  route(ticketEndpoints.createFeatureSubticket, (input) => TicketWorkflows.createFeatureSubticket(input)),
  route(ticketEndpoints.linkFeatureSubticket, (input) => TicketWorkflows.linkFeatureSubticket(input)),
  route(ticketEndpoints.unlinkFeatureSubticket, (input) => TicketWorkflows.unlinkFeatureSubticket(input)),
  route(ticketEndpoints.startAgentUpdate, (input) =>
    fromPromise(() => startTicketUpdateRun(input, { runEventSink: httpRunEventSink() }))
  ),
  route(ticketEndpoints.cancelAgentUpdate, ({ runId }) => fromPromise(() => cancelTicketUpdateRun(runId))),
  route(ticketEndpoints.references, ({ projectPath }) => TicketWorkflows.listTicketReferences(projectPath)),
  route(ticketEndpoints.read, ({ projectPath, ticketId }) => TicketWorkflows.readTicket(projectPath, ticketId)),
  route(ticketEndpoints.save, (input) =>
    Effect.gen(function*() {
      const saved = yield* TicketWorkflows.saveTicket(input);
      yield* fromPromise(() => notifyTicketReadyForScheduling(input.projectPath, saved.frontMatter.id));
      return saved;
    })
  ),
  route(ticketEndpoints.saveAttachment, (input) => TicketWorkflows.saveTicketAttachment(input)),
  route(ticketEndpoints.move, (input) =>
    Effect.gen(function*() {
      yield* TicketWorkflows.moveTicket(input);
      yield* fromPromise(() => notifyTicketReadyForScheduling(input.projectPath, input.ticketId));
      return yield* BoardWorkflows.readBoard(input.projectPath);
    })
  ),
  route(ticketEndpoints.archive, (input) =>
    Effect.gen(function*() {
      const dependencies = { runEventSink: httpRunEventSink() };
      const bundleIds = input.ticketIds?.filter((ticketId) => ticketId.trim().length > 0) ?? [];
      if (bundleIds.length > 0) {
        return yield* TicketWorkflows.archiveTicketBundle(input.projectPath, bundleIds, dependencies);
      }
      const ticketId = input.ticketId?.trim();
      if (!ticketId) {
        return yield* Effect.fail(new Error("Provide ticketId or ticketIds to archive."));
      }
      return yield* TicketWorkflows.archiveTicket(input.projectPath, ticketId, dependencies);
    })
  ),
  route(ticketEndpoints.clarifications, ({ projectPath, ticketId }) =>
    TicketWorkflows.listClarifications(projectPath, ticketId)
  ),
  route(ticketEndpoints.answerClarification, (input) =>
    Effect.gen(function*() {
      const answer = yield* TicketWorkflows.answerClarification(input);
      setImmediate(() => {
        void maybeFinalizeImplementationScopeAfterClarification(input.projectPath, input.ticketId)
          .then((ticket) => {
            if (ticket?.frontMatter.status === "ready") {
              return notifyTicketReadyForScheduling(input.projectPath, input.ticketId);
            }
          })
          .catch((error) =>
            logError("codex:run", "finalize implementation scope after clarification failed", error, {
              projectPath: input.projectPath,
              ticketId: input.ticketId,
              questionId: input.questionId
            })
          );
        void maybeResumeTicketDraftAfterClarification(input.projectPath, input.ticketId, {
          runEventSink: httpRunEventSink()
        }).catch((error) =>
          logError("codex:draft", "auto-resume after clarification failed", error, {
            projectPath: input.projectPath,
            ticketId: input.ticketId,
            questionId: input.questionId
          })
        );
      });
      return answer;
    })
  ),
  route(ticketEndpoints.approveScopeClarification, (input) =>
    fromPromise(() => approveScopeClarificationRedraft(input, { runEventSink: httpRunEventSink() }))
  ),
  route(ticketEndpoints.delete, ({ projectPath, ticketId }) => TicketWorkflows.deleteTicket(projectPath, ticketId)),
  route(ticketEndpoints.duplicate, ({ projectPath, ticketId }) => TicketWorkflows.duplicateTicket(projectPath, ticketId)),
  route(ticketEndpoints.revealFile, ({ projectPath, ticketId }) => TicketWorkflows.revealTicketFile(projectPath, ticketId))
] satisfies ReadonlyArray<HttpResourceRoute>;
