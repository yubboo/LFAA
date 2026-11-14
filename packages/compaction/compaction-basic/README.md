# LFAA Basic Compaction

`lfaa-compaction-basic` owns the bounded summary strategy: configuration validation, range selection, summary generation, and replacement-result validation. `src/index.ts` exposes `createBasicCompactionEngine`; the package also exposes its focused config, range, and summarizer modules through package subpaths.

The Agent Loop decides when to call an injected compaction engine and supplies the current messages, tool schemas, reasoning-replay estimate, context window, and cancellation signal. This package uses the shared `lfaa-token-meter` estimator; it does not import or depend on Agent Loop. A non-positive or non-finite context window is rejected as an inapplicable compaction request. Provider calls and current Settings/permission context are injected by the existing LLM and Agent Loop owners.

The base Bundle registers this package as a required capability. It does not own Session history, account settings, credentials, permissions, or durable storage; a successful compaction returns a candidate message array for the caller to use. Configuration defaults are package strategy defaults, while account/model context-window capacity comes from the existing Settings/model-catalog sources and the Agent Loop request contract.

Source implementation and Bundle registration are present. The package build and type checks verify compilation only; they do not prove runtime plugin activation or real-provider compaction behavior.
