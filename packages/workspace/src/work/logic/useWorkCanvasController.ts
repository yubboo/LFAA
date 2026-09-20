/**
 * 文件：useWorkCanvasController.ts
 * 作用：Work Canvas 视觉布局状态唯一 Owner。
 * 负责：节点坐标、workspace-scoped layout、viewport commit、最近 Run 输入驱动的画布视图状态同步。
 * 不负责：Agent Run 生命周期、模型、权限、InfiniteCanvas Pointer 高频状态。
 * 状态归属：Work Canvas 产品模块；Session 只提供 lastRunInput。
 * 对外接口：useWorkCanvasController({ workspaceId, lastRunInput })。
 * 关联文件：work-canvas-layout.ts、WorkWorkspace.tsx、@lfaa/ui InfiniteCanvas。
 * 修改注意事项：PointerMove 只更新视觉 state；持久化必须 debounce 或低频 commit。
 */
import { useCallback, useEffect, useRef, useState } from "react";
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

export function useWorkCanvasController({ workspaceId, lastRunInput }: {
  workspaceId: string | undefined;
  lastRunInput: string | null;
}): WorkCanvasController {
  const storageKey = resolveWorkCanvasLayoutKey(workspaceId);
  const [initialLayout] = useState<WorkCanvasLayoutSnapshot | null>(() => readWorkCanvasLayout(storageKey));
  const [nodes, setNodes] = useState<readonly InfiniteCanvasNode[]>(() => mergeWorkCanvasNodePositions(INITIAL_WORK_NODES, initialLayout));
  const [initialViewport, setInitialViewport] = useState<InfiniteCanvasViewport>(() => initialLayout?.viewport ?? { ...INFINITE_CANVAS_DEFAULT_VIEWPORT });
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

  useEffect(() => () => clearPersistTimer(), [clearPersistTimer]);

  useEffect(() => {
    if (storageKeyRef.current === storageKey) return;
    clearPersistTimer();
    const nextLayout = readWorkCanvasLayout(storageKey);
    const nextNodes = mergeWorkCanvasNodePositions(INITIAL_WORK_NODES, nextLayout);
    const nextViewport = nextLayout?.viewport ?? { ...INFINITE_CANVAS_DEFAULT_VIEWPORT };
    storageKeyRef.current = storageKey;
    nodesRef.current = nextNodes;
    viewportRef.current = nextViewport;
    setNodes(nextNodes);
    setInitialViewport(nextViewport);
    setCanvasEpoch((value) => value + 1);
  }, [clearPersistTimer, storageKey]);

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

  return {
    canvasKey: `${storageKey}:${canvasEpoch}`,
    nodes,
    initialViewport,
    onNodesChange,
    onNodesCommit,
    onViewportCommit,
  };
}
