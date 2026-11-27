// 无限画布左侧主工具栏及面板装配，复用资料库、节点、模板与运行命令。
import { useRef, useState } from "react";
import { IconFolder, IconLayoutGrid, IconMovie, IconPlus, IconStack2, IconTool } from "@tabler/icons-react";
import type { CanvasAsset, CanvasNode, CanvasNodeKind, CanvasRun } from "@lfaa/canvas/contract";
import type { LibraryMediaEntry } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import { CanvasSideDrawer } from "./Canvas-Drawers";
import { CanvasMediaEditor } from "./Canvas-Media-Editor";
import { isVideoOperation, type CanvasMediaOperation, type CanvasMediaOutput } from "./canvas-media-image";
import { CanvasToolCatalog, type CanvasToolAction } from "./Canvas-Tool-Catalog";
import { CanvasToolPanels } from "./Canvas-Tool-Panels";
import type { CanvasSubTemplate } from "./template-catalog";
import styles from "./Canvas-Tools.module.css";

const entries = [
  { id: "nodes", label: "nodeList", Icon: IconStack2 },
  { id: "templates", label: "creationHub", Icon: IconLayoutGrid },
  { id: "assets", label: "assetsDrawer", Icon: IconFolder },
  { id: "add", label: "canvasMenu", Icon: IconPlus },
  { id: "features", label: "allTools", Icon: IconTool },
  { id: "editor", label: "clipEditor", Icon: IconMovie },
] as const;

export type CanvasToolPanel = typeof entries[number]["id"] | "history" | "media" | null;

interface ToolProps {
  active: CanvasToolPanel;
  path: string;
  isZh: boolean;
  t: CanvasLabels;
  nodes: readonly CanvasNode[];
  current: CanvasNode | undefined;
  assets: readonly CanvasAsset[];
  runs: CanvasRun[];
  onPanel: (panel: CanvasToolPanel) => void;
  onFocusNode: (node: CanvasNode) => void;
  onAddNode: (kind: CanvasNodeKind) => void;
  onTemplate: (template: CanvasSubTemplate) => void;
  onInsertLibraryItem: (item: LibraryMediaEntry) => void;
  onDragLibraryItem: (item: LibraryMediaEntry | null) => void;
  onRun: (nodeId: string) => void;
  onPrevis: (nodeId: string) => void;
  onSaveMedia: (outputs: CanvasMediaOutput[], signal: AbortSignal) => Promise<void>;
}

export function CanvasTools({ active, path, isZh, t, nodes, current, assets, runs, onPanel, onFocusNode,
  onAddNode, onTemplate, onInsertLibraryItem, onDragLibraryItem, onRun, onPrevis, onSaveMedia }: ToolProps) {
  const [operation, setOperation] = useState<CanvasMediaOperation>("trim");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panel = entries.find((entry) => entry.id === active);
  const mediaOperation = active === "editor" ? "trim" : operation;
  const nodeAsset = isVideoOperation(mediaOperation) ? current?.settings.videoId : current?.settings.imageId;
  const selectedAsset = current?.settings.resultId ?? current?.settings.assetId ?? nodeAsset;

  function close() {
    onPanel(null);
    trigger.current?.focus({ preventScroll: true });
  }

  function useTool(action: CanvasToolAction) {
    switch (action) {
      case "history": onPanel("history"); break;
      case "previs": {
        const target = current?.kind === "previs" ? current : nodes.find((node) => node.kind === "previs");
        close();
        if (target) onPrevis(target.id);
        else onAddNode("previs");
        break;
      }
      case "run": {
        const canRun = (node: CanvasNode) => node.kind === "image" || node.kind === "video";
        const target = current && canRun(current) ? current : nodes.find(canRun);
        if (target) { close(); onRun(target.id); }
        break;
      }
      default: setOperation(action); onPanel("media");
    }
  }

  return (
    <>
      <nav className={styles.rail} aria-label={t.canvasTools}>
        {entries.map(({ id, label, Icon }) => {
          const expanded = active === id || ((active === "media" || active === "history") && id === "features");
          return (
            <button key={id} type="button" className={styles.railButton} aria-expanded={expanded} title={t[label]} onClick={(event) => {
              trigger.current = event.currentTarget;
              onPanel(expanded ? null : id);
            }}>
              <span className={styles.railIcon}><Icon size={19} stroke={1.7} aria-hidden="true" /></span>
              <span className={styles.railText}>{t[label]}</span>
            </button>
          );
        })}
      </nav>

      {(active === "nodes" || active === "templates" || active === "add") && panel && (
        <CanvasToolPanels key={active} panel={active} title={t[panel.label]} t={t} isZh={isZh} nodes={nodes} nodeId={current?.id}
          onClose={close} onFocusNode={onFocusNode} onCreateNode={(kind) => { onAddNode(kind); close(); }}
          onTemplate={(template) => { onTemplate(template); close(); }} />
      )}

      {(active === "assets" || active === "history") && (
        <CanvasSideDrawer drawer={active} path={path} runs={runs} t={t} onClose={close} onInsertLibraryItem={onInsertLibraryItem} onDragLibraryItem={onDragLibraryItem} />
      )}

      {active === "features" && <CanvasToolCatalog t={t} onClose={close} onSelect={useTool} />}

      {(active === "media" || active === "editor") && (
        <CanvasMediaEditor key={active === "editor" ? active : operation} operation={mediaOperation}
          path={path} assets={assets} preferredId={selectedAsset} fromCatalog={active === "media"} t={t} onClose={close}
          onLibrary={() => onPanel("assets")} onBack={() => onPanel("features")}
          onSave={async (outputs, signal) => { await onSaveMedia(outputs, signal); close(); }} />
      )}
    </>
  );
}
