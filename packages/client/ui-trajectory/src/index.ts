/** 功能：公开执行轨迹展示及其只读摘要。作用：供 AI Work 按消息数据渲染可公开活动，不展示隐藏推理。 */
import "./trajectory.css";

export { AiExecutionTrajectory } from "./AiExecutionTrajectory.js";
export type { AiExecutionTrajectoryProps } from "./AiExecutionTrajectory.js";
export {
  buildResponseTimeline,
  getResponseShimmerHue,
  latestBrowserPreviewActivity,
  responseToolGroupLabel,
  splitAiActivityDetail
} from "./response-timeline.js";
export type { ResponseTimelineBlock, ResponseTimelineLiveStatus } from "./response-timeline.js";
export {
  formatAiActivityDuration,
  getAiActivityActionLabel,
  getAiActivityDisplayStatus,
  getAiActivityDurationSeconds,
  getAiActivityStatusLabel,
  getAiActivitySummary
} from "./activity-duration.js";
export type { AiActivitySummary } from "./activity-duration.js";
export { aiActivityClock, createAiActivityClockStore } from "./activity-clock.js";
export type { AiActivityClockStore } from "./activity-clock.js";
