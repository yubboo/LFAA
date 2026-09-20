/**
 * 文件：InfiniteCanvas.tsx
 * 作用：提供 Work Surface 的无限画布交互层。
 * 负责：pan、zoom、reset、节点拖拽、连线渲染、选中层级与低频布局 commit seam。
 * 不负责：执行 Agent、保存 Run/Session、调用模型、决定权限、拼持久化 key 或直接访问 localStorage。
 * 状态归属：组件内部拥有高频 viewport/drag 视觉状态；长期布局持久化由调用方通过 commit 回调负责。
 * 对外接口：InfiniteCanvas(props)、INFINITE_CANVAS_DEFAULT_VIEWPORT、INFINITE_CANVAS_SCALE_RANGE。
 * 关联文件：infinite-canvas.types.ts、infinite-canvas.css、@lfaa/app-shell/AgentWorkbench.tsx。
 * 修改注意事项：Canvas 只负责通用渲染与交互；PointerMove 期间禁止把 viewport 提升为 App Shell 受控状态。
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { InfiniteCanvasEdge, InfiniteCanvasNode, InfiniteCanvasProps, InfiniteCanvasViewport } from "./infinite-canvas.types";
import "./infinite-canvas.css";

export const INFINITE_CANVAS_SCALE_RANGE = Object.freeze({ min: 0.35, max: 2.4 });
export const INFINITE_CANVAS_DEFAULT_VIEWPORT: Readonly<InfiniteCanvasViewport> = Object.freeze({ x: 80, y: 72, scale: 1 });

const SCALE_STEP = 0.12;
const VIEWPORT_WHEEL_SETTLE_MS = 140;
const NODE_WIDTH = 250;
const NODE_HEIGHT = 116;

type DragState =
  | { kind: "pan"; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | { kind: "node"; pointerId: number; nodeId: string; startX: number; startY: number; originX: number; originY: number }
  | null;

function clampScale(value: number) {
  return Math.min(INFINITE_CANVAS_SCALE_RANGE.max, Math.max(INFINITE_CANVAS_SCALE_RANGE.min, value));
}

function sanitizeViewport(value: InfiniteCanvasViewport | undefined): InfiniteCanvasViewport {
  const fallback = INFINITE_CANVAS_DEFAULT_VIEWPORT;
  return {
    x: Number.isFinite(value?.x) ? value!.x : fallback.x,
    y: Number.isFinite(value?.y) ? value!.y : fallback.y,
    scale: Number.isFinite(value?.scale) ? clampScale(value!.scale) : fallback.scale,
  };
}

function nodeCenter(node: InfiniteCanvasNode) {
  return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 };
}

export function InfiniteCanvas({
  nodes,
  edges = [],
  onNodesChange,
  onNodesCommit,
  onNodeActivate,
  initialViewport,
  onViewportCommit,
  emptyHint = "在这里组织任务、智能体、工具与产物。",
}: InfiniteCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const lastDraggedNodesRef = useRef<readonly InfiniteCanvasNode[] | null>(null);
  const wheelCommitTimerRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState<InfiniteCanvasViewport>(() => sanitizeViewport(initialViewport));
  const viewportRef = useRef<InfiniteCanvasViewport>(viewport);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const visibleEdges = useMemo(() => edges.flatMap((edge) => {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (!from || !to) return [];
    return [{ edge, from: nodeCenter(from), to: nodeCenter(to) }];
  }), [edges, nodesById]);

  useEffect(() => () => {
    if (wheelCommitTimerRef.current !== null) window.clearTimeout(wheelCommitTimerRef.current);
  }, []);

  const setViewportVisual = (next: InfiniteCanvasViewport, commit = false) => {
    const safe = sanitizeViewport(next);
    viewportRef.current = safe;
    setViewport(safe);
    if (commit) onViewportCommit?.(safe);
  };

  const scheduleViewportCommit = () => {
    if (wheelCommitTimerRef.current !== null) window.clearTimeout(wheelCommitTimerRef.current);
    wheelCommitTimerRef.current = window.setTimeout(() => {
      wheelCommitTimerRef.current = null;
      onViewportCommit?.(viewportRef.current);
    }, VIEWPORT_WHEEL_SETTLE_MS);
  };

  const applyScale = (nextScale: number, clientX?: number, clientY?: number, commit = false) => {
    const current = viewportRef.current;
    const scale = clampScale(nextScale);
    if (!rootRef.current || clientX === undefined || clientY === undefined) {
      setViewportVisual({ ...current, scale }, commit);
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - current.x) / current.scale;
    const worldY = (localY - current.y) / current.scale;
    setViewportVisual({
      scale,
      x: localX - worldX * scale,
      y: localY - worldY * scale,
    }, commit);
  };

  const beginPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".lfaa-infinite-canvas__node")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = viewportRef.current;
    dragRef.current = {
      kind: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: current.x,
      originY: current.y,
    };
  };

  const beginNodeDrag = (event: PointerEvent<HTMLButtonElement>, node: InfiniteCanvasNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedNodeId(node.id);
    lastDraggedNodesRef.current = null;
    dragRef.current = {
      kind: "node",
      pointerId: event.pointerId,
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === "pan") {
      setViewportVisual({
        ...viewportRef.current,
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      });
      return;
    }

    const scale = viewportRef.current.scale;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    const next = nodes.map((node) => node.id === drag.nodeId
      ? { ...node, x: drag.originX + dx, y: drag.originY + dy }
      : node);
    lastDraggedNodesRef.current = next;
    onNodesChange?.(next);
  };

  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === "pan") {
      onViewportCommit?.(viewportRef.current);
    } else {
      onNodesCommit?.(lastDraggedNodesRef.current ?? nodes);
      lastDraggedNodesRef.current = null;
    }
    dragRef.current = null;
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const current = viewportRef.current;
    if (event.ctrlKey || event.metaKey) {
      const direction = event.deltaY > 0 ? -1 : 1;
      applyScale(current.scale + direction * SCALE_STEP, event.clientX, event.clientY);
      scheduleViewportCommit();
      return;
    }
    setViewportVisual({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY });
    scheduleViewportCommit();
  };

  const resetViewport = () => {
    if (wheelCommitTimerRef.current !== null) {
      window.clearTimeout(wheelCommitTimerRef.current);
      wheelCommitTimerRef.current = null;
    }
    setViewportVisual({ ...INFINITE_CANVAS_DEFAULT_VIEWPORT }, true);
  };

  return (
    <div
      ref={rootRef}
      className="lfaa-infinite-canvas"
      onPointerDown={beginPan}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
      aria-label="工作无限画布"
    >
      <div className="lfaa-infinite-canvas__grid" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }} />
      <div className="lfaa-infinite-canvas__world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
        <svg className="lfaa-infinite-canvas__edges" aria-hidden="true">
          {visibleEdges.map(({ edge, from, to }) => {
            const bend = Math.max(70, Math.abs(to.x - from.x) * 0.42);
            const d = `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
            return <path key={edge.id} d={d} data-label={edge.label ?? ""} />;
          })}
        </svg>
        {nodes.map((node) => (
          <article
            key={node.id}
            className={`lfaa-infinite-canvas__node is-${node.kind}${selectedNodeId === node.id ? " is-selected" : ""}`}
            style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
            data-status={node.status ?? "idle"}
          >
            <button
              className="lfaa-infinite-canvas__node-drag"
              type="button"
              onPointerDown={(event) => beginNodeDrag(event, node)}
              onFocus={() => setSelectedNodeId(node.id)}
              onDoubleClick={() => onNodeActivate?.(node.id)}
            >
              <span className="lfaa-infinite-canvas__node-kind">{node.kind}</span>
              <strong>{node.title}</strong>
              {node.description ? <small>{node.description}</small> : null}
            </button>
            <i className="lfaa-infinite-canvas__port lfaa-infinite-canvas__port--in" aria-hidden="true" />
            <i className="lfaa-infinite-canvas__port lfaa-infinite-canvas__port--out" aria-hidden="true" />
          </article>
        ))}
      </div>

      {nodes.length === 0 ? <div className="lfaa-infinite-canvas__empty">{emptyHint}</div> : null}

      <div className="lfaa-infinite-canvas__controls" aria-label="画布缩放">
        <button type="button" onClick={() => applyScale(viewportRef.current.scale - SCALE_STEP, undefined, undefined, true)} aria-label="缩小">−</button>
        <span>{Math.round(viewport.scale * 100)}%</span>
        <button type="button" onClick={() => applyScale(viewportRef.current.scale + SCALE_STEP, undefined, undefined, true)} aria-label="放大">+</button>
        <button type="button" onClick={resetViewport}>复位</button>
      </div>
    </div>
  );
}
