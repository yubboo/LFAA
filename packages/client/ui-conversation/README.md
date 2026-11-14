# LFAA Client Conversation UI

`lfaa-client-ui-conversation` owns reusable conversation navigation and scroll presentation used by AI Work. It does not load or persist sessions and does not decide run, approval, or permission state.

- `conversation-anchor-preview.ts` projects existing messages into navigation anchors and bounded labels.
- `conversation-scroll.ts` owns viewport tracking, scroll-follow policy, anchor layout, pointer coalescing, and cleanup of ResizeObserver/event/frame resources.
- `ConversationAnchorRail.tsx` renders keyboard-accessible question anchors and hover previews; its styles and reduced-motion behavior live in `conversation.css`.
- `ui-chat` passes current messages and callbacks. Session loading, send/stream behavior, preferences, and durable scroll restoration remain with their existing owners.

The chat package keeps source-path forwarding files for existing imports and focused checks.