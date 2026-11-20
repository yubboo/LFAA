---
description: "Tool timeout policy: wraps every tool execution with a deadline and aborts the call signal."
kind: "package"
---

# @lfaa/timeout-policy

Applies one timeout policy to every tool execution through the `@lfaa/tools` middleware seam.

## Behaviour

- Default deadline is 10 minutes; override globally with `defaultTimeoutMs` or per tool with `byTool`.
- Each execution gets its own `AbortSignal`; cancellation from the caller still propagates inward.
- A timeout returns `ok: false` with `metadata.timedOut` and a message telling the model it timed out (so it splits the task instead of retrying blindly).
- Known boundary: a tool that ignores `signal` may keep running in the background after the deadline.

## Usage

```ts
ctx.plugin(timeoutPolicyPlugin, { defaultTimeoutMs: 120_000, byTool: { run_command: 600_000 } });
```

The package default-exports the Cordis plugin, so the Loader can mount it by package name.