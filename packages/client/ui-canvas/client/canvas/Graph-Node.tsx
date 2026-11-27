// 节点卡片：外置标题栏、选中顶部悬浮胶囊工具条、空态上传按钮、文本双击编辑与圆形端口连接手柄。
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import {
  IconBox,
  IconDownload,
  IconEdit,
  IconPhoto,
  IconSparkles,
  IconTrash,
  IconTypography,
  IconUpload,
  IconVideo,
} from "@tabler/icons-react";
import { inputPorts, outputPorts, type CanvasAsset, type CanvasNode } from "@lfaa/canvas/contract";
import { assetUrl } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import styles from "./Graph-Node.module.css";

export interface FlowNodeData extends Record<string, unknown> {
  node: CanvasNode;
  index: number;
  assets: CanvasAsset[];
  path: string;
  t: CanvasLabels;
  runStatus?: string;
  onPatchPrompt?: (id: string, prompt: string) => void;
  onUploadFile?: (id: string, file: File) => void;
  onOpenPrevis?: (id: string) => void;
  onRemoveNode?: (id: string) => void;
}

export type FlowNode = Node<FlowNodeData, "canvas">;

function KindIcon({ kind }: { kind: CanvasNode["kind"] }) {
  if (kind === "prompt") return <IconTypography size={14} stroke={1.8} />;
  if (kind === "image") return <IconPhoto size={14} stroke={1.8} />;
  if (kind === "video") return <IconVideo size={14} stroke={1.8} />;
  if (kind === "previs") return <IconBox size={14} stroke={1.8} />;
  return <IconSparkles size={14} stroke={1.8} />;
}

export function GraphNode({ id, data, selected }: NodeProps<FlowNode>) {
  const { node, index, assets, path, t, runStatus, onPatchPrompt, onUploadFile, onOpenPrevis, onRemoveNode } = data;
  const inputs = inputPorts(node);
  const outputs = outputPorts(node, assets);
  const signature = inputs.map((port) => port.id).join(":") + "/" + outputs.map((port) => port.id).join(":");
  const update = useUpdateNodeInternals();
  const [editingText, setEditingText] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { update(id); }, [id, signature, update]);

  const preview = outputs.find((port) => port.assetId && port.kind === "image") ?? outputs.find((port) => port.assetId);
  const previewSrc = preview?.assetId ? assetUrl(path, preview.assetId) : "";
  const titleText = `${t[node.kind]}${index + 1}`;
  const acceptAttr = node.kind === "video" ? "video/mp4,video/webm" : node.kind === "image" ? "image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp,video/mp4,video/webm";

  return (
    <div className={styles.nodeShell} data-selected={selected ? "true" : undefined} data-kind={node.kind}>
      {/* 选中节点时上方浮出紧凑胶囊工具条（参考图 8） */}
      {selected && (
        <div className={`${styles.nodeQuickBar} nodrag nopan`}>
          {node.kind === "prompt" && (
            <>
              <button type="button" onClick={() => setFontScale((s) => Math.max(0.8, Number((s - 0.1).toFixed(1))))}>A-</button>
              <button type="button" onClick={() => setFontScale((s) => Math.min(1.5, Number((s + 0.1).toFixed(1))))}>A+</button>
              <button type="button" onClick={() => setEditingText((v) => !v)}><IconEdit size={13} />{t.edit}</button>
            </>
          )}
          {(node.kind === "asset" || node.kind === "image" || node.kind === "video") && (
            <button type="button" onClick={() => fileRef.current?.click()}>
              <IconUpload size={13} />{t.upload}
            </button>
          )}
          {node.kind === "previs" && (
            <button type="button" onClick={() => onOpenPrevis?.(id)}>
              <IconBox size={13} />{t.previs}
            </button>
          )}
          {previewSrc && (
            <a className={styles.quickLink} download href={previewSrc}>
              <IconDownload size={13} />{t.download}
            </a>
          )}
          <button type="button" className={styles.quickDanger} aria-label={t.remove} onClick={() => onRemoveNode?.(id)}>
            <IconTrash size={13} />
          </button>
        </div>
      )}

      {/* 外置标题栏（浮在节点卡片上方外侧，参考图 6~10） */}
      <div className={styles.nodeHeading}>
        <span className={styles.nodeKindBadge}><KindIcon kind={node.kind} /></span>
        <strong className={styles.nodeTitle}>{titleText}</strong>
        {runStatus && <span className={styles.nodeStatus}>{runStatus}</span>}
      </div>

      <article className={styles.card} data-selected={selected ? "true" : undefined} data-kind={node.kind}>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={acceptAttr}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUploadFile?.(id, file);
            event.target.value = "";
          }}
        />

        {/* 媒体预览 / 文本内容 / 空态上传引导 */}
        {node.kind === "prompt" ? (
          <div
            className={`${styles.textBody} ${editingText ? "nodrag nopan nowheel" : ""}`}
            style={{ fontSize: `${0.85 * fontScale}rem` }}
            onDoubleClick={() => setEditingText(true)}
          >
            {editingText ? (
              <textarea
                autoFocus
                rows={5}
                value={node.settings.prompt ?? ""}
                placeholder={t.doubleClickEdit}
                onBlur={() => setEditingText(false)}
                onChange={(event) => onPatchPrompt?.(id, event.target.value)}
              />
            ) : (
              <p className={node.settings.prompt ? styles.textContent : styles.textPlaceholder}>
                {node.settings.prompt || t.doubleClickEdit}
              </p>
            )}
          </div>
        ) : previewSrc ? (
          <div className={styles.mediaBox}>
            {preview?.kind === "video"
              ? <video muted loop playsInline preload="metadata" src={previewSrc} />
              : <img alt={titleText} draggable={false} src={previewSrc} />}
          </div>
        ) : (
          <div className={styles.emptyMedia}>
            <span className={styles.emptyIcon}><KindIcon kind={node.kind} /></span>
            <span className={styles.emptyHint}>
              {node.kind === "video" ? t.tryUploadVideo : node.kind === "previs" ? t.previs : t.tryUploadImage}
            </span>
            {node.kind === "previs" ? (
              <button type="button" className={`${styles.uploadPill} nodrag`} onClick={() => onOpenPrevis?.(id)}>
                <IconBox size={14} />{t.previs}
              </button>
            ) : (
              <button type="button" className={`${styles.uploadPill} nodrag`} onClick={() => fileRef.current?.click()}>
                <IconUpload size={14} />{node.kind === "video" ? t.uploadVideo : t.uploadImage}
              </button>
            )}
          </div>
        )}

        {/* 端口区：保留全部有类型输入/输出端口，手柄采用精致圆形节点样式 */}
        <div className={styles.ports}>
          <div className={styles.portCol}>
            {inputs.map((port) => (
              <div key={port.id} className={styles.port} data-media={port.kind} data-side="in">
                <Handle id={port.id} type="target" position={Position.Left} className={styles.handle} />
                <span>{t[port.id as keyof CanvasLabels]}</span>
              </div>
            ))}
          </div>
          <div className={styles.portCol}>
            {outputs.map((port) => (
              <div key={port.id} className={styles.port} data-media={port.kind} data-side="out">
                <Handle
                  id={port.id}
                  type="source"
                  position={Position.Right}
                  className={styles.handle}
                  isConnectable={port.kind === "text" || Boolean(port.assetId)}
                />
                <span>{node.kind === "previs" ? (port.kind === "image" ? t.frameOutput : t.clipOutput) : t[port.id as keyof CanvasLabels]}</span>
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
