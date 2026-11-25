// 管理右侧工作台标签页、当前舞台、工作区文件树显隐与目录展开状态的浏览器持久化偏好。
import type { FilePreviewTab } from "./chat-types";
import type { RightAuxTab } from "../workbench/RightUtilityRail";

const WORKBENCH_STATE_PREFIX = "lfaa:workbench-state:v1:";
const TREE_EXPANDED_PREFIX = "lfaa:tree-expanded:v1:";
const VALID_AUX_TABS = new Set<RightAuxTab>(["filesTree", "workspaceContext", "terminal", "subagents", "sideAsk", "details"]);

export interface PersistedWorkbenchSessionState {
  filePreviewTabs: FilePreviewTab[];
  activeFilePreviewId: string | null;
  rightStageKind: "file" | "browser" | "review" | "subagent" | null;
  browserOpen: boolean;
  browserUrl?: string;
  reviewTabOpen: boolean;
  reviewMessageId?: string | undefined;
  fileTreeOpen: boolean;
  auxOpen: boolean;
  activeAux: RightAuxTab;
}

export function createDefaultWorkbenchSessionState(): PersistedWorkbenchSessionState {
  return {
    filePreviewTabs: [],
    activeFilePreviewId: null,
    rightStageKind: null,
    browserOpen: false,
    reviewTabOpen: false,
    fileTreeOpen: false,
    auxOpen: false,
    activeAux: "terminal",
  };
}

export function readWorkbenchSessionState(sessionId: string | null | undefined): PersistedWorkbenchSessionState {
  const fallback = createDefaultWorkbenchSessionState();
  if (typeof window === "undefined" || !sessionId) return fallback;
  try {
    const raw = window.localStorage.getItem(`${WORKBENCH_STATE_PREFIX}${sessionId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedWorkbenchSessionState>;
    const tabs = Array.isArray(parsed.filePreviewTabs)
      ? parsed.filePreviewTabs.filter((t): t is FilePreviewTab => Boolean(t && typeof t.id === "string" && typeof t.path === "string"))
      : [];
    const activeFilePreviewId = typeof parsed.activeFilePreviewId === "string" && tabs.some((t) => t.id === parsed.activeFilePreviewId)
      ? parsed.activeFilePreviewId
      : (tabs[0]?.id ?? null);
    const rightStageKind = parsed.rightStageKind === "file" || parsed.rightStageKind === "browser" || parsed.rightStageKind === "review"
      ? parsed.rightStageKind
      : null;
    const activeAux = typeof parsed.activeAux === "string" && VALID_AUX_TABS.has(parsed.activeAux as RightAuxTab)
      ? (parsed.activeAux as RightAuxTab)
      : "terminal";
    return {
      filePreviewTabs: tabs,
      activeFilePreviewId,
      rightStageKind,
      browserOpen: Boolean(parsed.browserOpen),
      ...(typeof parsed.browserUrl === "string" && parsed.browserUrl.trim() ? { browserUrl: parsed.browserUrl.trim() } : {}),
      reviewTabOpen: Boolean(parsed.reviewTabOpen),
      ...(typeof parsed.reviewMessageId === "string" ? { reviewMessageId: parsed.reviewMessageId } : {}),
      fileTreeOpen: parsed.fileTreeOpen === true,
      auxOpen: Boolean(parsed.auxOpen),
      activeAux,
    };
  } catch {
    return fallback;
  }
}

export function patchWorkbenchSessionState(
  sessionId: string | null | undefined,
  patch: Partial<PersistedWorkbenchSessionState>,
): void {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    const next = { ...readWorkbenchSessionState(sessionId), ...patch };
    window.localStorage.setItem(`${WORKBENCH_STATE_PREFIX}${sessionId}`, JSON.stringify(next));
  } catch {
    // 忽略浏览器本地存储配额或隐私模式限制
  }
}

export interface PersistedTreeExpanded {
  rootExpanded: boolean;
  dirs: string[];
}

export function readTreeExpandedState(projectId: string | null | undefined): PersistedTreeExpanded {
  const fallback: PersistedTreeExpanded = { rootExpanded: true, dirs: [] };
  if (typeof window === "undefined" || !projectId) return fallback;
  try {
    const raw = window.localStorage.getItem(`${TREE_EXPANDED_PREFIX}${projectId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedTreeExpanded>;
    return {
      rootExpanded: typeof parsed.rootExpanded === "boolean" ? parsed.rootExpanded : true,
      dirs: Array.isArray(parsed.dirs) ? parsed.dirs.filter((d): d is string => typeof d === "string") : [],
    };
  } catch {
    return fallback;
  }
}

export function writeTreeExpandedState(projectId: string | null | undefined, state: PersistedTreeExpanded): void {
  if (typeof window === "undefined" || !projectId) return;
  try {
    window.localStorage.setItem(`${TREE_EXPANDED_PREFIX}${projectId}`, JSON.stringify(state));
  } catch {
    // 忽略浏览器本地存储配额或隐私模式限制
  }
}
