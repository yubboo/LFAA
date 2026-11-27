// 管理右侧工作台标签页（文件/浏览器/审查/辅助面板/插件标签）、当前舞台、工作区文件树显隐与目录展开状态的浏览器持久化偏好。
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
  auxTabs: RightAuxTab[];
  activeAux: RightAuxTab | null;
  /** 已打开的右栏插件标签 id（如无限画布 "canvas"），刷新后完整恢复。 */
  extensionTabs: string[];
  /** 当前选中的右栏插件标签 id；null 表示当前未激活插件标签。 */
  activeExtensionTab: string | null;
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
    auxTabs: [],
    activeAux: null,
    extensionTabs: [],
    activeExtensionTab: null,
  };
}

function normalizeAuxTab(value: unknown): RightAuxTab | null {
  if (typeof value !== "string" || value === "filesTree") return null;
  return VALID_AUX_TABS.has(value as RightAuxTab) ? (value as RightAuxTab) : null;
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
    // 兼容旧版单辅助面板记录：若无 auxTabs 数组但 auxOpen=true，按旧字段还原成单标签。
    const parsedActiveAux = normalizeAuxTab(parsed.activeAux);
    const auxTabs = Array.isArray(parsed.auxTabs)
      ? Array.from(new Set(parsed.auxTabs.map(normalizeAuxTab).filter((item): item is RightAuxTab => item !== null)))
      : (parsed.auxOpen && parsedActiveAux ? [parsedActiveAux] : []);
    const activeAux = parsedActiveAux && auxTabs.includes(parsedActiveAux)
      ? parsedActiveAux
      : (parsed.activeAux === null ? null : (parsed.auxOpen ? (auxTabs[0] ?? null) : null));
    const extensionTabs = Array.isArray(parsed.extensionTabs)
      ? Array.from(new Set(parsed.extensionTabs.filter((item): item is string => typeof item === "string" && item.trim().length > 0)))
      : [];
    const activeExtensionTab = typeof parsed.activeExtensionTab === "string" && extensionTabs.includes(parsed.activeExtensionTab)
      ? parsed.activeExtensionTab
      : null;
    return {
      filePreviewTabs: tabs,
      activeFilePreviewId,
      rightStageKind,
      browserOpen: Boolean(parsed.browserOpen),
      ...(typeof parsed.browserUrl === "string" && parsed.browserUrl.trim() ? { browserUrl: parsed.browserUrl.trim() } : {}),
      reviewTabOpen: Boolean(parsed.reviewTabOpen),
      ...(typeof parsed.reviewMessageId === "string" ? { reviewMessageId: parsed.reviewMessageId } : {}),
      fileTreeOpen: parsed.fileTreeOpen === true,
      auxOpen: auxTabs.length > 0,
      auxTabs,
      activeAux,
      extensionTabs,
      activeExtensionTab,
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
