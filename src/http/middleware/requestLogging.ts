import { Effect } from "effect";
import { logInfo } from "../../runtime/Logging";
import { continueRequest, type HttpMiddleware } from "./types";

export const REPOSITORY_CHAT_AUTOSAVE_PATH = "/api/projects/repository-chat";

export const shouldLogApiRequestAtInfo = (method: string, pathname: string): boolean =>
  !(method === "PUT" && pathname === REPOSITORY_CHAT_AUTOSAVE_PATH);

export const requestLoggingMiddleware = (): HttpMiddleware => ({
  name: "request-logging",
  onRequest: (context) =>
    Effect.sync(() => {
      const method = context.request.method ?? "GET";
      const path = context.url.pathname;
      if (shouldLogApiRequestAtInfo(method, path)) {
        void logInfo("http", "API request", { method, path });
      }
      return continueRequest(context);
    })
});
