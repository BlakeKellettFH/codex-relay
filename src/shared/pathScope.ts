export const slashPath = (value: string): string => value.split(/[\\/]+/g).join("/");

export const RELAY_MANAGED_DIRECTORY = ".relay";

/** Relay metadata under `.relay/` is not subject to planned-scope or path-lock enforcement. */
export const isRelayManagedPath = (path: string): boolean => {
  const normalized = slashPath(path.trim()).replace(/^\.\//, "");
  return normalized === RELAY_MANAGED_DIRECTORY || normalized.startsWith(`${RELAY_MANAGED_DIRECTORY}/`);
};

export const filterPathsForPathScope = (paths: readonly string[]): string[] =>
  paths.filter((path) => !isRelayManagedPath(path));

export const normalizeRepoPath = (value: string, projectRoot?: string): string | null => {
  let normalized = slashPath(value.trim()).replace(/^\.\//, "");
  const root = projectRoot ? slashPath(projectRoot).replace(/\/$/, "") : null;
  if (root && (normalized === root || normalized.startsWith(`${root}/`))) {
    normalized = normalized === root ? "" : normalized.slice(root.length + 1);
  }
  if (!normalized || normalized === "." || normalized.includes("\0") || normalized.startsWith("/")) return null;

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  return normalized;
};

export const normalizeRepoPathList = (paths: readonly string[], projectRoot?: string): string[] =>
  [...new Set(paths.map((path) => normalizeRepoPath(path, projectRoot)).filter((path): path is string => Boolean(path)))].sort();
