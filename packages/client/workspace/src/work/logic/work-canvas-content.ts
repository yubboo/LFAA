/**
 * 文件：work-canvas-content.ts
 * 作用：持久化 Work / Manual 共用无限画布的用户可编辑语义内容。
 * 负责：按 workspace key 保存节点 title/description override，并生成可交给 Agent Core 的稳定上下文摘要。
 * 不负责：节点坐标/viewport、Agent Run、Provider、模型选择、工具执行。
 * 状态归属：Workspace Canvas 产品状态；布局继续由 work-canvas-layout.ts 单独拥有。
 * 对外接口：readWorkCanvasContent、writeWorkCanvasContent、mergeWorkCanvasContent、buildWorkCanvasContext。
 * 关联文件：useWorkCanvasController.ts、work-canvas-layout.ts、WorkWorkspace.tsx、ManualWorkspace.tsx。
 * 修改注意事项：只保存用户可编辑语义字段；禁止把 Runtime/Secret/Provider 状态写进 localStorage。
 */
import type { InfiniteCanvasNode } from "@lfaa/ui";

const WORK_CANVAS_CONTENT_KEY_PREFIX = "lfaa.workbench.canvas-content.v1";

export interface WorkCanvasNodeContent {
  readonly title: string;
  readonly description?: string;
}

export type WorkCanvasContentSnapshot = Readonly<Record<string, WorkCanvasNodeContent>>;

function storageKey(workspaceId: string | undefined): string {
  return `${WORK_CANVAS_CONTENT_KEY_PREFIX}:${encodeURIComponent(workspaceId?.trim() || "lfaa")}`;
}

export function readWorkCanvasContent(workspaceId: string | undefined): WorkCanvasContentSnapshot {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const output: Record<string, WorkCanvasNodeContent> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const record = value as Record<string, unknown>;
      if (typeof record.title !== "string" || !record.title.trim()) continue;
      output[id] = {
        title: record.title.trim().slice(0, 160),
        ...(typeof record.description === "string" && record.description.trim()
          ? { description: record.description.trim().slice(0, 1200) }
          : {}),
      };
    }
    return output;
  } catch {
    return {};
  }
}

export function writeWorkCanvasContent(workspaceId: string | undefined, snapshot: WorkCanvasContentSnapshot): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(snapshot));
}

export function mergeWorkCanvasContent(nodes: readonly InfiniteCanvasNode[], snapshot: WorkCanvasContentSnapshot): readonly InfiniteCanvasNode[] {
  return nodes.map((node) => {
    const content = snapshot[node.id];
    return content ? { ...node, title: content.title, ...(content.description ? { description: content.description } : {}) } : node;
  });
}

export function buildWorkCanvasContext(nodes: readonly InfiniteCanvasNode[]): string {
  return nodes.map((node) => {
    const description = node.description?.trim();
    return `- ${node.kind}:${node.id} | ${node.title}${description ? ` | ${description}` : ""}`;
  }).join("\n");
}
