/**
 * 功能：画布右侧资产库抽屉。
 * 作用：上传/列举/预览图片、视频、音频素材，插入画布节点、复制 @ 引用、删除未被构造引用的素材；
 *      素材与项目共属画布 Owner，本组件只做展示与交互。
 * 关联文件：CanvasWorkspace.tsx、CanvasProjectTransfer.ts、canvas-workspace.css。
 */
import { Button, Popconfirm } from "antd";
import { canvasAssetUrl, type CanvasAsset, type CanvasProject } from "lfaa-client-connection/src/api.js";
import { CANVAS_ASSET_MIME_TYPES, CANVAS_LIMITS, canvasAssetKind, formatCanvasBytes } from "./CanvasProjectTransfer.js";

export type CanvasProjectAsset = CanvasProject["assets"][number];

export interface CanvasAssetPanelProps {
  project: CanvasProject | null;
  open: boolean;
  disabled: boolean;
  uploading: boolean;
  deletingAssetId: string | null;
  onUpload: (file: File) => void;
  onInsert: (asset: CanvasProjectAsset) => void;
  /** 插入为资产库引用节点（只保存引用，不复制字节）。 */
  onInsertReference: (asset: CanvasProjectAsset) => void;
  onCopyReference: (asset: CanvasProjectAsset) => void;
  onDelete: (asset: CanvasProjectAsset) => void;
  onClose: () => void;
}

function mimeLabel(mimeType: CanvasAsset["mimeType"]): string {
  switch (mimeType) {
    case "image/png": return "PNG 图片";
    case "image/jpeg": return "JPEG 图片";
    case "image/webp": return "WebP 图片";
    case "video/mp4": return "MP4 视频";
    case "video/webm": return "WebM 视频";
    case "audio/mpeg": return "MP3 音频";
    case "audio/wav": return "WAV 音频";
    case "audio/ogg": return "Ogg 音频";
    default: return "素材";
  }
}

export function CanvasAssetPanel({ project, open, disabled, uploading, deletingAssetId, onUpload, onInsert, onInsertReference, onCopyReference, onDelete, onClose }: CanvasAssetPanelProps) {
  const assets = project?.assets ?? [];
  return (
    <aside className={"lfaa-cnv-drawer lfaa-cnv-assets" + (open ? " is-open" : "")} aria-label="项目资产库" aria-hidden={!open} data-testid="canvas-asset-drawer">
      <header className="lfaa-cnv-drawer__header">
        <div className="lfaa-cnv-drawer__heading">
          <strong>资产库</strong>
          <span>{assets.length}/{CANVAS_LIMITS.assets}</span>
        </div>
        <label className={"lfaa-cnv-upload" + (disabled ? " is-disabled" : "")}>
          <span>{uploading ? "正在上传…" : "上传素材"}</span>
          <input
            type="file"
            accept={CANVAS_ASSET_MIME_TYPES.join(",")}
            aria-label="上传图片、视频或音频素材"
            disabled={disabled}
            onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) onUpload(file); }}
          />
        </label>
        <Button className="lfaa-cnv-drawer__close" size="small" type="text" aria-label="关闭资产库" onClick={onClose}>关闭</Button>
      </header>
      <p className="lfaa-cnv-drawer__hint">
        图片 ≤ {formatCanvasBytes(CANVAS_LIMITS.imageBytes)}，视频 ≤ {formatCanvasBytes(CANVAS_LIMITS.videoBytes)}，
        音频 ≤ {formatCanvasBytes(CANVAS_LIMITS.audioBytes)}；插入画布后保存项目才会写入引用。
      </p>
      {assets.length === 0
        ? <p className="lfaa-cnv-drawer__empty">{project ? "还没有素材。上传后会按项目保存到当前账户。" : "打开或新建画布后可以上传素材。"}</p>
        : <div className="lfaa-cnv-assets__list">
          {assets.map(asset => {
            const kind = canvasAssetKind(asset.mimeType);
            return (
              <article key={asset.assetId} className="lfaa-cnv-asset">
                <div className="lfaa-cnv-asset__thumb-wrap">
                  {kind === "image"
                    ? <img className="lfaa-cnv-asset__thumb" src={canvasAssetUrl(project!.applicationId, project!.id, asset.assetId)} alt={"素材缩略图：" + asset.name} loading="lazy" decoding="async" />
                    : kind === "video"
                      ? <video className="lfaa-cnv-asset__thumb" src={canvasAssetUrl(project!.applicationId, project!.id, asset.assetId)} preload="metadata" muted playsInline aria-label={"素材预览：" + asset.name} />
                      : <audio className="lfaa-cnv-asset__audio" src={canvasAssetUrl(project!.applicationId, project!.id, asset.assetId)} controls preload="metadata" aria-label={"音频预览：" + asset.name} />}
                </div>
                <div className="lfaa-cnv-asset__meta">
                  <span className="lfaa-cnv-asset__name" title={asset.name}>{asset.name}</span>
                  <span className="lfaa-cnv-asset__detail">{mimeLabel(asset.mimeType)} · {formatCanvasBytes(asset.bytes)}</span>
                </div>
                <div className="lfaa-cnv-asset__actions">
                  <Button size="small" disabled={disabled} onClick={() => onInsert(asset)}>插入画布</Button>
                  <Button size="small" disabled={disabled} onClick={() => onInsertReference(asset)}>资产引用</Button>
                  <Button size="small" disabled={disabled} onClick={() => onCopyReference(asset)}>复制 @ 引用</Button>
                  <Popconfirm title={"删除素材「" + asset.name + "」？"} description="仍被画布节点引用时，需要先移除这些节点。" okText="删除" cancelText="取消" disabled={disabled} onConfirm={() => onDelete(asset)}>
                    <Button size="small" type="text" danger loading={deletingAssetId === asset.assetId} disabled={disabled} aria-label={"删除素材：" + asset.name}>删除</Button>
                  </Popconfirm>
                </div>
              </article>
            );
          })}
        </div>}
    </aside>
  );
}
