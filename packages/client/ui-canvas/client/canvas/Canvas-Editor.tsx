// 沉浸式无限画布编辑器：无顶条浮层布局、5 大模板多卡片弹窗、流光连线、底部控制胶囊与全屏 Agent 对话抽屉。
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ReactFlowProvider, useReactFlow,
  type Connection, type Edge, type EdgeChange, type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { inputPorts, type BoardDetail, type CanvasAsset, type CanvasNode, type CanvasNodeKind, type StageScene } from "@lfaa/canvas/contract";
import { assetUrl, linkLibraryAsset, renameBoard, uploadAsset, type CanvasListItem, type CanvasModel, type LibraryMediaEntry } from "../api/canvas-api";
import { labels } from "../locales";
import { CanvasBottomBar } from "./Canvas-Bottom-Bar";
import { readCanvasClipboard } from "./canvas-clipboard";
import { CanvasFullscreenChat } from "./Canvas-Drawers";
import { buildFlowEdges, buildFlowNodes, createCanvasNode, moveCanvasNodes, parseEdgeChanges, parseNodeChanges, resolveConnectionAsset } from "./canvas-graph-helpers";
import type { CanvasMediaOutput } from "./canvas-media-image";
import { CanvasMenu, type CanvasMenuAnchor } from "./Canvas-Menu";
import { CanvasTemplates } from "./Canvas-Templates";
import type { CanvasSubTemplate } from "./template-catalog";
import { CanvasTopBar } from "./Canvas-Top-Bar";
import { CanvasTools, type CanvasToolPanel } from "./Canvas-Tools";
import { CanvasViewport } from "./Canvas-Viewport";
import type { FlowNode } from "./Graph-Node";
import { NodeDock } from "./Node-Dock";
import { useCanvasDocument } from "./useCanvasDocument";
import styles from "./Canvas.module.css";

const PrevisEditor = lazy(() => import("../previs/Previs-Editor"));
type Position = CanvasNode["position"];

export interface EditorProps {
  path: string; initial: BoardDetail; boards: CanvasListItem[]; projectName: string;
  models: CanvasModel[]; isZh: boolean; maximized: boolean;
  onSelectBoard: (canvasId: string) => void; onCreateBoard: () => void;
  onOpenInNewWindow: (canvasId: string) => void;
  onDuplicateBoard: (canvasId: string, label: string) => void;
  onDeleteBoard: (canvasId: string) => void;
  onBackToProjects?: (() => void) | undefined; onRenamed: (title: string) => void;
  renderFullscreenChat?: (() => ReactNode) | undefined;
}

