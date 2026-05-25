import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { openProjectInEditorFromHeader, ProjectEditorDropdown, ProjectSidebar } from "../src/renderer/src/App";
import type { AgentProviderInventory, ProjectEditorId, ProjectOpenInEditorInput, ProjectSummary } from "../src/shared/schemas";

const projectPath = "/tmp/relay-sidebar-project";

const providerInventory = (patch: Partial<AgentProviderInventory> = {}): AgentProviderInventory => ({
  providers: [
    {
      id: "codex",
      label: "Codex",
      installState: "installed",
      authState: "authenticated",
      status: "ready",
      message: "Codex is available.",
      version: "codex-cli 0.130.0",
      canSelect: true,
      blockedReasonCode: null,
      blockedReasonMessage: null
    },
    {
      id: "cursor",
      label: "Cursor",
      installState: "installed",
      authState: "authenticated",
      status: "ready",
      message: "Cursor CLI is available.",
      version: "cursor-cli 1.2.0",
      canSelect: true,
      blockedReasonCode: null,
      blockedReasonMessage: null
    },
    {
      id: "claude",
      label: "Claude",
      installState: "installed",
      authState: "unauthenticated",
      status: "unauthenticated",
      message: "Claude CLI needs authentication.",
      version: "claude 0.9.0",
      canSelect: false,
      blockedReasonCode: "provider_unauthenticated",
      blockedReasonMessage: "Sign in to Claude before switching."
    }
  ],
  selectedProviderId: "codex",
  switchability: {
    canSwitch: true,
    reasonCode: null,
    message: null,
    blockingWorkCount: 0
  },
  ...patch
});

const project = (patch: Partial<ProjectSummary> = {}): ProjectSummary => ({
  projectId: "prj_sidebar",
  name: "Sidebar Project",
  path: projectPath,
  exists: true,
  isGitRepository: true,
  relayInitialized: true,
  health: "ok",
  healthMessages: [],
  activeRunCount: 0,
  swimlanes: [
    { id: "todo", name: "Todo", position: 1000, ticketCount: 2, activeRunCount: 0 },
    { id: "review", name: "Review", position: 2000, ticketCount: 0, activeRunCount: 0 }
  ],
  ...patch
});

const renderSidebar = (
  projects: ProjectSummary[],
  defaultExpandedProjectPaths: string[] = [],
  selectedPath: string | null = projectPath,
  toggleShortcutLabel = "Ctrl B"
): string =>
  renderToStaticMarkup(
    <ProjectSidebar
      projects={projects}
      selectedPath={selectedPath}
      loading={false}
      onAdd={() => undefined}
      onSelect={() => undefined}
      onRemove={() => undefined}
      onReveal={() => undefined}
      onToggleVisibility={() => undefined}
      toggleShortcutLabel={toggleShortcutLabel}
      providerInventory={providerInventory()}
      providerInventoryLoading={false}
      providerInventoryError={false}
      providerInventoryRefreshing={false}
      onOpenProviderSelector={() => undefined}
      defaultExpandedProjectPaths={defaultExpandedProjectPaths}
    />
  );

test("project sidebar renders projects collapsed with an accessible disclosure control", () => {
  const markup = renderSidebar([project()], [], null);

  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /aria-label="Expand Sidebar Project swimlanes"/);
  assert.doesNotMatch(markup, /Review/);
});

test("project sidebar heading exposes hide and add project controls", () => {
  const markup = renderSidebar([project()], [], null);

  assert.match(markup, /<aside id="project-sidebar" class="sidebar" aria-label="Projects">/);
  assert.match(markup, /class="sidebar-heading-actions"/);
  assert.match(markup, /aria-label="Hide sidebar \(Ctrl B\)"/);
  assert.match(markup, /title="Hide sidebar \(Ctrl B\)"/);
  assert.match(markup, /aria-controls="project-sidebar"/);
  assert.match(markup, /aria-expanded="true"/);
  assert.match(markup, /aria-keyshortcuts="Meta\+B Control\+B"/);
  assert.match(markup, /aria-label="Add project"/);
  assert.match(markup, /Open CLI selector\. Codex: Connected/);
});

