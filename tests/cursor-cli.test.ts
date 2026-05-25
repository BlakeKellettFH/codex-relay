import test from "node:test";
import assert from "node:assert/strict";
import {
  CursorIncompleteResultError,
  createCursorAgentProvider,
  CURSOR_AGENT_CLI_CANDIDATES,
  CURSOR_AGENT_DEFAULT_MODEL,
  CURSOR_AGENT_OUTPUT_FORMAT_STREAM_JSON,
  CURSOR_STRUCTURED_JSON_INSTRUCTION,
  parseCursorAgentStatusOutput,
  resolveCursorAgentCli,
  structuredPromptForCursorAgent
} from "../src/services/agents/cursorProvider";

test("resolveCursorAgentCli prefers cursor-agent when it is installed", async () => {
  const calls: string[] = [];
  const resolved = await resolveCursorAgentCli(async (command) => {
    calls.push(command);
    if (command === "cursor-agent") {
      return { installed: true, version: "cursor-agent-build", failed: false };
    }
    return { installed: true, version: "agent-build", failed: false };
  });

  assert.deepEqual(calls, ["cursor-agent"]);
  assert.equal(resolved?.command, "cursor-agent");
  assert.equal(resolved?.version, "cursor-agent-build");
});

test("resolveCursorAgentCli falls back to agent when cursor-agent is missing", async () => {
  const resolved = await resolveCursorAgentCli(async (command) => ({
    installed: command === "agent",
    version: "2026.05.20-2b5dd59",
    failed: false
  }));

  assert.equal(resolved?.command, "agent");
  assert.equal(resolved?.version, "2026.05.20-2b5dd59");
  assert.deepEqual([...CURSOR_AGENT_CLI_CANDIDATES], ["cursor-agent", "agent"]);
});

test("parseCursorAgentStatusOutput detects logged-in CLI status output", () => {
  assert.equal(parseCursorAgentStatusOutput("✓ Logged in as user@example.com\n", ""), true);
  assert.equal(parseCursorAgentStatusOutput("", "Not logged in. Run `cursor-agent login`."), false);
});

