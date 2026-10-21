# LFAA Token Meter

`lfaa-token-meter` owns local heuristic token estimates and usage accumulation primitives. `estimateContextBreakdown()` estimates the model-visible system text, tool schemas, and conversation messages for one actual request. It flags image content because image token cost depends on the selected provider/model and cannot be derived from text length.

Estimates are only a composition aid before a response arrives. The Agent Loop replaces the total with the provider-reported prompt token count when available. Cache reads, output tokens, and cache hit percentages come only from provider usage fields; this package does not estimate cache hits or billing.
