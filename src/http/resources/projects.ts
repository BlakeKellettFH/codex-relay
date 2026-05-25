import { Effect } from "effect";
import { projectEndpoints } from "@shared/http";
import { RELAY_SCHEMA_VERSION } from "@shared/schemas";
import { ensureReadyTicketAutomation } from "../../services/codex/readyTicketScheduler";
import { fromPromise } from "../../runtime";
import * as FileSystemStorage from "../../storage/filesystem";
import { ProjectWorkflows } from "../../workflows";
import { route, type HttpResourceRoute } from "./types";

const gitMetadataOptionsFromQuery = (force: string | undefined): { readonly force?: boolean } => {
  if (force === undefined) return {};
  return { force: force === "true" || force === "1" };
};

export const projectRoutes = [
  route(projectEndpoints.list, () => ProjectWorkflows.listProjects()),
  route(projectEndpoints.addFolder, () => ProjectWorkflows.addProjectFolder()),
  route(projectEndpoints.addPath, (input) => ProjectWorkflows.addProjectPath(input)),
  route(projectEndpoints.removeFromSidebar, ({ projectPath }) => ProjectWorkflows.removeProjectFromSidebar(projectPath)),
  route(projectEndpoints.read, ({ projectPath }) =>
    Effect.sync(() => {
      ensureReadyTicketAutomation(projectPath);
      return undefined;
    }).pipe(Effect.flatMap(() => ProjectWorkflows.readProject(projectPath)))
  ),
  route(projectEndpoints.gitMetadata, ({ projectPath, force }) =>
    ProjectWorkflows.readProjectGitMetadata(projectPath, gitMetadataOptionsFromQuery(force))
  ),
  route(projectEndpoints.revealInFinder, ({ projectPath }) => ProjectWorkflows.revealProjectInFinder(projectPath)),
  route(projectEndpoints.openInEditor, (input) => ProjectWorkflows.openProjectInEditorWorkflow(input)),
  route(projectEndpoints.readRepositoryChat, ({ projectPath }) =>
    fromPromise(() => FileSystemStorage.readRepositoryChat(projectPath))
  ),
  route(projectEndpoints.saveRepositoryChat, (input) =>
    fromPromise(() =>
      FileSystemStorage.saveRepositoryChat(input.projectPath, {
        schemaVersion: RELAY_SCHEMA_VERSION,
        threadId: input.threadId ?? null,
        messages: input.messages,
        draft: input.draft ?? ""
      })
    )
  ),
  route(projectEndpoints.clearRepositoryChat, ({ projectPath }) =>
    fromPromise(() => FileSystemStorage.clearRepositoryChat(projectPath))
  )
] satisfies ReadonlyArray<HttpResourceRoute>;
