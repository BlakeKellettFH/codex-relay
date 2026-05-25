import { Effect, FileSystem, Path } from "effect";
import { runBackendEffect } from "../../runtime";
import { logWarn } from "../../runtime/Logging";
import { contextPath, resolveProjectPath, slashPath } from "../../storage/paths";

export const PROJECT_CONTEXT_README_FILENAME = "README.md";
export const PROJECT_CONTEXT_PER_FILE_MAX_CHARS = 16 * 1024;
export const PROJECT_CONTEXT_TOTAL_MAX_CHARS = 32 * 1024;

export type ProjectContextDocument = {
  readonly filename: string;
  readonly content: string;
};

export type ProjectContextLoadOptions = {
  readonly filenames?: readonly string[];
};

export type ProjectContextPromptOptions = ProjectContextLoadOptions & {
  readonly header?: string;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const truncateText = (value: string, maxLength: number): string => {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  if (maxLength <= 3) return normalized.slice(0, maxLength);
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

const isInjectableContextFilename = (entry: string, options?: ProjectContextLoadOptions): boolean => {
  if (!entry.endsWith(".md") || entry === PROJECT_CONTEXT_README_FILENAME) return false;
  const allowed = options?.filenames?.map((filename) => filename.trim()).filter(Boolean);
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(entry);
};

const backendPath = (): Promise<Path.Path> => runBackendEffect(Path.Path.use((path) => Effect.succeed(path)));

export const loadProjectContextDocuments = async (
  projectPathInput: string,
  options: ProjectContextLoadOptions = {}
): Promise<ProjectContextDocument[]> => {
  const path = await backendPath();
  const projectPath = resolveProjectPath(path, projectPathInput);
  const contextDirectory = contextPath(path, projectPath);
  const directoryExists = await runBackendEffect(FileSystem.FileSystem.use((fs) => fs.exists(contextDirectory)));
  if (!directoryExists) return [];

  const entries = await runBackendEffect(
    FileSystem.FileSystem.use((fs) =>
      fs.readDirectory(contextDirectory).pipe(
        Effect.catch(() => Effect.succeed([] as readonly string[]))
      )
    )
  );

  const filenames = entries
    .filter((entry) => isInjectableContextFilename(entry, options))
    .sort((left, right) => left.localeCompare(right));
  const documents: ProjectContextDocument[] = [];

  for (const filename of filenames) {
    const filePath = path.join(contextDirectory, filename);
    const info = await runBackendEffect(
      FileSystem.FileSystem.use((fs) => fs.stat(filePath).pipe(Effect.catch(() => Effect.succeed(null))))
    );
    if (!info || info.type !== "File") continue;

    const raw = await runBackendEffect(
      FileSystem.FileSystem.use((fs) =>
        fs.readFileString(filePath, "utf8").pipe(Effect.catch(() => Effect.succeed(null as string | null)))
      )
    );
    if (raw === null) {
      await logWarn("project-context", "Unable to read project context file; skipping.", { projectPath, filename });
      continue;
    }

    const content = truncateText(raw, PROJECT_CONTEXT_PER_FILE_MAX_CHARS);
    if (!content) continue;
    documents.push({ filename, content });
  }

  return documents;
};

const isSafeContextRelativePath = (relativePath: string): boolean => {
  const normalized = slashPath(relativePath.trim()).replace(/^\.\//, "");
  if (!normalized || normalized === PROJECT_CONTEXT_README_FILENAME) return false;
  if (normalized.startsWith("/") || normalized.includes("..")) return false;
  if (!normalized.endsWith(".md")) return false;
  return true;
};

export const loadProjectContextRelativeMarkdown = async (
  projectPathInput: string,
  relativePath: string,
  maxChars = PROJECT_CONTEXT_PER_FILE_MAX_CHARS
): Promise<string | null> => {
  if (!isSafeContextRelativePath(relativePath)) return null;

  const path = await backendPath();
  const projectPath = resolveProjectPath(path, projectPathInput);
  const contextDirectory = contextPath(path, projectPath);
  const normalized = slashPath(relativePath.trim()).replace(/^\.\//, "");
  const filePath = path.resolve(contextDirectory, normalized);
  const resolvedContextDirectory = path.resolve(contextDirectory);
  const withinContextDirectory =
    filePath === resolvedContextDirectory || filePath.startsWith(`${resolvedContextDirectory}${path.sep}`);
  if (!withinContextDirectory) return null;

  const fileExists = await runBackendEffect(FileSystem.FileSystem.use((fs) => fs.exists(filePath)));
  if (!fileExists) return null;

  const info = await runBackendEffect(
    FileSystem.FileSystem.use((fs) => fs.stat(filePath).pipe(Effect.catch(() => Effect.succeed(null))))
  );
  if (!info || info.type !== "File") return null;

  const raw = await runBackendEffect(
    FileSystem.FileSystem.use((fs) =>
      fs.readFileString(filePath, "utf8").pipe(Effect.catch(() => Effect.succeed(null as string | null)))
    )
  );
  if (raw === null) {
    await logWarn("project-context", "Unable to read project context file; skipping.", {
      projectPath,
      filename: normalized
    });
    return null;
  }

  const content = raw.trim();
  if (!content) return null;
  if (content.length <= maxChars) return content;
  if (maxChars <= 3) return content.slice(0, maxChars);
  return `${content.slice(0, maxChars - 3).trimEnd()}...`;
};

export const formatProjectContextPromptSection = async (
  projectPathInput: string,
  options: ProjectContextPromptOptions = {}
): Promise<string> => {
  const documents = await loadProjectContextDocuments(projectPathInput, options);
  if (documents.length === 0) return "";

  const header = options.header ?? "Project context (from .relay/context/):";
  const sections: string[] = [];
  let totalContentChars = 0;

  for (const document of documents) {
    const remaining = PROJECT_CONTEXT_TOTAL_MAX_CHARS - totalContentChars;
    if (remaining <= 0) break;

    let content = document.content;
    if (content.length > remaining) {
      content = truncateText(content, remaining);
    }
    if (!content) break;

    totalContentChars += content.length;
    sections.push(`## ${document.filename}\n\n${content}`);
  }

  if (sections.length === 0) return "";
  return `${header}\n\n${sections.join("\n\n")}`;
};
