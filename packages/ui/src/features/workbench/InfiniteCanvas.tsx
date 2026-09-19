/**
 * 文件：InfiniteCanvas.tsx
 * 作用：提供 Work Surface 的无限画布交互层。
 * 负责：pan、zoom、reset、节点拖拽、连线投影与选中态。
 * 不负责：执行 Agent、保存 Run/Session、调用模型、决定权限。
 * 状态归属：只拥有 viewport 与节点视觉位置；业务实体真值仍归 Agent Runtime/Event Store。
 * 对外接口：InfiniteCanvas(props)。
 * 关联文件：infinite-canvas.types.ts、infinite-canvas.css、@lfaa/app-shell/AgentWorkbench.tsx。
 * 修改注意事项：Canvas 只能做 Projection，禁止把模型回复或 Tool 状态只保存在本组件 state 中。
 */
import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { InfiniteCanvasEdge, InfiniteCanvasNode, InfiniteCanvasProps } from "./infinite-canvas.types";
import "./infinite-canvas.css";

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.12;
const NODE_WIDTH = 250;
const NODE_HEIGHT = 116;

type DragState =
  | { kind: "pan"; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | { kind: "node"; pointerId: number; nodeId: string; startX: number; startY: number; originX: number; originY: number }
  | null;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function nodeCenter(node: InfiniteCanvasNode) {
  return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 };
}

export function InfiniteCanvas({ nodes, edges = [], onNodesChange, onNodeActivate, emptyHint = "在这里组织任务、智能体、工具与产物。" }: InfiniteCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const [viewport, setViewport] = useState({ x: 80, y: 72, scale: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const visibleEdges = useMemo(() => edges.flatMap((edge) => {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (!from || !to) return [];
    return [{ edge, from: nodeCenter(from), to: nodeCenter(to) }];
  }), [edges, nodesById]);

  const applyScale = (nextScale: number, clientX?: number, clientY?: number) => {
    setViewport((current) => {
      const scale = clampScale(nextScale);
      if (!rootRef.current || clientX === undefined || clientY === undefined) return { ...current, scale };
      const rect = rootRef.current.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const worldX = (localX - current.x) / current.scale;
      const worldY = (localY - current.y) / current.scale;
      return {
        scale,
        x: localX - worldX * scale,
        y: localY - worldY * scale,
      };
    });
  };

  const beginPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".lfaa-infinite-canvas__node")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
  };

  const beginNodeDrag = (event: PointerEvent<HTMLButtonElement>, node: InfiniteCanvasNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedNodeId(node.id);
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
      setViewport((current) => ({
        ...current,
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      }));
      return;
    }

    const dx = (event.clientX - drag.startX) / viewport.scale;
    const dy = (event.clientY - drag.startY) / viewport.scale;
    const next = nodes.map((node) => node.id === drag.nodeId
      ? { ...node, x: drag.originX + dx, y: drag.originY + dy }
      : node);
    onNodesChange?.(next);
  };

  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const direction = event.deltaY > 0 ? -1 : 1;
      applyScale(viewport.scale + direction * SCALE_STEP, event.clientX, event.clientY);
      return;
    }
    setViewport((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
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
            <button className="lfaa-infinite-canvas__node-drag" type="button" onPointerDown={(event) => beginNodeDrag(event, node)} onDoubleClick={() => onNodeActivate?.(node.id)}>
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
        <button type="button" onClick={() => applyScale(viewport.scale - SCALE_STEP)} aria-label="缩小">−</button>
        <span>{Math.round(viewport.scale * 100)}%</span>
        <button type="button" onClick={() => applyScale(viewport.scale + SCALE_STEP)} aria-label="放大">+</button>
        <button type="button" onClick={() => setViewport({ x: 80, y: 72, scale: 1 })}>复位</button>
      </div>
    </div>
  );
}
