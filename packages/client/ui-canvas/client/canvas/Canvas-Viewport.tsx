// React Flow 交互视图：拖动期间只更新渲染位置，落点才交给画布文档。
import { useMemo, useRef, useState } from "react";
import { Background, BackgroundVariant, MiniMap, ReactFlow, type Edge, type NodeChange, type ReactFlowProps } from "@xyflow/react";
import { CanvasEdge } from "./Canvas-Edge";
import { GraphNode, type FlowNode } from "./Graph-Node";
import styles from "./Canvas.module.css";

const nodeTypes = { canvas: GraphNode };
const edgeTypes = { canvasEdge: CanvasEdge };

type ViewportProps = Pick<ReactFlowProps<FlowNode, Edge>,
  "edges" | "defaultViewport" | "panOnDrag" | "selectionOnDrag" | "onNodesChange" | "onEdgesChange" |
  "onConnect" | "isValidConnection" | "onMoveEnd" | "onPaneClick" | "onNodeDoubleClick"
> & {
  nodes: FlowNode[];
  showGrid: boolean;
  showMinimap: boolean;
  label: string;
  onOpenMenu: (mode: "create" | "context", point: { x: number; y: number }, canvas: HTMLElement) => void;
};

export function CanvasViewport({ nodes, showGrid, showMinimap, label, onNodesChange, onMoveEnd, onOpenMenu, ...props }: ViewportProps) {
  const diagram = useRef<HTMLDivElement>(null);
  const rightPress = useRef<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState<ReadonlyMap<string, NonNullable<FlowNode["measured"]>>>(() => new Map());
  const [movingNodes, setMovingNodes] = useState<ReadonlyMap<string, FlowNode["position"]>>(() => new Map());

  // 受控节点须回传浏览器测量值，否则 React Flow 更新位置时会先隐藏节点和端口，等待重新测量。
  const measuredNodes = useMemo(() => nodes.map((node) => {
    const measured = dimensions.get(node.id);
    return measured ? { ...node, measured } : node;
  }), [nodes, dimensions]);
  const displayNodes = useMemo(() => movingNodes.size === 0 ? measuredNodes : measuredNodes.map((node) => {
    const position = movingNodes.get(node.id);
    return position ? { ...node, position, dragging: true } : node;
  }), [measuredNodes, movingNodes]);

  function changeNodes(changes: NodeChange<FlowNode>[]) {
    if (changes.some((change) => change.type === "dimensions" || change.type === "remove")) {
      setDimensions((previous) => {
        const next = new Map(previous);
        let changed = false;
        for (const change of changes) {
          if (change.type === "remove") {
            changed = next.delete(change.id) || changed;
          } else if (change.type === "dimensions" && change.dimensions) {
            const measured = next.get(change.id);
            if (measured?.width === change.dimensions.width && measured.height === change.dimensions.height) continue;
            next.set(change.id, change.dimensions);
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    }
    if (changes.some((change) => change.type === "position" || change.type === "remove")) {
      setMovingNodes((previous) => {
        const next = new Map(previous);
        for (const change of changes) {
          if (change.type === "position" && change.dragging && change.position) next.set(change.id, change.position);
          else if (change.type === "position" || change.type === "remove") next.delete(change.id);
        }
        return next.size || previous.size ? next : previous;
      });
    }
    const committed = changes.filter((change) => change.type !== "dimensions" && (change.type !== "position" || !change.dragging));
    if (committed.length) onNodesChange?.(committed);
  }

  const isPane = (target: EventTarget | null) => target instanceof Element && target.matches(".react-flow__pane");

  return (
    <div
      ref={diagram}
      role="region"
      aria-label={label}
      tabIndex={0}
      className={styles.diagram}
      data-node-drag={movingNodes.size ? "true" : undefined}
      onDoubleClick={(event) => {
        if (event.button === 0 && isPane(event.target)) onOpenMenu("create", { x: event.clientX, y: event.clientY }, event.currentTarget);
      }}
      onContextMenuCapture={(event) => { if (isPane(event.target)) event.preventDefault(); }}
      onPointerDownCapture={(event) => {
        rightPress.current = event.button === 2 && isPane(event.target) ? { x: event.clientX, y: event.clientY } : null;
      }}
      onPointerMoveCapture={(event) => {
        const start = rightPress.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) rightPress.current = null;
      }}
      onPointerCancelCapture={() => { rightPress.current = null; }}
      onPointerUpCapture={(event) => {
        // React Flow 的右键平移由 d3 处理，菜单只响应原地按下再松开的指针。
        const start = rightPress.current;
        rightPress.current = null;
        if (event.button === 2 && start && isPane(event.target) && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 4) {
          onOpenMenu("context", { x: event.clientX, y: event.clientY }, event.currentTarget);
        }
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        onOpenMenu("context", { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, event.currentTarget);
      }}
    >
      <ReactFlow
        {...props}
        nodes={displayNodes}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.15}
        maxZoom={2.5}
        zoomOnDoubleClick={false}
        onNodesChange={changeNodes}
        onMoveStart={() => { if (diagram.current) diagram.current.dataset.viewportMoving = "true"; }}
        onMoveEnd={(event, viewport) => {
          if (diagram.current) delete diagram.current.dataset.viewportMoving;
          onMoveEnd?.(event, viewport);
        }}
        deleteKeyCode={["Delete", "Backspace"]}
        nodesConnectable
        edgesReconnectable={false}
        colorMode="system"
        proOptions={{ hideAttribution: true }}
      >
        {showGrid && <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />}
        {showMinimap && <MiniMap position="bottom-left" className={styles.minimap} pannable zoomable />}
      </ReactFlow>
    </div>
  );
}
