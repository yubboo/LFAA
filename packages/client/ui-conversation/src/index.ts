/** 功能：公开会话导航与滚动展示组件。作用：复用提问锚点、预览和视口跟随逻辑，不读取或持久化会话。 */
import "./conversation.css";

export { ConversationAnchorRail } from "./ConversationAnchorRail.js";
export type { ConversationAnchorPreview } from "./conversation-anchor-preview.js";
export { buildConversationAnchors, conversationAnchorLabel, conversationAnchorReply } from "./conversation-anchor-preview.js";
export {
  buildConversationAnchorLayout,
  createConversationScrollTracker,
  createFrameCoalescer,
  findNearestConversationAnchorIndex,
  preserveConversationAnchorViewport,
  projectConversationWheelScroll,
  shouldAutoScrollToLatest,
  shouldFollowLatestMessage,
  shouldIgnoreMainConversationWheel,
  shouldRestoreConversationBottomPinned,
  shouldShowScrollToLatest,
  syncConversationScrollToLatest,
  updateConversationAnchorPointerTarget,
  updateResponseProcessFollowState
} from "./conversation-scroll.js";
export type { NestedConversationScrollMetrics } from "./conversation-scroll.js";