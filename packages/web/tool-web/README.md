# `lfaa-tool-web`

## Responsibility

Registers the Agent-visible `web_search` and `web_fetch` tools. This package owns tool schemas, argument validation, bounded result rendering, Markdown source links, the untrusted-web-content notice, and HTML-to-text extraction.

HTML extraction removes script/style and other hidden content before returning text. If the bounded HTML prefix ends inside a content element, extraction discards the remaining prefix so incomplete script or CSS data cannot appear as page text; void elements such as `embed` only lose their tag.

The Agent Loop decides whether to call these tools. Tool authorization remains with the shared Permission Owner; this package adds no approval mode or network allowlist.

## Owner boundaries

- `lfaa-web` owns Provider registration/selection, shared request and result types, cancellation, and normalized errors.
- `lfaa-web-search-deepseek` owns DeepSeek search transport and resolves the active account credential on the server.
- `lfaa-web-fetch-http` owns public-address validation, redirect policy, timeout, response limits, and HTTP decoding.
- This package does not perform network requests, read credentials, select Providers, or execute page content.

## Settings and data

No settings are defined or persisted here. A real search Provider may read the active model account through the Settings Owner. User identity and cancellation are passed through the tool context; tests use isolated synthetic Providers and data.

## Validation

`pnpm --filter lfaa-tool-web build` builds this package under the repository root `dist/packages/`. Tool behavior is covered by `apps/cli/tests/web-capabilities.test.mjs` and the existing Agent/Provider tests.
