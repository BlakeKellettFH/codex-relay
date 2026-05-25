# Cursor ticket draft response

Relay uses the Cursor CLI for ticket drafting. Cursor does not receive Relay's JSON Schema API the way Codex does. Your **final** message must be **exactly one** valid JSON object — no markdown code fences around it, no trailing commentary after the JSON.

## Rules

- Match the field names and shapes in the example below.
- Use `draftState`: `"ready"` when the ticket is implementation-ready; otherwise `"needs_clarification"` and put blocking questions in `blockingClarificationQuestions`.
- For Feature mode: `ticketType` must be `"feature"`, `subtickets` and `featureStubs` must be `[]`, and executable work goes in `leanTasks` (each with a non-empty `plannedFiles` array of repo-relative paths).
- For Epic mode: `ticketType` must be `"epic"` with `featureStubs`; `leanTasks` and `subtickets` must be `[]`.
- For a single task draft: `ticketType` `"task"`, non-empty `plannedFiles`, and `subtickets`, `featureStubs`, `leanTasks` all `[]`.
- Keep list fields concise; put detailed steps in `implementationPlan`, not open-ended research tasks.

## Example (feature with one lean task)

```json
{
  "draftState": "ready",
  "blockingClarificationQuestions": [],
  "ticketType": "feature",
  "title": "Add health check endpoint",
  "summary": "Expose a lightweight GET /health so deploys and load balancers can verify the API process is up.\n- Returns 200 with service name and version\n- No auth required\n- Covered by an integration test",
  "priority": "medium",
  "labels": ["api", "ops"],
  "context": "Operators need a stable probe that does not hit the database.",
  "researchFindings": [
    "src/server/app.ts mounts routes via createApp() — add route next to existing / routes.",
    "package.json version field can be read for the response payload."
  ],
  "requirements": [
    "GET /health returns 200 JSON with status, name, and version.",
    "Endpoint must not require authentication."
  ],
  "implementationPlan": [
    "Register GET /health in the Express app and return { status: 'ok', name, version }.",
    "Read version from package.json at startup or via existing config helper."
  ],
  "testPlan": [
    "Integration test: GET /health returns 200 and expected JSON shape."
  ],
  "acceptanceCriteria": [
    "curl localhost:PORT/health returns 200 with status ok and version string."
  ],
  "clarificationQuestions": [],
  "assumptions": ["Version comes from package.json, not environment override."],
  "implementationNotes": [],
  "plannedFiles": ["src/server/routes/health.ts", "src/server/app.ts"],
  "subtickets": [],
  "featureStubs": [],
  "leanTasks": [
    {
      "title": "Implement /health route and test",
      "summary": "Wire GET /health and an integration test.\n- Route module + app registration\n- Test asserts 200 and JSON fields",
      "priority": "medium",
      "labels": ["api"],
      "context": "First executable slice for the feature.",
      "goal": "Ship the health endpoint and automated check.",
      "requirements": ["GET /health registered and tested."],
      "acceptanceCriteria": ["Test passes in CI."],
      "implementationPlan": [
        "Add health.ts route handler.",
        "Mount route in app.ts.",
        "Add integration test file."
      ],
      "assumptions": [],
      "plannedFiles": ["src/server/routes/health.ts", "src/server/app.ts", "tests/health.test.ts"]
    }
  ]
}
```
