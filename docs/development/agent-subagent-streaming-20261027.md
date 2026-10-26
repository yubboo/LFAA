# External Subagent Streaming Text Contract (2026-10-27)

## Audit finding

The main Agent already sends Provider text deltas through authenticated Run SSE. The Claude Agent SDK subagent previously returned only its final `result`; intermediate text never reached the parent Run. This change forwards safe top-level SDK text deltas through the same Run channel. The completed subtask still returns to the parent model through the tool observation.

## Owners and data flow

1. `lfaa-subagent-claude-code` enables SDK `includePartialMessages` and accepts only top-level `content_block_delta/text_delta` events where `parent_tool_use_id === null`. It filters thinking, tool arguments, and nested subagent text, then redacts the current API key before forwarding.
2. The SDK driver batches text by 2,048 characters or 72 ms and clears its timer on completion or cancellation. `lfaa-tool-subagent` sends each batch to the parent Agent Loop through `AiBusinessToolContext.onSubagentTextDelta`.
3. The Agent Loop publishes an in-memory `subagent-delta` event containing the parent `messageId`, current `activityId`, and a short text fragment. It does not append the event to model messages, Session JSONL, persistent Activity state, or the tool observation.
4. Client Connection verifies that the event belongs to the current Run and that each fragment is at most 2,048 characters. Chat activity details retain at most eight previews, each capped at 4,096 characters, and clear them when the Run ends or the Session changes. Reconnection does not replay transient deltas missed while disconnected.

No setting was added. The preview uses existing AI Work code typography and theme tokens; user preferences and the Permission Owner were unchanged. It appears only in expanded tool activity. The final answer and tool observation remain the authoritative task result.

## Validation

- Builds passed for `lfaa-tools`, `lfaa-subagent`, `lfaa-subagent-claude-code`, `lfaa-tool-subagent`, `lfaa-agent-loop`, `lfaa-client-connection`, and `lfaa-client-ui-chat`; outputs were written under the root `dist/packages/` directory.
- Host and Client TypeScript checks and `pnpm run build:web` passed; Web output was written under root `dist/apps/web/`.
- `subagent-claude-sdk-permissions.test.mjs` passed 9/9, covering partial message events, top-level text filtering, API-key redaction, and exclusion of hidden thinking, tool input, and nested content.
- `subagent-agent-loop-permission-bridge.test.mjs` passed 1/1, confirming that subagent text uses the parent Run transient event while approval and dispatch remain with the existing Permission Owner.
- A later token-usage batch passed 10/10 permission-bridge tests, covering SDK `modelUsage` conversion, Session aggregation, and isolation from parent-message usage. Host/Client type checks, seven direct Owner package builds, and `git diff --check` passed. No real Anthropic account or Provider was used; these tests do not prove billed cost or real cache-token reporting.
- The ChatGPT embedded-browser visual check of `/work` did not pass: the service on port 3000 returned the project’s “restart required” 503 page. An isolated Control Plane used `dist/.tmp` data and port 3010, but `/api/health` did not respond, so the launcher did not make the frontend available. Desktop and narrow-view interactions were not checked, and no screenshot was saved. The isolated processes were stopped without touching the service on port 3000.
- `git diff --check` passed.

## Remaining boundaries

SDK `modelUsage` is converted to per-model token counts and added to the existing Session summary with `purpose=subagent`. A synthetic Agent Loop regression confirms that this does not replace the parent assistant’s Provider usage. Real Anthropic Provider usage, live token streaming, visual browser and narrow viewport acceptance, and cross-platform cancellation remain unverified. SDK `costUSD` is an estimate and is not stored as an actual charge. Subagent text preview is a lossy activity delta, not recoverable history. If reconnect recovery is needed later, evaluate a bounded checkpoint instead of persisting the deltas as Session content. Network egress still has no domain allowlist; see the [Agent network egress contract](agent-network-egress-contract-20261027.md).

Temporary service data remains under `dist/.tmp/agent-subagent-stream-acceptance-20261027/`; the execution environment rejected the cleanup command, so this data is not claimed to be removed.

Chinese contract: [agent-subagent-streaming-20261027.zh.md](agent-subagent-streaming-20261027.zh.md).