test("createCursorAgentProvider invokes agent CLI with trust, print, auto model, and process cwd", async () => {
  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  const projectPath = "/Users/blakekellett/repos/codex-relay";
  const provider = createCursorAgentProvider({
    command: "agent",
    runCommand: async (command, args, options) => {
      calls.push({ command, args: [...args], cwd: options.cwd });
      return {
        stdout: [
          JSON.stringify({ type: "message.delta", delta: "Implementing." }),
          JSON.stringify({ type: "message.completed", message: "Done." }),
          JSON.stringify({ type: "result", session_id: "cursor-session-1" })
        ].join("\n"),
        stderr: ""
      };
    }
  });

  await provider.runText({
    kind: "ticket.implementation",
    projectPath,
    prompt: "Implement this.",
    mode: "write"
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.command, "agent");
  assert.deepEqual(calls[0]?.args, [
    "--trust",
    "--print",
    "--model",
    CURSOR_AGENT_DEFAULT_MODEL,
    "--output-format",
    CURSOR_AGENT_OUTPUT_FORMAT_STREAM_JSON,
    "--stream-partial-output",
    "Implement this."
  ]);
  assert.equal(calls[0]?.cwd, projectPath);
  assert.ok(!calls[0]?.args.includes("--format"));
  assert.ok(!calls[0]?.args.includes("--cwd"));
});

test("createCursorAgentProvider structured runs keep the standard CLI shape and ask for final JSON output", async () => {
  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  const projectPath = "/tmp/project";
  const provider = createCursorAgentProvider({
    command: "agent",
    runCommand: async (command, args, options) => {
      calls.push({ command, args: [...args], cwd: options.cwd });
      return {
        stdout: JSON.stringify({ draftState: "ready", summary: "ok" }),
        stderr: ""
      };
    }
  });

  const result = await provider.runStructured<{ draftState: string; summary: string }>({
    kind: "ticket.draft",
    projectPath,
    prompt: "Draft this ticket.",
    outputSchema: {},
    mode: "read_only"
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.command, "agent");
  assert.deepEqual(calls[0]?.args, [
    "--trust",
    "--print",
    "--model",
    CURSOR_AGENT_DEFAULT_MODEL,
    structuredPromptForCursorAgent("Draft this ticket.")
  ]);
  assert.equal(calls[0]?.cwd, projectPath);
  assert.ok(!calls[0]?.args.includes("--format"));
  assert.ok(!calls[0]?.args.includes("--output-format"));
  assert.match(calls[0]?.args.at(-1) ?? "", new RegExp(CURSOR_STRUCTURED_JSON_INSTRUCTION));
  assert.ok(!calls[0]?.args.includes("--cwd"));
  assert.equal(result.output.draftState, "ready");
  assert.equal(result.output.summary, "ok");
});

test("createCursorAgentProvider structured runs unwrap Cursor result envelopes whose result is a JSON string", async () => {
  const provider = createCursorAgentProvider({
    command: "cursor-agent",
    runCommand: async () => ({
      stdout: JSON.stringify({
        type: "result",
        subtype: "success",
        result: `Researching the codebase.\n${JSON.stringify({ draftState: "ready", summary: "ok" })}`,
        session_id: "cursor-session-9"
      }),
      stderr: ""
    })
  });

  const result = await provider.runStructured<{ draftState: string; summary: string }>({
    kind: "ticket.draft",
    projectPath: "/tmp/project",
    prompt: "Draft this ticket.",
    outputSchema: {},
    mode: "read_only"
  });

  assert.equal(result.output.draftState, "ready");
  assert.equal(result.output.summary, "ok");
  assert.equal(result.providerSessionRef?.externalId, "cursor-session-9");
});

test("createCursorAgentProvider uses request agentModel for --model", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const provider = createCursorAgentProvider({
    command: "agent",
    runCommand: async (command, args) => {
      calls.push({ command, args: [...args] });
      return { stdout: JSON.stringify({ draftState: "ready" }), stderr: "" };
    }
  });

  await provider.runStructured({
    kind: "ticket.draft",
    projectPath: "/tmp/project",
    prompt: "Draft.",
    outputSchema: {},
    mode: "read_only",
    agentModel: "auto"
  });

  assert.equal(calls[0]?.args[2], "--model");
  assert.equal(calls[0]?.args[3], "auto");
});

test("createCursorAgentProvider text runs parse Cursor stream-json output into final text and preserve raw events", async () => {
  const provider = createCursorAgentProvider({
    command: "cursor-agent",
    runCommand: async () => ({
      stdout: [
        JSON.stringify({ type: "command.started", command: "npm test" }),
        JSON.stringify({ type: "command.output", stdout: "tests passed\n" }),
        JSON.stringify({ type: "message.delta", delta: "Applying patch..." }),
        JSON.stringify({ type: "message.completed", message: "Implementation finished." }),
        JSON.stringify({ type: "result", session_id: "cursor-session-11" })
      ].join("\n"),
      stderr: ""
    })
  });

  const result = await provider.runText({
    kind: "ticket.implementation",
    projectPath: "/tmp/project",
    prompt: "Implement this ticket.",
    mode: "write"
  });

  assert.equal(result.text, "Implementation finished.");
  assert.match(result.rawResponse, /command\.started/);
  assert.equal(result.providerSessionRef?.externalId, "cursor-session-11");
});

test("createCursorAgentProvider runTextStream yields stream-json events and preserves final answer text", async () => {
  const stdoutChunks = [
    `${JSON.stringify({ type: "command.started", command: "rg repository chat" })}\n`,
    `${JSON.stringify({ type: "message.delta", delta: "The prompt lives in " })}\n`,
    `${JSON.stringify({ type: "message.completed", message: "The prompt lives in `src/services/codex/index.ts`." })}\n`,
    `${JSON.stringify({ type: "result", subtype: "success", result: "The prompt lives in `src/services/codex/index.ts`.", session_id: "cursor-session-stream" })}\n`
  ];
  const provider = createCursorAgentProvider({
    command: "cursor-agent",
    streamCommand: (_command, _args, _options) => {
      const queue = {
        chunks: (async function*() {
          for (const text of stdoutChunks) {
            yield { stream: "stdout" as const, text };
          }
        })(),
        completed: Promise.resolve({ stdout: stdoutChunks.join(""), stderr: "" })
      };
      return queue;
    }
  });

  const streamed = await provider.runTextStream({
    kind: "repository.chat",
    projectPath: "/tmp/project",
    prompt: "Where is the repository chat prompt built?",
    mode: "read_only"
  });
  const rawEvents: Record<string, unknown>[] = [];
  for await (const event of streamed.events) {
    if (event.rawEvent && typeof event.rawEvent === "object") {
      rawEvents.push(event.rawEvent as Record<string, unknown>);
    }
  }
  const completed = await streamed.completed;

  assert.ok(rawEvents.some((event) => event.type === "message.delta"));
  assert.ok(rawEvents.some((event) => event.type === "message.completed"));
  assert.equal(completed.text, "The prompt lives in `src/services/codex/index.ts`.");
  assert.equal(completed.providerSessionRef?.externalId, "cursor-session-stream");
});

test("createCursorAgentProvider stream fallback treats non-json stdout as command output, not assistant deltas", async () => {
  const stdoutChunks = ["Researching files...\n", `${JSON.stringify({ type: "message.completed", message: "Short final answer." })}\n`];
  const provider = createCursorAgentProvider({
    command: "cursor-agent",
    streamCommand: () => ({
      chunks: (async function*() {
        for (const text of stdoutChunks) {
          yield { stream: "stdout" as const, text };
        }
      })(),
      completed: Promise.resolve({ stdout: stdoutChunks.join(""), stderr: "" })
    })
  });

  const streamed = await provider.runTextStream({
    kind: "repository.chat",
    projectPath: "/tmp/project",
    prompt: "Answer briefly.",
    mode: "read_only"
  });

  const rawEvents: Record<string, unknown>[] = [];
  for await (const event of streamed.events) {
    if (event.rawEvent && typeof event.rawEvent === "object") rawEvents.push(event.rawEvent as Record<string, unknown>);
  }

  assert.ok(rawEvents.some((event) => event.type === "command.output"));
  assert.equal(rawEvents.some((event) => event.type === "message.delta" && event.text === "Researching files..."), false);
});

test("createCursorAgentProvider structured runs fail clearly when Cursor returns only progress text in the result envelope", async () => {
  const provider = createCursorAgentProvider({
    command: "cursor-agent",
    runCommand: async () => ({
      stdout: JSON.stringify({
        type: "result",
        subtype: "success",
        result: "Researching the codebase and draft schema before preparing the final ticket draft.\n",
        session_id: "cursor-session-10"
      }),
      stderr: ""
    })
  });

  await assert.rejects(
    provider.runStructured({
      kind: "ticket.draft",
      projectPath: "/tmp/project",
      prompt: "Draft this ticket.",
      outputSchema: {},
      mode: "read_only"
    }),
    (error) => error instanceof CursorIncompleteResultError && error.code === "cursor_incomplete_result"
  );
});
