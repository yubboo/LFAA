# LFAA Compaction Contract

`lfaa-compaction` owns the public compaction protocol, message-range invariants, tool-call pairing checks, transaction IDs, and checkpoint envelopes. It does not select a compression strategy, call a model, persist Session history, or decide when a run should compact.

The public entry is `src/index.ts`. `lfaa-compaction-basic`, image offload, tool-result pruning, the explicit compact command, and Agent Loop adapters consume this contract. Implementations operate on the LFAA `AiCompletionMessage[]` representation and must preserve complete assistant tool-call/result pairs. `assertSummaryIsSmaller` is a coarse content-length invariant; request token budgeting remains owned by `lfaa-token-meter`.

The package has no settings, account data, or permission policy. It receives no credentials and has no external side effects. Its state is limited to opaque compaction transaction identifiers and validated message envelopes supplied by callers.

The source is implemented and the package is included in the base capability composition. Build or static checks do not by themselves verify runtime assembly or a real model compaction.
