---
description: "Per-call sandbox policy: chooses the sandbox mode for each tool call, defaulting to the caller's mode."
kind: "package"
---

# @lfaa/sandbox-policy

Lets a deployment pin the sandbox mode per tool instead of trusting every call site.

## Behaviour

- `mode` sets the mode for all constrained tools; `byTool` overrides per tool; `onlyTools` limits which tools the policy touches.
- Returning no mode leaves the caller's `sandboxMode` untouched (fail-open to existing behaviour, so mounting this plugin is never a silent surprise).
- Registered through `ToolsService.setSandboxResolver`, which runs **before** the sandbox check — the policy affects the decision, not just execution.
- When no `sandbox` service is mounted, the resolver is inert because the tool layer performs no sandbox checks.

## Usage

```ts
ctx.plugin(sandboxPolicyPlugin, { mode: "workspace-write", byTool: { run_command: "read-only" } });
```

The package default-exports the Cordis plugin (`inject: ["tools"]`).