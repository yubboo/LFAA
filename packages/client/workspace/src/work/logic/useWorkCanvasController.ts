/**
 * 文件：useWorkCanvasController.ts
 * 作用：Work / Manual 共用 Canvas 产品状态唯一 Owner。
 * 负责：节点坐标、workspace-scoped 布局、用户可编辑节点内容、viewport commit 与 Agent 可消费的画布上下文摘要。
 * 不负责：Agent Run 生命周期、模型、权限、InfiniteCanvas Pointer 高频状态。
 * 状态归属：Workspace Canvas 产品模块；Session 只消费 contextText，不复制节点状态。
 * 对外接口：useWorkCanvasController({ workspaceId, lastRunInput })。
 * 关联文件：work-canvas-layout.ts、work-canvas-content.ts、WorkWorkspace.tsx、ManualWorkspace.tsx。
 * 修改注意事项：PointerMove 只更新视觉 state；布局和语义内容分开持久化，禁止把 Runtime 状态写入 Canvas。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INFINITE_CANVAS_DEFAULT_VIEWPORT, type InfiniteCanvasNode, type InfiniteCanvasViewport } from "@lfaa/ui";
import { INITIAL_WORK_NODES } from "../contracts/work-canvas.model";
import type { WorkCanvasController, WorkCanvasLayoutSnapshot } from "../contracts/work-canvas.types";
import {
  WORK_CANVAS_PERSIST_DEBOUNCE_MS,
  mergeWorkCanvasNodePositions,
  readWorkCanvasLayout,
  resolveWorkCanvasLayoutKey,
  writeWorkCanvasLayout,
} from "./work-canvas-layout";
import {
  buildWorkCanvasContext,
  mergeWorkCanvasContent,
  readWorkCanvasContent,
  writeWorkCanvasContent,
  type WorkCanvasContentSnapshot,
} from "./work-canvas-content";

function snapshotContent(nodes: readonly InfiniteCanvasNode[]): WorkCanvasContentSnapshot {
  return Object.fromEntries(nodes.map((node) => [node.id, {
    title: node.title,
    ...(node.description ? { description: node.description } : {}),
  }]));
}

export function useWorkCanvasController({ workspaceId, lastRunInput, lastRunOutput = null }: {
  workspaceId: string | undefined;
  lastRunInput: string | null;
  lastRunOutput?: string | null;
}): WorkCanvasController {
  const storageKey = resolveWorkCanvasLayoutKey(workspaceId);
  const [initialLayout] = useState<WorkCanvasLayoutSnapshot | null>(() => readWorkCanvasLayout(storageKey));
  const [nodes, setNodes] = useState<readonly InfiniteCanvasNode[]>(() => mergeWorkCanvasContent(
    mergeWorkCanvasNodePositions(INITIAL_WORK_NODES, initialLayout),
    readWorkCanvasContent(workspaceId),
  ));
  const [initialViewport, setInitialViewport] = useState<InfiniteCanvasViewport>(() => initialLayout?.viewport ?? { ...INFINITE_CANVAS_DEFAULT_VIEWPORT });
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const nodesRef = useRef<readonly InfiniteCanvasNode[]>(nodes);
  const viewportRef = useRef<InfiniteCanvasViewport>(initialViewport);
  const storageKeyRef = useRef(storageKey);
  const persistTimerRef = useRef<number | null>(null);

  const clearPersistTimer = useCallback(() => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
  }, []);

  const persistLayout = useCallback((nextNodes: readonly InfiniteCanvasNode[], viewport = viewportRef.current) => {
    writeWorkCanvasLayout(storageKey, nextNodes, viewport);
  }, [storageKey]);

  const onNodesChange = useCallback((nextNodes: readonly InfiniteCanvasNode[]) => {
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    if (typeof window === "undefined") return;
    clearPersistTimer();
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      persistLayout(nextNodes);
    }, WORK_CANVAS_PERSIST_DEBOUNCE_MS);
  }, [clearPersistTimer, persistLayout]);

  const onNodesCommit = useCallback((nextNodes: readonly InfiniteCanvasNode[]) => {
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    clearPersistTimer();
    persistLayout(nextNodes);
  }, [clearPersistTimer, persistLayout]);

  const onViewportCommit = useCallback((viewport: InfiniteCanvasViewport) => {
    viewportRef.current = viewport;
    persistLayout(nodesRef.current, viewport);
  }, [persistLayout]);

  const updateActiveNodeContent = useCallback((title: string, description: string) => {
    if (!activeNodeId) return;
    const safeTitle = title.trim().slice(0, 160);
    if (!safeTitle) return;
    const safeDescription = description.trim().slice(0, 1200);
    setNodes((current) => {
      const next = current.map((node) => node.id === activeNodeId
        ? (safeDescription ? { ...node, title: safeTitle, description: safeDescription } : (() => { const { description: _description, ...rest } = node; return { ...rest, title: safeTitle }; })())
        : node);
      nodesRef.current = next;
      writeWorkCanvasContent(workspaceId, snapshotContent(next));
      return next;
    });
  }, [activeNodeId, workspaceId]);

  useEffect(() => () => clearPersistTimer(), [clearPersistTimer]);

  useEffect(() => {
    if (storageKeyRef.current === storageKey) return;
    clearPersistTimer();
    const nextLayout = readWorkCanvasLayout(storageKey);
    const nextNodes = mergeWorkCanvasContent(
      mergeWorkCanvasNodePositions(INITIAL_WORK_NODES, nextLayout),
      readWorkCanvasContent(workspaceId),
    );
    const nextViewport = nextLayout?.viewport ?? { ...INFINITE_CANVAS_DEFAULT_VIEWPORT };
    storageKeyRef.current = storageKey;
    nodesRef.current = nextNodes;
    viewportRef.current = nextViewport;
    setNodes(nextNodes);
    setInitialViewport(nextViewport);
    setActiveNodeId(null);
    setCanvasEpoch((value) => value + 1);
  }, [clearPersistTimer, storageKey, workspaceId]);

  useEffect(() => {
    if (!lastRunInput) return;
    setNodes((current) => {
      const next = current.map((node) => node.id === "goal"
        ? { ...node, description: lastRunInput, status: "done" as const }
        : node.id === "agent"
          ? { ...node, status: "running" as const }
          : node);
      nodesRef.current = next;
      return next;
    });
  }, [lastRunInput]);

  useEffect(() => {
    if (!lastRunOutput) return;
    setNodes((current) => {
      const next = current.map((node) => node.id === "agent"
        ? { ...node, status: "done" as const }
        : node.id === "result"
          ? { ...node, description: lastRunOutput.slice(0, 1200), status: "done" as const }
          : node);
      nodesRef.current = next;
      return next;
    });
  }, [lastRunOutput]);

  const activeNode = activeNodeId ? nodes.find((node) => node.id === activeNodeId) ?? null : null;
  const contextText = useMemo(() => buildWorkCanvasContext(nodes), [nodes]);

  return {
    canvasKey: `${storageKey}:${canvasEpoch}`,
    nodes,
    initialViewport,
    activeNode,
    contextText,
    onNodesChange,
    onNodesCommit,
    onViewportCommit,
    activateNode: setActiveNodeId,
    closeNodeEditor: () => setActiveNodeId(null),
    updateActiveNodeContent,
  };
}
