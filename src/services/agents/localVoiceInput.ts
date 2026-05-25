import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import { promisify } from "node:util";
import type {
  AppRegistry,
  LocalVoiceBackend,
  LocalVoiceInputConfig,
  LocalVoiceInputStatus,
  LocalVoiceInputTranscriptionRequest,
  LocalVoiceInputTranscriptionResult
} from "@shared/schemas";
import { readRegistry, writeRegistry } from "../registry/store";

const execFileAsync = promisify(execFile);

const WHISPER_CPP_COMMANDS = ["whisper-cli", "whisper-cpp"] as const;
const WHISPER_PYTHON_COMMANDS = ["whisper"] as const;
const WHISPER_CPP_MODEL_FILENAMES = [
  "ggml-base.en.bin",
  "ggml-base.bin",
  "ggml-small.en.bin",
  "ggml-small.bin"
] as const;
const DEFAULT_WHISPER_CPP_COMMAND_SUFFIX = ["whisper.cpp", "build", "bin", "whisper-cli"] as const;

type CommandResult = {
  readonly stdout: string;
  readonly stderr: string;
};

type LocalVoiceDependencyOverrides = {
  readonly runCommand?: (command: string, args: readonly string[]) => Promise<CommandResult>;
  readonly readEnv?: () => Promise<Record<string, string | undefined>>;
  readonly readHomeDirectory?: () => Promise<string>;
  readonly readRegistry?: () => Promise<AppRegistry>;
  readonly writeRegistry?: (registry: AppRegistry) => Promise<void>;
  readonly fileExists?: (target: string) => Promise<boolean>;
  readonly createTempDir?: () => Promise<string>;
  readonly writeBinaryFile?: (target: string, bytes: Uint8Array) => Promise<void>;
  readonly readTextFile?: (target: string) => Promise<string>;
  readonly removeDirectory?: (target: string) => Promise<void>;
};

type ResolvedVoiceRuntime = {
  readonly available: boolean;
  readonly backend: LocalVoiceBackend | null;
  readonly command: string | null;
  readonly configuredCommandPath: string | null;
  readonly defaultCommandPath: string;
  readonly message: string;
  readonly modelPath: string | null;
  readonly pythonModel: string | null;
};

