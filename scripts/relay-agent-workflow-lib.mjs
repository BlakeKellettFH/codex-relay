import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import matter from "gray-matter";

export const DEFAULT_WORKFLOW_CONFIG = {
  schemaVersion: 1,
  workerSlots: 3,
  interactiveSlots: 1,
  baseBranch: "main",
  defaultRemote: "origin",
  worktreeParent: "..",
  worktreeNameTemplate: "{repo}-{ticketRef}",
  branchNameTemplate: "agent/{ticketRef}-{slug}",
  reviewSummaryPathTemplate: ".relay/reviews/{ticketId}.md",
  mergeQueue: {
    strategy: "rebase",
    testCommand: "npm test -- --runInBand",
    worktreeNameTemplate: "{repo}-merge-{ticketRef}",
    createClarificationOnConflict: true,
    pushAfterMerge: false
  }
};

const nowIso = () => new Date().toISOString();

export const workflowConfigPath = (projectPath) => path.join(projectPath, ".relay", "agent-workflow.json");
export const agentWorktreesDir = (projectPath) => path.join(projectPath, ".relay", "agent-worktrees");
export const agentWorktreeRecordPath = (projectPath, ticketId) => path.join(agentWorktreesDir(projectPath), `${ticketId}.json`);
export const reviewSummaryPath = (projectPath, relativeTarget) => path.join(projectPath, relativeTarget);
export const mergeQueueDir = (projectPath) => path.join(projectPath, ".relay", "merge-queue");
export const mergeQueueStatePath = (projectPath) => path.join(mergeQueueDir(projectPath), "queue.json");
export const mergeQueueReportsDir = (projectPath) => path.join(mergeQueueDir(projectPath), "reports");
export const ticketFilePath = (projectPath, ticketId) => path.join(projectPath, ".relay", "tickets", `${ticketId}.md`);
export const clarificationFilePath = (projectPath, ticketId) => path.join(projectPath, ".relay", "clarifications", `${ticketId}.json`);
export const ticketRunsDir = (projectPath, ticketId) => path.join(projectPath, ".relay", "runs", ticketId);

const deepMerge = (base, override) => {
  if (!override || typeof override !== "object" || Array.isArray(override)) return base;
  const next = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value) && next[key] && typeof next[key] === "object" && !Array.isArray(next[key])) {
      next[key] = deepMerge(next[key], value);
      continue;
    }
    next[key] = value;
  }
  return next;
};

export const slugify = (value, fallback = "change") => {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
  return slug || fallback;
};

export const sanitizeTicketRef = (value) => {
  const sanitized = String(value ?? "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (!sanitized) throw new Error("Ticket reference cannot be empty.");
  return sanitized;
};

export const renderTemplate = (template, variables) =>
  template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => {
    const value = variables[key];
    return value == null ? "" : String(value);
  });

export const parseCliArgs = (argv) => {
  const [command = "", ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next == null || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    if (key in options) {
      const existing = options[key];
      options[key] = Array.isArray(existing) ? [...existing, next] : [existing, next];
    } else {
      options[key] = next;
    }
    index += 1;
  }
  return { command, options };
};

