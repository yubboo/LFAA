# LFAA Token Meter

`lfaa-token-meter` owns the single local heuristic token estimator and usage accumulation primitives. `estimateContextBreakdown()` is shared by the Agent Loop pressure/compaction path, the LLM request observer, and Pi context consumers. It counts system text, tool schemas, message roles/content, tool calls/results, and one conservative 1,200-token reserve per image while flagging image presence; image cost remains provider/model-specific. The LLM Owner supplies the effective reasoning replay character count for the selected account/Provider/model, so the estimator counts replay once and excludes stale cross-route replay payloads.

Estimates are only a composition aid before a response arrives. The Agent Loop replaces the total with the provider-reported prompt token count when available. Cache reads, output tokens, and cache hit percentages come only from provider usage fields; this package does not estimate cache hits or billing.
