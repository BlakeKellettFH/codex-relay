import { uniqueTicketIds } from "./blockers";
import type { LeanTaskDraft } from "./schemas";

export const normalizeLeanTaskTitle = (title: string): string => title.trim().toLowerCase();

export type LeanTaskTitleToIdMap = ReadonlyMap<string, string>;

export type LeanTaskBlockedByResolution = {
  readonly blockedByIds: readonly string[];
  readonly warnings: readonly string[];
};

export type LeanTaskBlockedByResolutions = {
  readonly byNormalizedTitle: ReadonlyMap<string, LeanTaskBlockedByResolution>;
  readonly warnings: readonly string[];
};

type LeanTaskDependencyDraft = Pick<LeanTaskDraft, "title" | "blockedByTitles">;

export const buildLeanTaskTitleToIdMap = (
  createdTasks: readonly { readonly title: string; readonly id: string }[]
): LeanTaskTitleToIdMap => {
  const map = new Map<string, string>();
  for (const task of createdTasks) {
    const key = normalizeLeanTaskTitle(task.title);
    if (!key || map.has(key)) continue;
    map.set(key, task.id);
  }
  return map;
};

const findCyclicNodeIds = (adjacency: ReadonlyMap<string, readonly string[]>): Set<string> => {
  const cyclic = new Set<string>();
  const visited = new Set<string>();
  const stack = new Set<string>();

  const dfs = (nodeId: string, path: readonly string[]): void => {
    if (stack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart >= 0) {
        for (let index = cycleStart; index < path.length; index += 1) {
          cyclic.add(path[index]!);
        }
      }
      cyclic.add(nodeId);
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    stack.add(nodeId);
    const nextPath = [...path, nodeId];
    for (const neighborId of adjacency.get(nodeId) ?? []) {
      if (!adjacency.has(neighborId)) continue;
      dfs(neighborId, nextPath);
    }
    stack.delete(nodeId);
  };

  for (const nodeId of adjacency.keys()) {
    dfs(nodeId, []);
  }

  return cyclic;
};

export const resolveLeanTaskBlockedByTitles = (
  leanTasks: readonly LeanTaskDependencyDraft[],
  titleToIdMap: LeanTaskTitleToIdMap
): LeanTaskBlockedByResolutions => {
  const warnings: string[] = [];
  const byNormalizedTitle = new Map<string, LeanTaskBlockedByResolution>();
  const adjacency = new Map<string, string[]>();

  for (const leanTask of leanTasks) {
    const normalizedTitle = normalizeLeanTaskTitle(leanTask.title);
    const taskId = titleToIdMap.get(normalizedTitle);
    if (!normalizedTitle || !taskId) continue;

    const blockerIds: string[] = [];
    for (const blockerTitle of leanTask.blockedByTitles) {
      const normalizedBlockerTitle = normalizeLeanTaskTitle(blockerTitle);
      if (!normalizedBlockerTitle) continue;

      if (normalizedBlockerTitle === normalizedTitle) {
        warnings.push(`Lean task "${leanTask.title}" cannot block itself.`);
        continue;
      }

      const blockerId = titleToIdMap.get(normalizedBlockerTitle);
      if (!blockerId) {
        warnings.push(`Unknown lean task blocker title "${blockerTitle}" for "${leanTask.title}".`);
        continue;
      }

      blockerIds.push(blockerId);
    }

    adjacency.set(taskId, uniqueTicketIds(blockerIds));
  }

  const cyclicNodeIds = findCyclicNodeIds(adjacency);

  for (const leanTask of leanTasks) {
    const normalizedTitle = normalizeLeanTaskTitle(leanTask.title);
    const taskId = titleToIdMap.get(normalizedTitle);
    if (!normalizedTitle || !taskId) continue;

    const taskWarnings: string[] = [];
    let blockedByIds = adjacency.get(taskId) ?? [];
    if (cyclicNodeIds.has(taskId)) {
      taskWarnings.push(`Circular lean task dependency involving "${leanTask.title}"; blocker links omitted.`);
      blockedByIds = [];
    }

    byNormalizedTitle.set(normalizedTitle, {
      blockedByIds,
      warnings: taskWarnings
    });
  }

  const taskWarnings = [...byNormalizedTitle.values()].flatMap((resolution) => resolution.warnings);
  return {
    byNormalizedTitle,
    warnings: [...warnings, ...taskWarnings]
  };
};