test("project sidebar renders per-project reveal and remove icon actions", () => {
  const markup = renderSidebar([project()], [], null);

  assert.match(markup, /class="project-folder-actions"/);
  assert.match(markup, /aria-label="Reveal Sidebar Project in Finder"/);
  assert.match(markup, /title="Reveal in Finder"/);
  assert.match(markup, /aria-label="Remove Sidebar Project from Relay"/);
  assert.match(markup, /title="Remove from Relay"/);
  assert.doesNotMatch(markup, /class="sidebar-actions"/);
  assert.doesNotMatch(markup, />Reveal</);
  assert.doesNotMatch(markup, />Remove</);
});

test("expanded project sidebar shows all swimlanes including zero-count lanes", () => {
  const markup = renderSidebar([project()], [projectPath]);

  assert.match(markup, /aria-expanded="true"/);
  assert.match(markup, /aria-label="Collapse Sidebar Project swimlanes"/);
  assert.match(markup, /Todo/);
  assert.match(markup, /Review/);
  assert.match(markup, /aria-label="Todo: 2 tasks"/);
  assert.match(markup, /aria-label="Review: 0 tasks"/);
});

test("expanded project sidebar marks swimlanes with active task runs", () => {
  const markup = renderSidebar(
    [
      project({
        activeRunCount: 1,
        swimlanes: [
          { id: "todo", name: "Todo", position: 1000, ticketCount: 1, activeRunCount: 0 },
          { id: "in_progress", name: "In Progress", position: 2000, ticketCount: 2, activeRunCount: 1 }
        ]
      })
    ],
    [projectPath]
  );

  assert.match(markup, /aria-label="In Progress: 2 tasks, 1 active task"/);
  assert.match(markup, /project-swimlane-row active/);
  assert.doesNotMatch(markup, /aria-label="Todo: 1 tasks, 1 active task"/);
});

test("expanded project sidebar keeps long labels, counts, and active indicators renderable", () => {
  const longProjectName = "Sidebar Project With A Very Long Name That Should Truncate Without Losing Disclosure Labels";
  const longSwimlaneName = "Review Lane With A Very Long Name That Should Preserve Counts And Active Indicators";
  const markup = renderSidebar(
    [
      project({
        name: longProjectName,
        activeRunCount: 2,
        swimlanes: [
          {
            id: "in_progress",
            name: longSwimlaneName,
            position: 1000,
            ticketCount: 123,
            activeRunCount: 1
          }
        ]
      })
    ],
    [projectPath]
  );

  assert.ok(markup.includes(`aria-label="Collapse ${longProjectName} swimlanes, 2 active tasks"`));
  assert.ok(markup.includes(`aria-label="${longSwimlaneName}: 123 tasks, 1 active task"`));
  assert.match(markup, /project-folder-active/);
  assert.match(markup, /project-swimlane-active/);
  assert.match(markup, /class="project-swimlane-count" aria-hidden="true">123<\/span>/);
});

test("project header editor dropdown replaces raw path subtitle", () => {
  const markup = renderToStaticMarkup(<ProjectEditorDropdown projectPath={projectPath} onOpen={() => undefined} />);

  assert.match(markup, /aria-label="Open project in editor"/);
  assert.match(markup, /Open in editor/);
  assert.match(markup, /VS Code/);
  assert.match(markup, /Cursor/);
  assert.doesNotMatch(markup, new RegExp(projectPath));
  assert.doesNotMatch(markup, /project-header-path/);
});

test("project header open-in-editor handler sends editor id and active project path", async () => {
  const calls: ProjectOpenInEditorInput[] = [];

  const openInEditor = async (input: ProjectOpenInEditorInput) => {
    calls.push(input);
    return { ok: true } as const;
  };

  const toasts: unknown[] = [];
  const setToast = (toast: unknown): void => {
    toasts.push(toast);
  };
  await openProjectInEditorFromHeader(projectPath, "vscode", setToast, openInEditor);
  await openProjectInEditorFromHeader(projectPath, "cursor", setToast, openInEditor);

  assert.deepEqual(calls, [
    { projectPath, editorId: "vscode" },
    { projectPath, editorId: "cursor" }
  ]);
  assert.deepEqual(toasts, []);
});

test("project header open-in-editor handler shows returned failures as toast errors", async () => {
  const openInEditor = async (_input: ProjectOpenInEditorInput) => ({
    ok: false,
    message: "Relay could not open this project in Cursor."
  } as const);

  const toasts: unknown[] = [];
  await openProjectInEditorFromHeader(projectPath, "cursor" satisfies ProjectEditorId, (toast) => {
    toasts.push(toast);
  }, openInEditor);

  assert.deepEqual(toasts, [{ kind: "error", message: "Relay could not open this project in Cursor." }]);
});
