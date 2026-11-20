---
description: "Write-before-read policy: existing files must be read in the session before they can be written or edited."
kind: "package"
---

# @lfaa/fs-observation-policy

Prevents blind edits: `write_file` / `edit_file` on an **existing** file are refused until the same session has read that file.

## Behaviour

- Uses the `@lfaa/tools` middleware seam: `read_file` marks the resolved path as observed; guarded tools check the marker before executing.
- Creating a new file is always allowed (nothing to read yet).
- Paths that fall outside the workspace are left to the tool's own guard — the policy does not duplicate sandbox rules.
- A successful write/edit marks the file as read again, so formatting passes do not need an extra round trip.
- State is per session and cleared on unmount.

## Usage

```ts
ctx.plugin(fsObservationPolicyPlugin);
```

Guarded and observed tool names can be overridden with `guardedTools` / `observeTools`. The package default-exports the Cordis plugin.