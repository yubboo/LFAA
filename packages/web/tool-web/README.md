# @lfaa/tool-web

Web page reader for the LFAA agent.

## Tool

| Tool | Purpose |
| --- | --- |
| `fetch_url` | Fetch a public http/https page and return readable text |

Guards: only `http`/`https`; localhost and private ranges are rejected; response is capped at 2 MB and 60k characters.

## Install

```bash
pnpm add @lfaa/tool-web
```

The package default-exports the Cordis plugin.