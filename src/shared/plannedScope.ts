import type { ClarificationQuestion } from "./schemas";

export const MISSING_PLANNED_SCOPE_MARKER = "Relay: missing planned file scope";
export const SCOPE_VIOLATION_CLARIFICATION_MARKER = "Codex attempted to modify file paths outside this ticket's planned scope";
const SCOPE_VIOLATION_REQUEST_HEADER = "Please confirm whether implementation should expand the planned file scope to include:";
const SCOPE_VIOLATION_CURRENT_SCOPE_HEADER = "Current planned scope:";

export const MISSING_PLANNED_SCOPE_ANSWER_DRAFT = "Redraft and rescope files";

export const isMissingPlannedScopeClarificationQuestion = (question: Pick<ClarificationQuestion, "question">): boolean =>
  question.question.includes(MISSING_PLANNED_SCOPE_MARKER);

export const isScopeViolationClarificationQuestion = (question: Pick<ClarificationQuestion, "question">): boolean =>
  question.question.includes(SCOPE_VIOLATION_CLARIFICATION_MARKER);

export const normalizeScopedRepoPath = (value: string): string | null => {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized.includes("\0") || normalized.startsWith("/")) return null;

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  return normalized;
};

export const normalizePlannedScope = (plannedFiles: readonly string[] | undefined): string[] =>
  [...new Set((plannedFiles ?? []).map((value) => normalizeScopedRepoPath(value)).filter((value): value is string => Boolean(value)))].sort();

export const extractScopeViolationRequestedPaths = (
  question: Pick<ClarificationQuestion, "question">
): string[] => {
  if (!isScopeViolationClarificationQuestion(question)) return [];

  const requestIndex = question.question.indexOf(SCOPE_VIOLATION_REQUEST_HEADER);
  const currentScopeIndex = question.question.indexOf(SCOPE_VIOLATION_CURRENT_SCOPE_HEADER);
  if (requestIndex < 0 || currentScopeIndex <= requestIndex) return [];

  return [
    ...new Set(
      question.question
        .slice(requestIndex + SCOPE_VIOLATION_REQUEST_HEADER.length, currentScopeIndex)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).trim())
        .filter(Boolean)
    )
  ];
};
