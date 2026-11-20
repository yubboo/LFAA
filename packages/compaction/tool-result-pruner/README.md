---
description: "Tool result pruning: strips ANSI noise and caps long outputs by lines and characters with explicit omission markers."
kind: "package"
---

# @lfaa/tool-result-pruner

Keeps tool results readable and bounded through the `@lfaa/tools` middleware seam.

## Behaviour

- Removes ANSI colour codes, trailing spaces and runs of blank lines.
- Caps output by lines (default 1,200) and characters (default 40,000), keeping the head and tail and inserting an explicit "N lines/chars omitted" marker.
- Failed results are left untouched so error text stays intact for debugging.
- Per-tool overrides via `byTool` (`read_file`, `list_dir`, …), so noisy tools can be capped tighter than others.
- Sits below the spill threshold on purpose: pruning keeps normal results small, spilling still handles the truly huge ones.

## Usage

```ts
ctx.plugin(toolResultPrunerPlugin, { maxLines: 800, byTool: { list_dir: { maxLines: 300 } } });
```

The package default-exports the Cordis plugin.