function Editor({
  path, initial, boards, projectName, models, isZh, maximized,
  onSelectBoard, onCreateBoard, onOpenInNewWindow, onDuplicateBoard, onDeleteBoard, onBackToProjects, onRenamed, renderFullscreenChat,
}: EditorProps) {
  const t = labels[isZh ? "zh" : "en"];
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [previsId, setPrevisId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tool, setTool] = useState<"select" | "hand">("select");
  const [showMinimap, setShowMinimap] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<CanvasToolPanel>(null);
  const [menu, setMenu] = useState<CanvasMenuAnchor | null>(null);
  const [libraryPosition, setLibraryPosition] = useState<Position>();
  const draggedLibraryItem = useRef<LibraryMediaEntry | null>(null);

  const doc = useCanvasDocument(path, initial);
  const { graph, assets, runs } = doc;
  const flow = useReactFlow<FlowNode, Edge>();
  const current = graph.nodes.find((node) => node.id === selected[0]);
  const previs = graph.nodes.find((node) => node.id === previsId);

  // 画布键盘撤销与重做。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("dialog[open]"))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) doc.redo();
        else doc.undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [doc]);

  const remove = useCallback((nodeIds: string[], edgeIds: string[]) => {
    doc.change((latest) => ({
      ...latest,
      nodes: latest.nodes.filter((node) => !nodeIds.includes(node.id)),
      edges: latest.edges.filter((edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target) && !edgeIds.includes(edge.id)),
    }));
    setSelected((items) => items.filter((id) => !nodeIds.includes(id)));
  }, [doc]);

  const patchNode = useCallback((id: string, update: (settings: CanvasNode["settings"]) => CanvasNode["settings"]) => {
    doc.change((latest) => {
      const nextNodes = latest.nodes.map((node) => node.id === id ? { ...node, settings: update(node.settings) } : node);
      const edited = nextNodes.find((node) => node.id === id);
      const ports = edited && inputPorts(edited);
      return { ...latest, nodes: nextNodes, edges: latest.edges.filter((edge) => edge.target !== id || ports?.some((port) => port.id === edge.targetPort)) };
    });
  }, [doc]);

  const upload = useCallback(async (id: string, file: Blob, name: string, field: "assetId" | "imageId" | "videoId") => {
    try {
      const snapshot = doc.getGraph();
      const previous = snapshot.nodes.find((node) => node.id === id);
      const existing = assets.find((asset) => asset.id === previous?.settings.assetId);
      if (field === "assetId" && existing && !file.type.startsWith(existing.kind + "/") && snapshot.edges.some((edge) => edge.source === id)) {
        throw new Error(t.invalid);
      }
      const asset = await uploadAsset(path, file, name);
      doc.addAsset(asset);
      patchNode(id, (settings) => ({ ...settings, [field]: asset.id }));
      return asset;
    } catch (error) {
      doc.report(error);
      throw error;
    }
  }, [assets, doc, patchNode, path, t.invalid]);

  function appendNode(node: CanvasNode) {
    doc.change((latest) => ({ ...latest, nodes: [...latest.nodes, node] }));
    setSelected([node.id]);
  }

  function add(kind: CanvasNodeKind, customPos?: Position) {
    const viewport = flow.getViewport();
    const last = doc.getGraph().nodes.at(-1);
    const position = customPos ?? (last
      ? { x: last.position.x + 320, y: last.position.y }
      : { x: (240 - viewport.x) / viewport.zoom, y: (160 - viewport.y) / viewport.zoom });
    appendNode(createCanvasNode(kind, position));
  }

  const applyTemplate = useCallback((template: CanvasSubTemplate) => {
    const viewport = flow.getViewport();
    const originX = (180 - viewport.x) / viewport.zoom;
    const originY = (180 - viewport.y) / viewport.zoom;
    const built = template.build(originX, originY);
    doc.change((latest) => ({ ...latest, nodes: [...latest.nodes, ...built.nodes], edges: [...latest.edges, ...built.edges] }));
    setSelected(built.nodes[0] ? [built.nodes[0].id] : []);
    setShowMinimap(true);
    requestAnimationFrame(() => { void flow.fitView({ maxZoom: 1, padding: 0.22, duration: 220 }); });
  }, [doc, flow]);

  function insertAsset(asset: CanvasAsset, position: Position) {
    doc.addAsset(asset);
    appendNode({ ...createCanvasNode("asset", position), settings: { assetId: asset.id } });
  }

  async function insertLibraryItem(item: LibraryMediaEntry, dropPoint?: Position) {
    const viewport = flow.getViewport();
    const position = dropPoint ? flow.screenToFlowPosition(dropPoint)
      : libraryPosition ?? { x: (220 - viewport.x) / viewport.zoom, y: (160 - viewport.y) / viewport.zoom };
    try {
      const asset = await linkLibraryAsset(path, item.path, item.name);
      insertAsset(asset, position);
      setActiveDrawer(null);
    } catch (error) {
      doc.report(error);
    }
  }

  async function insertFile(file: Blob, name: string, position: Position) {
    try {
      insertAsset(await uploadAsset(path, file, name), position);
    } catch (error) {
      doc.report(error);
    }
  }

  async function insertMediaOutputs(outputs: CanvasMediaOutput[], signal: AbortSignal) {
    const viewport = flow.getViewport();
    const start = { x: (190 - viewport.x) / viewport.zoom, y: (140 - viewport.y) / viewport.zoom };
    const imported: CanvasAsset[] = [];
    for (const { blob, name } of outputs) imported.push(await uploadAsset(path, blob, name, signal));
    signal.throwIfAborted();
    const nodes = imported.map((asset, index) => {
      doc.addAsset(asset);
      const position = { x: start.x + (index % 3) * 280, y: start.y + Math.floor(index / 3) * 240 };
      return { ...createCanvasNode("asset", position), settings: { assetId: asset.id } };
    });
    doc.change((latest) => ({ ...latest, nodes: [...latest.nodes, ...nodes] }));
    setSelected(nodes.map((node) => node.id));
  }

  function focusNode(node: CanvasNode) {
    setSelected([node.id]);
    void flow.setCenter(node.position.x + 120, node.position.y + 80, { zoom: 1, duration: 220 });
  }

  // 只在点击菜单的粘贴项时读取剪贴板，优先使用可导入的媒体。
  async function pasteAt(position: Position) {
    setMessage("");
    try {
      const content = await readCanvasClipboard(navigator.clipboard);
      if (content instanceof Blob) void insertFile(content, t.paste, position);
      else if (content.trim()) appendNode({ ...createCanvasNode("prompt", position), settings: { prompt: content.slice(0, 5000) } });
      else setMessage(t.emptyClipboard);
    } catch {
      setMessage(t.pasteFailed);
    }
  }

  function closeMenu() {
    menu?.canvas.focus({ preventScroll: true });
    setMenu(null);
  }

  function fitView() {
    void flow.fitView({ maxZoom: 1, padding: 0.2, duration: 220 });
  }

  const nodes = buildFlowNodes({
    nodes: graph.nodes, selected, assets, runs, path, t,
    onPatchPrompt: (id, prompt) => patchNode(id, (settings) => ({ ...settings, prompt })),
    onUploadFile: (id, file) => {
      const target = graph.nodes.find((item) => item.id === id);
      const field = target?.kind === "asset" ? "assetId" : target?.kind === "video" ? "videoId" : "imageId";
      void upload(id, file, file.name, field).catch(() => undefined);
    },
    onOpenPrevis: (id) => setPrevisId(id),
    onRemoveNode: (id) => remove([id], []),
  });

  const edges = buildFlowEdges(graph, runs, selectedEdges);

  function updateNodes(changes: NodeChange<FlowNode>[]) {
    const { selectChanges, removals, positions } = parseNodeChanges(changes);
    for (const item of selectChanges) {
      setSelected((ids) => item.selected ? [...ids.filter((id) => id !== item.id), item.id] : ids.filter((id) => id !== item.id));
    }
    if (removals.length) remove(removals, []);
    if (positions.size) doc.change((latest) => moveCanvasNodes(latest, positions));
  }

  function updateEdges(changes: EdgeChange[]) {
    const { selectChanges, removals } = parseEdgeChanges(changes);
    for (const item of selectChanges) {
      setSelectedEdges((ids) => item.selected ? [...ids.filter((id) => id !== item.id), item.id] : ids.filter((id) => id !== item.id));
    }
    if (removals.length) remove([], removals);
  }

  function connect(connection: Connection) {
    const assetId = resolveConnectionAsset(connection, graph, assets);
    if (assetId === null || !connection.sourceHandle || !connection.targetHandle) {
      setMessage(t.invalid);
      return;
    }
    setMessage("");
    const { source, target, sourceHandle, targetHandle } = connection;
    doc.change({
      ...graph,
      edges: [...graph.edges, { id: crypto.randomUUID(), source, target, sourcePort: sourceHandle, targetPort: targetHandle, ...(assetId ? { assetId } : {}) }],
    });
  }

  if (previs) {
    return (
      <Suspense fallback={<div role="status">{t.previs}</div>}>
        <PrevisEditor
          isZh={isZh}
          scene={previs.settings.scene}
          onExit={() => setPrevisId(null)}
          onChange={(scene: StageScene) => patchNode(previs.id, (settings) => ({ ...settings, scene }))}
          onExport={(file, field) => upload(previs.id, file, field === "imageId" ? "Previs frame" : "Previs clip", field)}
          frameUrl={previs.settings.imageId ? assetUrl(path, previs.settings.imageId) : undefined}
          clipUrl={previs.settings.videoId ? assetUrl(path, previs.settings.videoId) : undefined}
        />
      </Suspense>
    );
  }

  return (
    <div className={styles.editor}>
      <CanvasTopBar
        t={t}
        isZh={isZh}
        projectName={projectName}
        boardId={initial.board.canvasId}
        boardTitle={initial.board.title}
        boards={boards}
        nodes={graph.nodes}
        dirty={doc.dirty}
        onSelectBoard={onSelectBoard}
        onCreateBoard={onCreateBoard}
        onOpenInNewWindow={onOpenInNewWindow}
        onDuplicateBoard={onDuplicateBoard}
        onDeleteBoard={onDeleteBoard}
        onBackToProjects={onBackToProjects}
        onCommitRename={async (nextTitle) => {
          try {
            const updated = await renameBoard(path, nextTitle);
            onRenamed(updated.title);
          } catch (error) {
            doc.report(error);
          }
        }}
        onFocusNode={focusNode}
      />

      {(doc.error || message) && (
        <div role="alert" className={styles.errorToast}>
          <span>{doc.error || message}</span>
          {doc.conflict && (
            <button type="button" onClick={() => void doc.reload().then(() => flow.setViewport(doc.getGraph().viewport))}>
              {t.reload}
            </button>
          )}
        </div>
      )}

      <CanvasTools t={t} isZh={isZh} active={activeDrawer} path={path} nodes={graph.nodes} current={current} assets={assets} runs={runs}
        onPanel={(drawer) => { setLibraryPosition(undefined); setActiveDrawer(drawer); }}
        onFocusNode={focusNode} onAddNode={add} onTemplate={applyTemplate}
        onInsertLibraryItem={(item) => void insertLibraryItem(item)}
        onDragLibraryItem={(item) => { draggedLibraryItem.current = item; }}
        onSaveMedia={insertMediaOutputs}
        onRun={(nodeId) => void doc.run(nodeId)} onPrevis={setPrevisId}
      />

      {graph.nodes.length === 0 && (
        <CanvasTemplates isZh={isZh} t={t} onSelectTemplate={applyTemplate} />
      )}

      {current && (
        <NodeDock
          key={current.id}
          node={current}
          models={models}
          assets={assets}
          runs={runs.filter((run) => run.nodeId === current.id)}
          path={path}
          t={t}
          onUpdate={(settings) => patchNode(current.id, () => settings)}
          onRun={() => void doc.run(current.id)}
          onPick={doc.addRunOutput}
          onPrevis={() => setPrevisId(current.id)}
          onUpload={(file) => void upload(current.id, file, file.name, "assetId").catch(() => undefined)}
        />
      )}

      <CanvasBottomBar
        t={t}
        tool={tool}
        showMinimap={showMinimap}
        showGrid={showGrid}
        canUndo={doc.canUndo}
        canRedo={doc.canRedo}
        onToolChange={setTool}
        onZoomIn={() => void flow.zoomIn({ duration: 160 })}
        onZoomOut={() => void flow.zoomOut({ duration: 160 })}
        onFitView={fitView}
        onToggleMinimap={() => setShowMinimap((v) => !v)}
        onToggleGrid={() => setShowGrid((v) => !v)}
        onUndo={doc.undo}
        onRedo={doc.redo}
      />

      <CanvasFullscreenChat maximized={maximized} t={t} renderChat={renderFullscreenChat} />

      <CanvasMenu anchor={menu} t={t} onClose={closeMenu}
        onSelect={(kind) => { add(kind, menu?.position); closeMenu(); }}
        onAssets={() => { setLibraryPosition(menu?.position); setActiveDrawer("assets"); closeMenu(); }}
        onUpload={(file, position) => void insertFile(file, file.name, position)}
        onFit={() => { closeMenu(); fitView(); }}
        onPaste={() => { if (menu) void pasteAt(menu.position); closeMenu(); }}
      />

      <CanvasViewport
        nodes={nodes}
        edges={edges}
        defaultViewport={graph.viewport}
        showGrid={showGrid}
        showMinimap={showMinimap}
        label={t.canvas}
        panOnDrag={tool === "hand" ? true : [1, 2]}
        selectionOnDrag={tool === "select"}
        onNodesChange={updateNodes}
        onEdgesChange={updateEdges}
        onConnect={connect}
        isValidConnection={(connection) => resolveConnectionAsset(connection, graph, assets) !== null}
        onMoveEnd={(_, viewport) => {
          const previous = doc.getGraph().viewport;
          if (previous.x === viewport.x && previous.y === viewport.y && previous.zoom === viewport.zoom) return;
          doc.change((latest) => ({ ...latest, viewport }), false);
        }}
        onOpenMenu={(mode, point, canvas) => setMenu({ mode, point, canvas, position: flow.screenToFlowPosition(point) })}
        onDropLibraryItem={(point) => {
          const item = draggedLibraryItem.current;
          draggedLibraryItem.current = null;
          if (item) void insertLibraryItem(item, point);
        }}
        onPaneClick={() => setSelected([])}
        onNodeDoubleClick={(_, node) => { if (node.data.node.kind === "previs") setPrevisId(node.id); }}
      />
    </div>
  );
}

export function CanvasEditor(props: EditorProps) {
  return <ReactFlowProvider><Editor {...props} /></ReactFlowProvider>;
}
