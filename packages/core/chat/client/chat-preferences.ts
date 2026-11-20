// 聊天偏好本地持久化：活动会话、权限模式与推理档位的 localStorage 读写（受限环境静默降级）。
import type { ReasoningLevelOption } from "./general-settings-client";
import type { AgentPermissionMode } from "./chat-types";

const ACTIVE_SESSION_KEY = "lfaa:active-chat-session-id";
const PERMISSION_MODE_KEY = "lfaa:permission-mode";
const REASONING_LEVEL_KEY = "lfaa:reasoning-level";

export function readStoredReasoningLevel(): ReasoningLevelOption {
  if (typeof window === "undefined") return "high";
  try {
    const val = window.localStorage.getItem(REASONING_LEVEL_KEY);
    if (val === "minimal" || val === "low" || val === "medium" || val === "high" || val === "max") return val;
  } catch {
    // 忽略存储读取限制。
  }
  return "high";
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