const defaultRunCommand = async (command: string, args: readonly string[]): Promise<CommandResult> => {
  const result = await execFileAsync(command, [...args], {
    maxBuffer: 10 * 1024 * 1024
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
};

const defaultReadEnv = async (): Promise<Record<string, string | undefined>> => process.env;
const defaultReadHomeDirectory = async (): Promise<string> => os.homedir();
const defaultReadRegistry = async (): Promise<AppRegistry> => readRegistry();
const defaultWriteRegistry = async (registry: AppRegistry): Promise<void> => writeRegistry(registry);

const defaultFileExists = async (target: string): Promise<boolean> => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

const defaultCreateTempDir = async (): Promise<string> => mkdtemp(nodePath.join(os.tmpdir(), "relay-whisper-"));
const defaultWriteBinaryFile = async (target: string, bytes: Uint8Array): Promise<void> => writeFile(target, bytes);
const defaultReadTextFile = async (target: string): Promise<string> => readFile(target, "utf8");
const defaultRemoveDirectory = async (target: string): Promise<void> => {
  await rm(target, { recursive: true, force: true });
};

const whisperCppSearchDirectories = (homeDirectory: string): readonly string[] => [
  nodePath.join(homeDirectory, ".cache", "whisper"),
  nodePath.join(homeDirectory, ".local", "share", "whisper"),
  nodePath.join(homeDirectory, "Library", "Caches", "whisper"),
  "/usr/local/share/whisper",
  "/usr/share/whisper",
  "/opt/homebrew/share/whisper",
  "/opt/homebrew/var/cache/whisper"
];

const defaultWhisperCppCommandPath = (homeDirectory: string): string =>
  nodePath.join(homeDirectory, ...DEFAULT_WHISPER_CPP_COMMAND_SUFFIX);

const expandUserPath = (value: string, homeDirectory: string): string =>
  value === "~" || value.startsWith("~/") ? nodePath.join(homeDirectory, value.slice(2)) : value;

const commandDisplayPath = (value: string, homeDirectory: string): string =>
  value === homeDirectory || value.startsWith(`${homeDirectory}/`) ? `~${value.slice(homeDirectory.length)}` : value;

const whisperCppModelDirectoriesForCommand = (command: string): readonly string[] => {
  if (!nodePath.isAbsolute(command)) return [];
  const commandDirectory = nodePath.dirname(command);
  return [
    nodePath.join(commandDirectory, "..", "..", "models"),
    nodePath.join(commandDirectory, "..", "..", "..", "models")
  ].map((directory) => nodePath.resolve(directory));
};

const commandLikelyExists = async (
  command: string,
  runCommand: (command: string, args: readonly string[]) => Promise<CommandResult>
): Promise<boolean> => {
  try {
    await runCommand(command, ["--help"]);
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return false;
    }
    return true;
  }
};

const resolveWhisperCppModelPath = async (
  env: Record<string, string | undefined>,
  homeDirectory: string,
  fileExists: (target: string) => Promise<boolean>,
  command?: string | null
): Promise<string | null> => {
  const configured = env.RELAY_WHISPER_MODEL_PATH?.trim();
  if (configured) {
    const expandedConfigured = expandUserPath(configured, homeDirectory);
    return await fileExists(expandedConfigured) ? expandedConfigured : null;
  }

  const directories = [
    ...(command ? whisperCppModelDirectoriesForCommand(command) : []),
    ...whisperCppSearchDirectories(homeDirectory)
  ];
  for (const directory of directories) {
    for (const filename of WHISPER_CPP_MODEL_FILENAMES) {
      const candidate = nodePath.join(directory, filename);
      if (await fileExists(candidate)) return candidate;
    }
  }

  return null;
};

const resolveVoiceRuntime = async (dependencies: LocalVoiceDependencyOverrides = {}): Promise<ResolvedVoiceRuntime> => {
  const runCommand = dependencies.runCommand ?? defaultRunCommand;
  const readEnv = dependencies.readEnv ?? defaultReadEnv;
  const readHomeDirectory = dependencies.readHomeDirectory ?? defaultReadHomeDirectory;
  const readRegistryValue = dependencies.readRegistry ?? defaultReadRegistry;
  const fileExists = dependencies.fileExists ?? defaultFileExists;
  const env = await readEnv();
  const homeDirectory = await readHomeDirectory();
  const registry = await readRegistryValue();
  const configuredCommandPath = registry.voiceInput?.whisperCommandPath?.trim() || null;
  const defaultCommandPath = `~/${DEFAULT_WHISPER_CPP_COMMAND_SUFFIX.join("/")}`;
  const configuredCommand =
    env.RELAY_WHISPER_COMMAND?.trim() || configuredCommandPath || (await fileExists(defaultWhisperCppCommandPath(homeDirectory)))
      ? expandUserPath(env.RELAY_WHISPER_COMMAND?.trim() || configuredCommandPath || defaultCommandPath, homeDirectory)
      : null;
  const configuredBackend = env.RELAY_WHISPER_BACKEND?.trim() === "whisper" ? "whisper" : env.RELAY_WHISPER_BACKEND?.trim() === "whisper.cpp" ? "whisper.cpp" : null;

  const tryWhisperCpp = async (command: string): Promise<ResolvedVoiceRuntime | null> => {
    if (!(await commandLikelyExists(command, runCommand))) return null;
    const modelPath = await resolveWhisperCppModelPath(env, homeDirectory, fileExists, command);
    if (!modelPath) {
      return {
        available: false,
        backend: "whisper.cpp",
        command,
        configuredCommandPath,
        defaultCommandPath,
        message:
          "Local whisper.cpp was found, but no model file is configured. Install a ggml model locally or set `RELAY_WHISPER_MODEL_PATH`.",
        modelPath: null,
        pythonModel: null
      };
    }
    return {
      available: true,
      backend: "whisper.cpp",
      command,
      configuredCommandPath,
      defaultCommandPath,
      message: "Local whisper.cpp transcription is ready.",
      modelPath,
      pythonModel: null
    };
  };

  const tryPythonWhisper = async (command: string): Promise<ResolvedVoiceRuntime | null> => {
    if (!(await commandLikelyExists(command, runCommand))) return null;
    return {
      available: true,
      backend: "whisper",
      command,
      configuredCommandPath,
      defaultCommandPath,
      message: "Local Whisper transcription is ready.",
      modelPath: null,
      pythonModel: env.RELAY_WHISPER_MODEL?.trim() || "base"
    };
  };

  if (configuredCommand) {
    const backend = configuredBackend ?? (configuredCommand.includes("cli") || configuredCommand.includes("cpp") ? "whisper.cpp" : "whisper");
    return backend === "whisper.cpp"
      ? (await tryWhisperCpp(configuredCommand)) ?? {
          available: false,
          backend: "whisper.cpp",
          command: configuredCommand,
          configuredCommandPath,
          defaultCommandPath,
          message: `Configured whisper command \`${commandDisplayPath(configuredCommand, homeDirectory)}\` was not found.`,
          modelPath: null,
          pythonModel: null
        }
      : (await tryPythonWhisper(configuredCommand)) ?? {
          available: false,
          backend: "whisper",
          command: configuredCommand,
          configuredCommandPath,
          defaultCommandPath,
          message: `Configured whisper command \`${commandDisplayPath(configuredCommand, homeDirectory)}\` was not found.`,
          modelPath: null,
          pythonModel: null
        };
  }

  for (const command of WHISPER_CPP_COMMANDS) {
    const resolved = await tryWhisperCpp(command);
    if (resolved) return resolved;
  }

  for (const command of WHISPER_PYTHON_COMMANDS) {
    const resolved = await tryPythonWhisper(command);
    if (resolved) return resolved;
  }

  return {
    available: false,
    backend: null,
    command: null,
    configuredCommandPath,
    defaultCommandPath,
    message: "Local Whisper is not configured yet. Set the whisper.cpp CLI path to enable voice input.",
    modelPath: null,
    pythonModel: null
  };
};

const normalizeTranscript = (value: string): string => value.replace(/\s+/g, " ").trim();

export const readLocalVoiceInputStatus = async (
  dependencies: LocalVoiceDependencyOverrides = {}
): Promise<LocalVoiceInputStatus> => {
  const runtime = await resolveVoiceRuntime(dependencies);
  return {
    available: runtime.available,
    backend: runtime.backend,
    command: runtime.command,
    configuredCommandPath: runtime.configuredCommandPath,
    defaultCommandPath: runtime.defaultCommandPath,
    message: runtime.message
  };
};

export const configureLocalVoiceInput = async (
  input: LocalVoiceInputConfig,
  dependencies: LocalVoiceDependencyOverrides = {}
): Promise<LocalVoiceInputStatus> => {
  const readRegistryValue = dependencies.readRegistry ?? defaultReadRegistry;
  const writeRegistryValue = dependencies.writeRegistry ?? defaultWriteRegistry;
  const commandPath = input.commandPath.trim();
  if (!commandPath) {
    throw new Error("Enter a Whisper CLI path before saving.");
  }

  const registry = await readRegistryValue();
  await writeRegistryValue({
    ...registry,
    voiceInput: {
      ...(registry.voiceInput ?? { whisperCommandPath: null }),
      whisperCommandPath: commandPath
    }
  });
  return readLocalVoiceInputStatus(dependencies);
};

export const transcribeLocalVoiceInput = async (
  input: LocalVoiceInputTranscriptionRequest,
  dependencies: LocalVoiceDependencyOverrides = {}
): Promise<LocalVoiceInputTranscriptionResult> => {
  const runtime = await resolveVoiceRuntime(dependencies);
  if (!runtime.available || !runtime.backend || !runtime.command) {
    throw new Error(runtime.message || "Local Whisper transcription is unavailable.");
  }

  const createTempDir = dependencies.createTempDir ?? defaultCreateTempDir;
  const writeBinaryFile = dependencies.writeBinaryFile ?? defaultWriteBinaryFile;
  const readTextFile = dependencies.readTextFile ?? defaultReadTextFile;
  const removeDirectory = dependencies.removeDirectory ?? defaultRemoveDirectory;
  const runCommand = dependencies.runCommand ?? defaultRunCommand;
  const tempDir = await createTempDir();
  const audioPath = nodePath.join(tempDir, "ticket-idea.wav");

  try {
    await writeBinaryFile(audioPath, Buffer.from(input.audioBase64, "base64"));

    let transcriptPath: string;
    if (runtime.backend === "whisper.cpp") {
      const outputBase = nodePath.join(tempDir, "transcript");
      await runCommand(runtime.command, ["-m", runtime.modelPath!, "-f", audioPath, "-of", outputBase, "-otxt", "-nt", "-np"]);
      transcriptPath = `${outputBase}.txt`;
    } else {
      await runCommand(runtime.command, [
        audioPath,
        "--model",
        runtime.pythonModel ?? "base",
        "--output_dir",
        tempDir,
        "--output_format",
        "txt",
        "--fp16",
        "False",
        "--verbose",
        "False"
      ]);
      transcriptPath = nodePath.join(tempDir, `${nodePath.parse(audioPath).name}.txt`);
    }

    const transcript = normalizeTranscript(await readTextFile(transcriptPath));
    if (!transcript) {
      throw new Error("Local Whisper completed without returning a transcript.");
    }
    return { transcript };
  } finally {
    await removeDirectory(tempDir);
  }
};
