import { Effect } from "effect";
import { boardEndpoints } from "@shared/http";
import { ensureReadyTicketAutomation } from "../../services/codex/readyTicketScheduler";
import { fromPromise } from "../../runtime";
import { BoardWorkflows } from "../../workflows";
import { route, type HttpResourceRoute } from "./types";

export const boardRoutes = [
  route(boardEndpoints.read, ({ projectPath }) =>
    Effect.sync(() => {
      ensureReadyTicketAutomation(projectPath);
      return undefined;
    }).pipe(
      Effect.flatMap(() => BoardWorkflows.readBoard(projectPath))
    )
  )
] satisfies ReadonlyArray<HttpResourceRoute>;
