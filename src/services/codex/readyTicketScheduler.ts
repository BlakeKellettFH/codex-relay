import { Effect, Path } from "effect";
import { readRegistry } from "../registry/index";
import { runBackendEffect } from "../../runtime";
import { logWarn } from "../../runtime/Logging";
import { reconcileSchedulableReadyTickets, reconcileTicketQueueState } from "./index";

const resolveBackendPath = async (...parts: string[]): Promise<string> =>
  runBackendEffect(Path.Path.use((path) => Effect.succeed(path.resolve(...parts))));

const READY_TICKET_POLL_INTERVAL_MS = 5_000;

const readyPollHandles = new Map<string, NodeJS.Timeout>();

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const notifyTicketReadyForScheduling = async (
  projectPathInput: string,
  ticketId?: string
): Promise<void> => {
  const projectPath = await resolveBackendPath(projectPathInput);

  if (ticketId) {
    try {
      await reconcileTicketQueueState(projectPath, ticketId);
    } catch (error) {
      await logWarn("codex:scheduler", "ready ticket could not be scheduled immediately", {
        projectPath,
        ticketId,
        error: errorMessage(error, "Reconcile failed.")
      });
    }
  }

  await reconcileSchedulableReadyTickets(projectPath);
};

export const startReadyTicketAutomation = async (projectPathInput: string): Promise<void> => {
  const projectPath = await resolveBackendPath(projectPathInput);
  if (readyPollHandles.has(projectPath)) return;

  await notifyTicketReadyForScheduling(projectPath);

  const interval = setInterval(() => {
    void reconcileSchedulableReadyTickets(projectPath).catch((error) =>
      logWarn("codex:scheduler", "ready ticket poll failed", {
        projectPath,
        error: errorMessage(error, "Poll failed.")
      })
    );
  }, READY_TICKET_POLL_INTERVAL_MS);
  readyPollHandles.set(projectPath, interval);
};

export const stopReadyTicketAutomation = (projectPathInput: string): void => {
  const handle = readyPollHandles.get(projectPathInput);
  if (!handle) return;
  clearInterval(handle);
  readyPollHandles.delete(projectPathInput);
};

export const startReadyTicketAutomationForAllProjects = async (): Promise<void> => {
  const registry = await readRegistry();
  for (const project of registry.projects) {
    await startReadyTicketAutomation(project.path);
  }
};

export const ensureReadyTicketAutomation = (projectPath: string): void => {
  void startReadyTicketAutomation(projectPath).catch((error) =>
    logWarn("codex:scheduler", "failed to start ready ticket automation", {
      projectPath,
      error: errorMessage(error, "Start failed.")
    })
  );
};

export const ensureReadyTicketAutomationForAllProjects = (): void => {
  void startReadyTicketAutomationForAllProjects().catch((error) =>
    logWarn("codex:scheduler", "failed to start ready ticket automation for registry projects", {
      error: errorMessage(error, "Start failed.")
    })
  );
};
