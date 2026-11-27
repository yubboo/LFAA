// 保持工作台编辑、宿主持久化和运行轮询各自的状态归属。
import { useEffect, useRef, useState } from "react";
import type { BoardDetail, CanvasAsset, CanvasGraph, CanvasRun } from "@lfaa/canvas/contract";
import { CanvasApiError, getBoard, saveBoard, submitNode } from "../api/canvas-api";

const asGraph = ({ nodes, edges, viewport }: CanvasGraph): CanvasGraph => ({ nodes, edges, viewport });

export function useCanvasDocument(path: string, initial: BoardDetail) {
  const [graph, setGraph] = useState(() => asGraph(initial.board));
  const [assets, setAssets] = useState(initial.assets);
  const [runs, setRuns] = useState(initial.runs);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const current = useRef(graph);
  const saved = useRef(graph);
  const undoStack = useRef<CanvasGraph[]>([]);
  const redoStack = useRef<CanvasGraph[]>([]);
  const revision = useRef(initial.board.revision);
  const writing = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestIds = useRef(new Map<string, string>());
  const submitting = useRef(new Set<string>());

  function report(cause: unknown) {
    if (cause instanceof CanvasApiError && cause.status === 409) setConflict(true);
    setError(cause instanceof Error ? cause.message : String(cause));
  }

  function flush(): Promise<void> {
    clearTimeout(timer.current);
    const write = async () => {
      const requested = current.current;
      if (requested === saved.current) return;
      const board = await saveBoard(path, revision.current, requested);
      revision.current = board.revision;
      saved.current = requested;
      if (requested === current.current) setDirty(false);
    };
    const pending = writing.current.then(write, write);
    writing.current = pending;
    return pending;
  }

  function commit(next: CanvasGraph, recordHistory = true) {
    if (recordHistory) {
      undoStack.current = [...undoStack.current.slice(-39), current.current];
      redoStack.current = [];
      setHistoryState({ canUndo: undoStack.current.length > 0, canRedo: false });
    }
    current.current = next;
    setGraph(next);
    setDirty(true);
    clearTimeout(timer.current);
    if (!conflict) timer.current = setTimeout(() => void flush().catch(report), 230);
  }

  function change(update: CanvasGraph | ((previous: CanvasGraph) => CanvasGraph), recordHistory = true) {
    const next = typeof update === "function" ? update(current.current) : update;
    if (next !== current.current) commit(next, recordHistory);
  }

  function undo() {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(current.current);
    setHistoryState({ canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0 });
    // 撤销内容编辑时保持当前视口，避免下次打开画布跳回旧缩放位置。
    commit({ ...prev, viewport: current.current.viewport }, false);
  }

  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(current.current);
    setHistoryState({ canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0 });
    commit({ ...next, viewport: current.current.viewport }, false);
  }

  function sync(detail: BoardDetail) {
    setAssets(detail.assets);
    setRuns(detail.runs);
  }

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => void getBoard(path, controller.signal).then(sync).catch((cause: unknown) => {
      if (!controller.signal.aborted) report(cause);
    });
    const interval = setInterval(refresh, 4200);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [path]);

  useEffect(() => () => {
    if (timer.current) void flush().catch((cause: unknown) => report(cause));
  }, [path]);

  async function reload() {
    try {
      clearTimeout(timer.current);
      await writing.current.catch(() => undefined);
      const detail = await getBoard(path);
      const next = asGraph(detail.board);
      revision.current = detail.board.revision;
      current.current = next;
      saved.current = next;
      setGraph(next);
      setDirty(false);
      setConflict(false);
      setError("");
      sync(detail);
    } catch (cause) {
      report(cause);
    }
  }

  async function run(nodeId: string) {
    if (submitting.current.has(nodeId)) return;
    submitting.current.add(nodeId);
    setError("");
    try {
      await flush();
      const id = requestIds.current.get(nodeId) ?? crypto.randomUUID();
      requestIds.current.set(nodeId, id);
      const value = await submitNode(path, id, nodeId, revision.current);
      setRuns((existing) => [value, ...existing.filter((item) => item.id !== id)]);
      requestIds.current.delete(nodeId);
    } catch (cause) {
      if (cause instanceof CanvasApiError && cause.status < 500) requestIds.current.delete(nodeId);
      report(cause);
    } finally {
      submitting.current.delete(nodeId);
    }
  }

  const addAsset = (asset: CanvasAsset) => setAssets((existing) => [...existing.filter((item) => item.id !== asset.id), asset]);
  const addRunOutput = (run: CanvasRun) => {
    if (run.assetId) {
      change({ ...current.current, nodes: current.current.nodes.map((node) => node.id === run.nodeId ? { ...node, settings: { ...node.settings, resultId: run.assetId! } } : node) });
    }
  };

  return {
    graph, assets, runs, conflict, dirty, error,
    canUndo: historyState.canUndo, canRedo: historyState.canRedo,
    report, flush, change, undo, redo, reload, run, addAsset, addRunOutput,
    getGraph: () => current.current,
  };
}
