---
description: "Runs the Think → Act → Check loop: assembles the model request, executes tools, and records each step."
kind: "package"
---

# @lfaa/agent

English | [中文](README.zh.md)

## Summary

Runs the Think → Act → Check loop: assembles the model request, executes tools, and records each step.

This package lives in `packages/core/agent`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/agent-profile`
- `@lfaa/context`
- `@lfaa/guard`
- `@lfaa/llm`
- `@lfaa/metrics`
- `@lfaa/memory`
- `@lfaa/rules`
- `@lfaa/tools`

## Dev Note

Each run uses the session's saved tool policy for discovery and execution. Legacy sessions keep their previous behavior. The session lock serializes run startup with preset changes.

A top-level run can use ask_user to persist a clarification and end before executing other tool calls in the same round. Parent messages retain actual delegated-run activity, including cancellation before the parent result is saved.

When the session makes media tools available, the chat model can use them without changing the selected model. The run passes host-validated image references to the generation tool and preserves previews in the final response.

For a preview request, the main agent presents the current browser tab. Delegated verification uses the requested target, interaction, expected result, and stopping condition.

At the end of every run the agent makes one cheap model call to distil the round's conclusions, decisions and pitfalls into at most three structured long-term memories, on top of the explicit-preference regex. Distilled items are deduplicated by similarity and supersede stale conclusions; failures and timeouts are swallowed so the answer is never blocked. The model can also call `recall_memory` to search existing memories, `save_memory` to store a typed memory and `forget_memory` to drop invalidated ones.
