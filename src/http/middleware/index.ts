export * from "./auth";
export * from "./cors";
export * from "./json";
export * from "./requestLogging";
export * from "./types";

import { authMiddleware } from "./auth";
import { corsMiddleware } from "./cors";
import { jsonResponseMiddleware } from "./json";
import { requestLoggingMiddleware } from "./requestLogging";
import type { HttpMiddleware } from "./types";

export const defaultHttpMiddlewares = (): ReadonlyArray<HttpMiddleware> => [
  corsMiddleware(),
  requestLoggingMiddleware(),
  authMiddleware(),
  jsonResponseMiddleware()
];
