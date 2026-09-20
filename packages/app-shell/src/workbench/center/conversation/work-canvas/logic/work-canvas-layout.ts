/**
 * 文件：work-canvas-layout.ts
 * 作用：Work Canvas workspace-scoped 视觉布局持久化。
 * 负责：版本化 key、容错读取、仅 x/y + viewport 序列化、按 node id 合并。
 * 不负责：Canvas 高频 Pointer 状态、Run/Session/Artifact 真值、Provider/模型状态。
 * 状态归属：浏览器 workspace 视觉偏好；业务真值不进入该 Snapshot。
 * 对外接口：resolve/read/merge/write WorkCanvasLayout helpers。
 * 关联文件：useWorkCanvasController.ts、work-canvas.types.ts、@lfaa/ui InfiniteCanvas。
 * 修改注意事项：只允许持久化 node id→x/y 与 viewport x/y/scale，禁止写入业务字段。
 */
import {
  INFINITE_CANVAS_DEFAULT_VIEWPORT,
  INFINITE_CANVAS_SCALE_RANGE,
  type InfiniteCanvasNode,
  type InfiniteCanvasViewport,
} from "@lfaa/ui";
import type { WorkCanvasLayoutSnapshot, WorkCanvasNodePosition } from "../contracts/work-canvas.types";

export const WORK_CANVAS_LAYOUT_KEY_PREFIX = "lfaa.workbench.canvas-layout.v1";
export const WORK_CANVAS_LAYOUT_VERSION = 1 as const;
export const WORK_CANVAS_PERSIST_DEBOUNCE_MS = 160;

export function resolveWorkCanvasLayoutKey(workspaceId: string | undefined) {
  const stableWorkspaceId = workspaceId?.trim() || "lfaa";
  return `${WORK_CANVAS_LAYOUT_KEY_PREFIX}:${encodeURIComponent(stableWorkspaceId)}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function readWorkCanvasLayout(storageKey: string): WorkCanvasLayoutSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; viewport?: Record<string, unknown>; nodePositions?: Record<string, unknown> };
    if (parsed.version !== WORK_CANVAS_LAYOUT_VERSION) return null;

    const rawViewport = parsed.viewport ?? {};
    const scale = isFiniteNumber(rawViewport.scale)
      && rawViewport.scale >= INFINITE_CANVAS_SCALE_RANGE.min
      && rawViewport.scale <= INFINITE_CANVAS_SCALE_RANGE.max
      ? rawViewport.scale
      : INFINITE_CANVAS_DEFAULT_VIEWPORT.scale;
    const viewport: InfiniteCanvasViewport = {
      x: isFiniteNumber(rawViewport.x) ? rawViewport.x : INFINITE_CANVAS_DEFAULT_VIEWPORT.x,
      y: isFiniteNumber(rawViewport.y) ? rawViewport.y : INFINITE_CANVAS_DEFAULT_VIEWPORT.y,
      scale,
    };

    const nodePositions: Record<string, WorkCanvasNodePosition> = {};
    if (parsed.nodePositions && typeof parsed.nodePositions === "object") {
      for (const [nodeId, candidate] of Object.entries(parsed.nodePositions)) {
        if (!candidate || typeof candidate !== "object") continue;
        const position = candidate as Record<string, unknown>;
        if (isFiniteNumber(position.x) && isFiniteNumber(position.y)) {
          nodePositions[nodeId] = { x: position.x, y: position.y };
        }
      }
    }
    return { version: WORK_CANVAS_LAYOUT_VERSION, viewport, nodePositions };
  } catch {
    return null;
  }
}

export function mergeWorkCanvasNodePositions(
  nodes: readonly InfiniteCanvasNode[],
  layout: WorkCanvasLayoutSnapshot | null,
): readonly InfiniteCanvasNode[] {
  if (!layout) return nodes.map((node) => ({ ...node }));
  return nodes.map((node) => {
    const position = layout.nodePositions[node.id];
    return position ? { ...node, x: position.x, y: position.y } : { ...node };
  });
}

export function writeWorkCanvasLayout(
  storageKey: string,
  nodes: readonly InfiniteCanvasNode[],
  viewport: InfiniteCanvasViewport,
) {
  if (typeof window === "undefined") return;
  const nodePositions = Object.fromEntries(nodes
    .filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y))
    .map((node) => [node.id, { x: node.x, y: node.y }]));
  const snapshot: WorkCanvasLayoutSnapshot = {
    version: WORK_CANVAS_LAYOUT_VERSION,
    viewport,
    nodePositions,
  };
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // Storage 不可用时只失去布局持久化；不能影响 Canvas 或 Agent Runtime。
  }
}