const readJsonIfExists = async (target) => {
  try {
    return JSON.parse(await fs.readFile(target, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
};

const writeJson = async (target, value) => {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const loadWorkflowConfig = async (projectPath) => {
  const loaded = await readJsonIfExists(workflowConfigPath(projectPath));
  return deepMerge(DEFAULT_WORKFLOW_CONFIG, loaded ?? {});
};

export const loadTicketRecord = async (projectPath, ticketId) => {
  const target = ticketFilePath(projectPath, ticketId);
  const raw = await fs.readFile(target, "utf8");
  const parsed = matter(raw);
  return {
    path: target,
    data: parsed.data,
    content: parsed.content
  };
};

const writeTicketRecord = async (projectPath, ticketId, frontMatter, content) => {
  const target = ticketFilePath(projectPath, ticketId);
  const next = matter.stringify(content, frontMatter);
  await fs.writeFile(target, next, "utf8");
};

export const updateTicketStatus = async (projectPath, ticketId, status, runStatus = null) => {
  const ticket = await loadTicketRecord(projectPath, ticketId);
  const frontMatter = {
    ...ticket.data,
    status,
    updatedAt: nowIso()
  };
  if (runStatus) frontMatter.runStatus = runStatus;
  await writeTicketRecord(projectPath, ticketId, frontMatter, ticket.content);
  return frontMatter;
};

const emptyClarificationStore = (ticketId) => ({
  schemaVersion: 1,
  ticketId,
  questions: []
});

export const addClarificationQuestion = async (
  projectPath,
  ticketId,
  question,
  { createdBy = "system", source = "system_reconciliation", runId = null, codexThreadId = null } = {}
) => {
  const target = clarificationFilePath(projectPath, ticketId);
  const current = (await readJsonIfExists(target)) ?? emptyClarificationStore(ticketId);
  const existing = current.questions.find((entry) => entry.question === question && !entry.answer);
  if (existing) return existing;
  const timestamp = nowIso();
  const created = {
    id: `clr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    ticketId,
    question,
    answerType: "text",
    answer: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    answeredAt: null,
    createdBy,
    source,
    runId,
    codexThreadId
  };
  current.questions.push(created);
  await writeJson(target, current);
  return created;
};

export const raiseNeedsClarification = async (projectPath, ticketId, question, options = {}) => {
  await updateTicketStatus(projectPath, ticketId, "needs_clarification", "blocked");
  return addClarificationQuestion(projectPath, ticketId, question, options);
};

export const git = (projectPath, args, options = {}) => {
  const result = spawnSync("git", ["-C", projectPath, ...args], {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    shell: false
  });
  if (result.status !== 0) {
    const error = new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
    error.stdout = result.stdout ?? "";
    error.stderr = result.stderr ?? "";
    error.status = result.status ?? 1;
    throw error;
  }
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
};

export const runShell = (cwd, command) => {
  const result = spawnSync(command, {
    cwd,
    encoding: "utf8",
    shell: true
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
};

export const branchExists = (projectPath, branchName) => {
  const result = spawnSync("git", ["-C", projectPath, "show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
    encoding: "utf8"
  });
  return result.status === 0;
};

export const readWorktreeList = (projectPath) => {
  const { stdout } = git(projectPath, ["worktree", "list", "--porcelain"]);
  const entries = [];
  let current = null;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      if (current) entries.push(current);
      current = null;
      continue;
    }
    const [key, ...rest] = line.split(" ");
    const value = rest.join(" ").trim();
    if (key === "worktree") {
      current = { path: value, branch: null, head: null };
      continue;
    }
    if (!current) continue;
    if (key === "branch") current.branch = value.replace(/^refs\/heads\//, "");
    if (key === "HEAD") current.head = value;
  }
  if (current) entries.push(current);
  return entries;
};

export const baseBranchCheckedOutElsewhere = (projectPath, baseBranch) =>
  readWorktreeList(projectPath).some((entry) => entry.branch === baseBranch);

export const buildWorktreePlan = async ({
  projectPath,
  ticketId,
  ticketRef,
  slug,
  baseBranch,
  config
}) => {
  const resolvedConfig = config ?? (await loadWorkflowConfig(projectPath));
  const ticket = await loadTicketRecord(projectPath, ticketId);
  const repo = path.basename(projectPath);
  const normalizedTicketRef = sanitizeTicketRef(ticketRef ?? ticketId);
  const shortSlug = slugify(slug ?? ticket.data.title ?? ticketId).slice(0, 48);
  const resolvedBaseBranch = baseBranch ?? resolvedConfig.baseBranch;
  const variables = {
    repo,
    ticketId,
    ticketRef: normalizedTicketRef,
    slug: shortSlug,
    baseBranch: resolvedBaseBranch
  };
  const branchName = renderTemplate(resolvedConfig.branchNameTemplate, variables);
  const worktreeName = renderTemplate(resolvedConfig.worktreeNameTemplate, variables);
  const worktreePath = path.resolve(projectPath, resolvedConfig.worktreeParent, worktreeName);
  const reviewSummaryRelativePath = renderTemplate(resolvedConfig.reviewSummaryPathTemplate, variables);
  return {
    projectPath,
    ticketId,
    ticketRef: normalizedTicketRef,
    ticketTitle: String(ticket.data.title ?? ticketId),
    slug: shortSlug,
    baseBranch: resolvedBaseBranch,
    branchName,
    worktreeName,
    worktreePath,
    reviewSummaryRelativePath
  };
};

export const readWorktreeRecord = async (projectPath, ticketId) => readJsonIfExists(agentWorktreeRecordPath(projectPath, ticketId));

export const writeWorktreeRecord = async (projectPath, ticketId, value) => writeJson(agentWorktreeRecordPath(projectPath, ticketId), value);

const relativeChangedFiles = (worktreePath, baseRef) => {
  const committed = git(worktreePath, ["diff", "--name-only", `${baseRef}...HEAD`]).stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const uncommitted = git(worktreePath, ["status", "--porcelain"]).stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  return [...new Set([...committed, ...uncommitted])].sort((left, right) => left.localeCompare(right));
};

export const readLatestRunCompletion = async (projectPath, ticketId, explicitRunId = null) => {
  const runsDirectory = ticketRunsDir(projectPath, ticketId);
  let fileName = explicitRunId ? `${explicitRunId}.jsonl` : null;
  if (!fileName) {
    const entries = await fs.readdir(runsDirectory).catch(() => []);
    const candidates = entries.filter((entry) => entry.endsWith(".jsonl")).sort();
    fileName = candidates.at(-1) ?? null;
  }
  if (!fileName) return null;
  const target = path.join(runsDirectory, fileName);
  const raw = await fs.readFile(target, "utf8");
  let completed = null;
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    const parsed = JSON.parse(line);
    if (parsed.type === "run.completed") completed = parsed.payload?.finalResponse ?? null;
  }
  return completed;
};

export const renderReviewSummary = ({
  ticketId,
  ticketTitle,
  branchName,
  worktreePath,
  baseBranch,
  changedFiles,
  reason,
  testsRun,
  knownRisks,
  followUpWork
}) => {
  const fileLines = changedFiles.length > 0 ? changedFiles.map((entry) => `- \`${entry}\``).join("\n") : "- None recorded";
  const testLines = testsRun.length > 0 ? testsRun.map((entry) => `- ${entry}`).join("\n") : "- Not recorded";
  const riskLines = knownRisks.length > 0 ? knownRisks.map((entry) => `- ${entry}`).join("\n") : "- None noted";
  const followUpLines = followUpWork.length > 0 ? followUpWork.map((entry) => `- ${entry}`).join("\n") : "- None noted";
  return `# Review Summary: ${ticketTitle}

- Ticket: \`${ticketId}\`
- Branch: \`${branchName}\`
- Worktree: \`${worktreePath}\`
- Base branch: \`${baseBranch}\`

## Files Changed

${fileLines}

## Reason For Changes

${reason.trim() || "No summary provided."}

## Tests Run

${testLines}

## Known Risks

${riskLines}

## Follow-up Work

${followUpLines}
`;
};

export const readMergeQueue = async (projectPath) =>
  (await readJsonIfExists(mergeQueueStatePath(projectPath))) ?? { schemaVersion: 1, items: [] };

export const writeMergeQueue = async (projectPath, queue) => writeJson(mergeQueueStatePath(projectPath), queue);

export const upsertMergeQueueItem = async (projectPath, item) => {
  const queue = await readMergeQueue(projectPath);
  const now = nowIso();
  const existingIndex = queue.items.findIndex((entry) => entry.ticketId === item.ticketId);
  const nextItem = {
    createdAt: now,
    updatedAt: now,
    ...item
  };
  if (existingIndex >= 0) {
    nextItem.createdAt = queue.items[existingIndex].createdAt ?? now;
    queue.items[existingIndex] = { ...queue.items[existingIndex], ...nextItem, updatedAt: now };
  } else {
    queue.items.push(nextItem);
  }
  await writeMergeQueue(projectPath, queue);
  return queue.items.find((entry) => entry.ticketId === item.ticketId);
};

export const updateMergeQueueItem = async (projectPath, ticketId, update) => {
  const queue = await readMergeQueue(projectPath);
  const index = queue.items.findIndex((entry) => entry.ticketId === ticketId);
  if (index < 0) throw new Error(`Merge queue item not found for ${ticketId}.`);
  queue.items[index] = {
    ...queue.items[index],
    ...update,
    updatedAt: nowIso()
  };
  await writeMergeQueue(projectPath, queue);
  return queue.items[index];
};

export const nextMergeQueueItem = async (projectPath) => {
  const queue = await readMergeQueue(projectPath);
  const blocking = queue.items.find((entry) => ["processing", "ready_to_merge", "needs_clarification"].includes(entry.status));
  if (blocking) return { blockedBy: blocking, item: null };
  return {
    blockedBy: null,
    item: queue.items.find((entry) => entry.status === "queued") ?? null
  };
};

export const writeMergeReport = async (projectPath, fileName, content) => {
  const target = path.join(mergeQueueReportsDir(projectPath), fileName);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  return target;
};

export const buildConflictReport = ({
  ticketId,
  ticketTitle,
  branchName,
  baseRef,
  conflictFiles,
  fileDetails
}) => `# Merge Conflict Report: ${ticketTitle}

- Ticket: \`${ticketId}\`
- Branch: \`${branchName}\`
- Base: \`${baseRef}\`

## Conflicting Files

${conflictFiles.map((entry) => `- \`${entry}\``).join("\n")}

## Change Summary

${fileDetails
  .map(
    (detail) => `### \`${detail.path}\`

**Feature branch changed**

${detail.featureSide || "- No commit summary available"}

**Base branch changed**

${detail.baseSide || "- No commit summary available"}

**Suggested resolution**

Review both sides manually in the isolated merge worktree and apply the smallest safe resolution only after explicit approval.

**Risk**

Manual conflict resolution may alter behavior in \`${detail.path}\`; rerun focused tests after approval.
`
  )
  .join("\n")}
`;

export const buildReadyToMergeReport = ({
  ticketId,
  ticketTitle,
  branchName,
  baseRef,
  changedFiles,
  testCommand,
  testResult
}) => `# Merge Preparation Report: ${ticketTitle}

- Ticket: \`${ticketId}\`
- Branch: \`${branchName}\`
- Base: \`${baseRef}\`

## Files Changed

${changedFiles.length > 0 ? changedFiles.map((entry) => `- \`${entry}\``).join("\n") : "- None detected"}

