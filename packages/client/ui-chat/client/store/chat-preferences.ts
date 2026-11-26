// 聊天偏好本地持久化：活动会话、权限模式与推理档位的 localStorage 读写（受限环境静默降级）。
import type { ReasoningLevelOption } from "../shared/general-settings";
import type { AgentPermissionMode } from "./chat-types";

const ACTIVE_SESSION_KEY = "lfaa:active-chat-session-id";
const DRAFT_PROJECT_KEY = "lfaa:draft-project-id";
const DRAFT_SECTION_KEY = "lfaa:draft-section-id";
const PERMISSION_MODE_KEY = "lfaa:permission-mode";
const REASONING_LEVEL_KEY = "lfaa:reasoning-level";
const FOLLOW_AGENT_WORKBENCH_KEY = "lfaa:workbench-follow-agent";
const THREAD_VIRTUALIZATION_KEY = "lfaa:thread-virtualization";

/** 读取消息列是否启用窗口化：默认开启，显式写 "off" 即回滚到一次性渲染。 */
export function readStoredThreadVirtualization(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(THREAD_VIRTUALIZATION_KEY) !== "off";
  } catch {
    return true;
  }
}

/** 写入窗口化开关，供排查问题时临时回滚。 */
export function writeStoredThreadVirtualization(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.removeItem(THREAD_VIRTUALIZATION_KEY);
    else window.localStorage.setItem(THREAD_VIRTUALIZATION_KEY, "off");
  } catch {
    // 忽略存储配额限制。
  }
}

/** 读取右栏是否自动跟随 Agent 活动；默认开启，用户显式关闭后跨刷新记住。 */
export function readStoredFollowAgentWorkbench(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = window.localStorage.getItem(FOLLOW_AGENT_WORKBENCH_KEY);
    if (val === "false" || val === "0") return false;
  } catch {
    // 忽略存储读取限制。
  }
  return true;
}

/** 写入右栏自动跟随 Agent 偏好。 */
export function writeStoredFollowAgentWorkbench(follow: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FOLLOW_AGENT_WORKBENCH_KEY, follow ? "true" : "false");
  } catch {
    // 忽略存储配额限制。
  }
}

export function readStoredReasoningLevel(): ReasoningLevelOption {
  if (typeof window === "undefined") return "medium";
  try {
    const val = window.localStorage.getItem(REASONING_LEVEL_KEY);
    if (val === "minimal" || val === "low" || val === "medium" || val === "high" || val === "max") return val;
  } catch {
    // 忽略存储读取限制。
  }
  return "medium";
}

export function writeStoredReasoningLevel(level: ReasoningLevelOption): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REASONING_LEVEL_KEY, level);
  } catch {
    // 忽略存储配额限制。
  }
}

export function readStoredPermissionMode(): AgentPermissionMode {
  if (typeof window === "undefined") return "ask";
  try {
    const val = window.localStorage.getItem(PERMISSION_MODE_KEY);
    if (val === "ask" || val === "smart" || val === "full") return val;
  } catch {
    // 忽略存储读取限制。
  }
  return "ask";
}

export function writeStoredPermissionMode(mode: AgentPermissionMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PERMISSION_MODE_KEY, mode);
  } catch {
    // 忽略存储配额限制。
  }
}

export function readStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeStoredSessionId(sessionId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionId) window.localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    else window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // 忽略存储配额限制。
  }
}

function readStoredOptionalId(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(key);
    return val && val.trim() ? val : null;
  } catch {
    return null;
  }
}

function writeStoredOptionalId(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // 忽略存储配额限制。
  }
}

/** 读取上次新会话草稿绑定的项目 id，刷新后继续沿用项目上下文。 */
export function readStoredDraftProjectId(): string | null {
  return readStoredOptionalId(DRAFT_PROJECT_KEY);
}

/** 写入当前新会话草稿绑定的项目 id；null 表示解除项目绑定。 */
export function writeStoredDraftProjectId(projectId: string | null): void {
  writeStoredOptionalId(DRAFT_PROJECT_KEY, projectId);
}

/** 读取上次新会话草稿绑定的分区 id。 */
export function readStoredDraftSectionId(): string | null {
  return readStoredOptionalId(DRAFT_SECTION_KEY);
}

/** 写入当前新会话草稿绑定的分区 id。 */
export function writeStoredDraftSectionId(sectionId: string | null): void {
  writeStoredOptionalId(DRAFT_SECTION_KEY, sectionId);
}