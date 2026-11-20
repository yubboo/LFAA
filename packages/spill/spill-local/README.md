---
description: "Long tool results spilled to local files: keeps a head/tail window in context and returns the file path."
kind: "package"
---

# @lfaa/spill-local

Spills oversized tool output to disk through the `@lfaa/tools` middleware seam, so one huge command cannot flood the context window.

## Behaviour

- Threshold and window are configurable: 24k chars by default, returning 4k head + 2k tail.
- The full output is written to `<root>/<sessionId>/<time>-<tool>-<id>.txt` and the result carries `metadata.spillPath` plus the original character count.
- `ok`, `summary` and `fileChange` are preserved; only `output` is replaced by the window and a "read it with read_file" hint.
- Shorter results pass through untouched.

## Usage

```ts
ctx.plugin(spillLocalPlugin, { root: "E:/lfaa-data/spills", maxChars: 40_000 });
```

Default root is `~/.lfaa/spills`. The package default-exports the Cordis plugin.