## Validation

- Command: \`${testCommand}\`
- Result: ${testResult}

## Next Step

Await explicit approval before applying the branch to the base branch.
`;

export const ensureProjectGitRoot = (projectPath) => {
  const root = git(projectPath, ["rev-parse", "--show-toplevel"]).stdout.trim();
  if (path.resolve(root) !== path.resolve(projectPath)) {
    throw new Error(`Project path must be the repository root. Expected ${root}.`);
  }
  return root;
};

export const prepareWorktree = async ({
  projectPath,
  ticketId,
  ticketRef,
  slug,
  baseBranch
}) => {
  ensureProjectGitRoot(projectPath);
  const config = await loadWorkflowConfig(projectPath);
  const plan = await buildWorktreePlan({ projectPath, ticketId, ticketRef, slug, baseBranch, config });
  const existing = await readWorktreeRecord(projectPath, ticketId);
  if (existing) {
    return existing;
  }
  if (branchExists(projectPath, plan.branchName)) {
    throw new Error(`Branch ${plan.branchName} already exists.`);
  }
  const worktreeEntries = readWorktreeList(projectPath);
  if (worktreeEntries.some((entry) => path.resolve(entry.path) === plan.worktreePath)) {
    throw new Error(`Worktree path already exists in git worktree list: ${plan.worktreePath}`);
  }
  await fs.mkdir(path.dirname(plan.worktreePath), { recursive: true });
  git(projectPath, ["worktree", "add", "-b", plan.branchName, plan.worktreePath, plan.baseBranch]);
  const record = {
    schemaVersion: 1,
    ticketId,
    ticketRef: plan.ticketRef,
    ticketTitle: plan.ticketTitle,
    branchName: plan.branchName,
    baseBranch: plan.baseBranch,
    worktreePath: plan.worktreePath,
    reviewSummaryPath: reviewSummaryPath(projectPath, plan.reviewSummaryRelativePath),
    status: "prepared",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await writeWorktreeRecord(projectPath, ticketId, record);
  return record;
};

export const finalizeWorktree = async ({
  projectPath,
  ticketId,
  runId = null,
  reason = "",
  testsRun = [],
  knownRisks = [],
  followUpWork = []
}) => {
  const record = await readWorktreeRecord(projectPath, ticketId);
  if (!record) throw new Error(`No worktree metadata found for ${ticketId}.`);
  const config = await loadWorkflowConfig(projectPath);
  const baseRef = branchExists(projectPath, config.baseBranch) ? config.baseBranch : `${config.defaultRemote}/${config.baseBranch}`;
  const changedFiles = relativeChangedFiles(record.worktreePath, baseRef);
  const fallbackReason = (await readLatestRunCompletion(projectPath, ticketId, runId)) ?? "";
  const summary = renderReviewSummary({
    ticketId,
    ticketTitle: record.ticketTitle,
    branchName: record.branchName,
    worktreePath: record.worktreePath,
    baseBranch: record.baseBranch,
    changedFiles,
    reason: reason || fallbackReason,
    testsRun,
    knownRisks,
    followUpWork
  });
  await fs.mkdir(path.dirname(record.reviewSummaryPath), { recursive: true });
  await fs.writeFile(record.reviewSummaryPath, summary, "utf8");
  await updateTicketStatus(projectPath, ticketId, "review", "completed");
  const next = {
    ...record,
    status: "ready_for_review",
    updatedAt: nowIso(),
    lastRunId: runId ?? null,
    lastChangedFiles: changedFiles,
    reviewSummaryPath: record.reviewSummaryPath
  };
  await writeWorktreeRecord(projectPath, ticketId, next);
  return next;
};

export const cleanupWorktree = async ({ projectPath, ticketId, deleteBranch = false }) => {
  const record = await readWorktreeRecord(projectPath, ticketId);
  if (!record) throw new Error(`No worktree metadata found for ${ticketId}.`);
  const status = git(record.worktreePath, ["status", "--porcelain"]).stdout.trim();
  if (status) {
    throw new Error(`Worktree ${record.worktreePath} is not clean. Refusing to remove it.`);
  }
  git(projectPath, ["worktree", "remove", record.worktreePath]);
  if (deleteBranch) git(projectPath, ["branch", "-D", record.branchName]);
  await fs.rm(agentWorktreeRecordPath(projectPath, ticketId), { force: true });
  return {
    ticketId,
    branchDeleted: deleteBranch,
    removedWorktreePath: record.worktreePath
  };
};

export const enqueueMerge = async ({ projectPath, ticketId, ticketRef = null, testCommand = null }) => {
  const config = await loadWorkflowConfig(projectPath);
  const record = await readWorktreeRecord(projectPath, ticketId);
  if (!record) throw new Error(`Prepare a worktree first for ${ticketId}.`);
  return upsertMergeQueueItem(projectPath, {
    schemaVersion: 1,
    ticketId,
    ticketRef: sanitizeTicketRef(ticketRef ?? record.ticketRef ?? ticketId),
    ticketTitle: record.ticketTitle,
    branchName: record.branchName,
    featureWorktreePath: record.worktreePath,
    baseBranch: record.baseBranch,
    testCommand: testCommand ?? config.mergeQueue.testCommand,
    mergeStrategy: config.mergeQueue.strategy,
    status: "queued",
    reportPath: null,
    mergeWorktreePath: null,
    mergedCommitSha: null
  });
};

const remoteBaseRef = (config, item) => `${config.defaultRemote}/${item.baseBranch}`;

const worktreeNameForMergeItem = (config, projectPath, item) =>
  path.resolve(
    projectPath,
    config.worktreeParent,
    renderTemplate(config.mergeQueue.worktreeNameTemplate, {
      repo: path.basename(projectPath),
      ticketId: item.ticketId,
      ticketRef: item.ticketRef,
      slug: slugify(item.ticketTitle),
      baseBranch: item.baseBranch
    })
  );

const gitLogSummary = (projectPath, rangeArgs) => {
  try {
    return git(projectPath, ["log", "--oneline", "--decorate=no", ...rangeArgs]).stdout.trim();
  } catch {
    return "";
  }
};

export const processNextMergeQueueItem = async ({ projectPath }) => {
  ensureProjectGitRoot(projectPath);
  const config = await loadWorkflowConfig(projectPath);
  const { blockedBy, item } = await nextMergeQueueItem(projectPath);
  if (blockedBy) {
    throw new Error(`Merge queue is blocked by ${blockedBy.ticketId} in status ${blockedBy.status}.`);
  }
  if (!item) return null;

  const mergeWorktreePath = worktreeNameForMergeItem(config, projectPath, item);
  if (await fs.stat(mergeWorktreePath).then(() => true).catch(() => false)) {
    throw new Error(`Merge worktree path already exists: ${mergeWorktreePath}`);
  }

  await updateMergeQueueItem(projectPath, item.ticketId, {
    status: "processing",
    mergeWorktreePath
  });

  git(projectPath, ["fetch", "--all", "--prune"]);
  git(projectPath, ["worktree", "add", mergeWorktreePath, item.branchName]);

  const baseRef = remoteBaseRef(config, item);
  const branchStartSha = git(projectPath, ["rev-parse", item.branchName]).stdout.trim();

  try {
    if (item.mergeStrategy === "merge") {
      git(mergeWorktreePath, ["merge", "--no-ff", "--no-edit", baseRef]);
    } else {
      git(mergeWorktreePath, ["rebase", baseRef]);
    }
  } catch (error) {
    const conflictFiles = git(mergeWorktreePath, ["diff", "--name-only", "--diff-filter=U"]).stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (conflictFiles.length === 0) throw error;
    const fileDetails = conflictFiles.map((entry) => ({
      path: entry,
      featureSide: gitLogSummary(projectPath, [`${baseRef}..${branchStartSha}`, "--", entry]),
      baseSide: gitLogSummary(projectPath, [`${branchStartSha}..${baseRef}`, "--", entry])
    }));
    const report = buildConflictReport({
      ticketId: item.ticketId,
      ticketTitle: item.ticketTitle,
      branchName: item.branchName,
      baseRef,
      conflictFiles,
      fileDetails
    });
    const reportPath = await writeMergeReport(projectPath, `${item.ticketId}-conflict.md`, report);
    await updateMergeQueueItem(projectPath, item.ticketId, {
      status: "needs_clarification",
      reportPath,
      conflictFiles,
      latestBaseRef: baseRef
    });
    if (config.mergeQueue.createClarificationOnConflict) {
      await raiseNeedsClarification(
        projectPath,
        item.ticketId,
        `Merge queue conflict detected for ${item.branchName}. Review ${path.relative(projectPath, reportPath)} and approve the resolution plan before applying it.`
      );
    }
    return {
      ticketId: item.ticketId,
      status: "needs_clarification",
      reportPath,
      conflictFiles
    };
  }

  const testResult = runShell(mergeWorktreePath, item.testCommand);
  const changedFiles = relativeChangedFiles(mergeWorktreePath, baseRef);
  const report = buildReadyToMergeReport({
    ticketId: item.ticketId,
    ticketTitle: item.ticketTitle,
    branchName: item.branchName,
    baseRef,
    changedFiles,
    testCommand: item.testCommand,
    testResult: testResult.ok ? "passed" : `failed (exit ${testResult.status})`
  });
  const reportPath = await writeMergeReport(projectPath, `${item.ticketId}-ready.md`, report);
  const logPath = await writeMergeReport(
    projectPath,
    `${item.ticketId}-validation.log`,
    `${testResult.stdout}${testResult.stderr ? `\n${testResult.stderr}` : ""}`
  );
  const status = testResult.ok ? "ready_to_merge" : "validation_failed";
  await updateMergeQueueItem(projectPath, item.ticketId, {
    status,
    reportPath,
    validationLogPath: logPath,
    latestBaseRef: baseRef,
    changedFiles
  });
  return {
    ticketId: item.ticketId,
    status,
    reportPath,
    validationLogPath: logPath
  };
};

export const finalizeMergeQueueItem = async ({ projectPath, ticketId, approve = false, push = false }) => {
  if (!approve) throw new Error("Explicit approval is required. Re-run with --approve.");
  ensureProjectGitRoot(projectPath);
  const config = await loadWorkflowConfig(projectPath);
  const queue = await readMergeQueue(projectPath);
  const item = queue.items.find((entry) => entry.ticketId === ticketId);
  if (!item) throw new Error(`Merge queue item not found for ${ticketId}.`);
  if (item.status !== "ready_to_merge") {
    throw new Error(`Merge queue item ${ticketId} is in status ${item.status}, not ready_to_merge.`);
  }
  if (baseBranchCheckedOutElsewhere(projectPath, item.baseBranch)) {
    throw new Error(`Base branch ${item.baseBranch} is currently checked out in a worktree. Refusing to update it.`);
  }

  git(projectPath, ["fetch", "--all", "--prune"]);
  const baseRef = remoteBaseRef(config, item);
  const featureSha = git(projectPath, ["rev-parse", item.branchName]).stdout.trim();
  const baseSha = git(projectPath, ["rev-parse", baseRef]).stdout.trim();
  const featureContainsBase = spawnSync("git", ["-C", projectPath, "merge-base", "--is-ancestor", baseSha, featureSha], {
    encoding: "utf8"
  });
  if (featureContainsBase.status !== 0) {
    throw new Error(`Branch ${item.branchName} is not up to date with ${baseRef}. Re-run process-next first.`);
  }

  if (branchExists(projectPath, item.baseBranch)) {
    const localBaseSha = git(projectPath, ["rev-parse", item.baseBranch]).stdout.trim();
    if (localBaseSha !== baseSha) {
      throw new Error(`Local ${item.baseBranch} does not match ${baseRef}. Refusing to move it automatically.`);
    }
    git(projectPath, ["update-ref", `refs/heads/${item.baseBranch}`, featureSha, baseSha]);
  } else {
    git(projectPath, ["branch", item.baseBranch, featureSha]);
  }

  if (push || config.mergeQueue.pushAfterMerge) {
    git(projectPath, ["push", config.defaultRemote, item.baseBranch]);
  }

  await updateMergeQueueItem(projectPath, item.ticketId, {
    status: "merged",
    mergedAt: nowIso(),
    mergedCommitSha: featureSha
  });

  return {
    ticketId: item.ticketId,
    status: "merged",
    mergedCommitSha: featureSha
  };
};
