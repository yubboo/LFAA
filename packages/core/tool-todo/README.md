# @lfaa/tool-todo

Todo-list tools for the LFAA agent.

## Tools

| Tool | Purpose |
| --- | --- |
| `todo_write` | Create or update the session todo list (same `id` overwrites, new `id` appends) |
| `todo_read` | Read the current list with progress statistics |

The list is kept in memory per session and cleared when the plugin unmounts.

## Install

```bash
pnpm add @lfaa/tool-todo
```

The package default-exports the Cordis plugin, so it can be mounted by the Cordis Loader.