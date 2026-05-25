import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { isGitRepository } from "../../storage";

const execFileAsync = promisify(execFile);

export type ImplementationWorkspace = {
  readonly workspacePath: string;
  readonly branchName: string | null;
  readonly baseBranch: string | null;
  readonly isolated: boolean;
};

type AgentWorktreeRecord = {
  readonly schemaVersion: 1;
  readonly ticketId: string;
  readonly ticketTitle: string;
  readonly branchName: string;
  readonly baseBranch: string;
  readonly worktreePath: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const recordPathFor = (projectPath: string, ticketId: string): string =>
  path.join(projectPath, ".relay", "agent-worktrees", `${ticketId}.json`);

const nowIso = (): string => new Date().toISOString();

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
};

const git = async (projectPath: string, args: readonly string[]): Promise<{ stdout: string; stderr: string }> => {
  const result = await execFileAsync("git", ["-C", projectPath, ...args], {
    maxBuffer: 10 * 1024 * 1024
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
};

const slugify = (value: string, fallback = "change"): string => {
  const slug = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
  return slug || fallback;
};

const sanitizeTicketRef = (value: string): string =>
  value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "ticket";

const readCurrentBranch = async (projectPath: string): Promise<string> => {
  const branch = (await git(projectPath, ["branch", "--show-current"])).stdout.trim();
  return branch || "HEAD";
};

const branchExists = async (projectPath: string, branchName: string): Promise<boolean> => {
  try {
    await git(projectPath, ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`]);
    return true;
  } catch {
    return false;
  }
};

const readJsonIfExists = async <T>(target: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(target, "utf8")) as T;
  } catch {
    return null;
  }
};

const writeJson = async (target: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const listWorktreePaths = async (projectPath: string): Promise<Set<string>> => {
  const stdout = (await git(projectPath, ["worktree", "list", "--porcelain"])).stdout;
  const paths = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("worktree ")) continue;
    paths.add(path.resolve(line.slice("worktree ".length).trim()));
  }
  return paths;
};

const worktreePathFor = (projectPath: string, ticketId: string): string =>
  path.resolve(projectPath, "..", `${path.basename(projectPath)}-${sanitizeTicketRef(ticketId)}`);

const branchNameFor = (ticketId: string, ticketTitle: string): string =>
  `agent/${sanitizeTicketRef(ticketId)}-${slugify(ticketTitle).slice(0, 48)}`;

export const ensureImplementationWorkspace = async (
  projectPath: string,
  ticketId: string,
  ticketTitle: string
): Promise<ImplementationWorkspace> => {
  if (!(await isGitRepository(projectPath))) {
    return {
      workspacePath: projectPath,
      branchName: null,
      baseBranch: null,
      isolated: false
    };
  }

  const knownWorktrees = await listWorktreePaths(projectPath);
  const recordPath = recordPathFor(projectPath, ticketId);
  const existing = await readJsonIfExists<AgentWorktreeRecord>(recordPath);
  if (existing && knownWorktrees.has(path.resolve(existing.worktreePath)) && (await pathExists(existing.worktreePath))) {
    return {
      workspacePath: existing.worktreePath,
      branchName: existing.branchName,
      baseBranch: existing.baseBranch,
      isolated: true
    };
  }

  const baseBranch = await readCurrentBranch(projectPath);
  const branchName = existing?.branchName ?? branchNameFor(ticketId, ticketTitle);
  const worktreePath = existing?.worktreePath ?? worktreePathFor(projectPath, ticketId);

  if ((await pathExists(worktreePath)) && !knownWorktrees.has(path.resolve(worktreePath))) {
    throw new Error(`Refusing to use existing non-worktree path for agent workspace: ${worktreePath}`);
  }

  if (!knownWorktrees.has(path.resolve(worktreePath))) {
    await mkdir(path.dirname(worktreePath), { recursive: true });
    if (await branchExists(projectPath, branchName)) {
      await git(projectPath, ["worktree", "add", worktreePath, branchName]);
    } else {
      await git(projectPath, ["worktree", "add", "-b", branchName, worktreePath, baseBranch]);
    }
  }

  const timestamp = nowIso();
  const record: AgentWorktreeRecord = {
    schemaVersion: 1,
    ticketId,
    ticketTitle,
    branchName,
    baseBranch,
    worktreePath,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  };
  await writeJson(recordPath, record);

  return {
    workspacePath: worktreePath,
    branchName,
    baseBranch,
    isolated: true
  };
};

export const readImplementationWorkspacePath = async (projectPath: string, ticketId: string): Promise<string> => {
  const existing = await readJsonIfExists<AgentWorktreeRecord>(recordPathFor(projectPath, ticketId));
  if (existing && (await pathExists(existing.worktreePath))) {
    return existing.worktreePath;
  }
  return projectPath;
};
