/** 功能：无限画布的项目素材面板。作用：上传、列举、插入与删除图片/视频素材；窄容器下同一份标记由工作区切换为抽屉。关联文件：CanvasWorkspace.tsx、canvas-workspace.css。 */
import { Button, Popconfirm } from "antd";
import { canvasAssetUrl, type CanvasProject } from "lfaa-client-connection/src/api.js";
import { CANVAS_ASSET_MIME_TYPES, CANVAS_LIMITS, formatCanvasBytes } from "./CanvasProjectTransfer.js";

export type CanvasProjectAsset = CanvasProject["assets"][number];

export interface CanvasAssetPanelProps {
  project: CanvasProject | null;
  open: boolean;
  disabled: boolean;
  uploading: boolean;
  deletingAssetId: string | null;
  onUpload: (file: File) => void;
  onInsert: (asset: CanvasProjectAsset) => void;
  onDelete: (asset: CanvasProjectAsset) => void;
  onClose: () => void;
}

function mimeLabel(mimeType: CanvasProjectAsset["mimeType"]): string {
  if (mimeType === "image/png") return "PNG 图片";
  if (mimeType === "image/jpeg") return "JPEG 图片";
  if (mimeType === "image/webp") return "WebP 图片";
  if (mimeType === "video/mp4") return "MP4 视频";
  return "WebM 视频";
}

export function CanvasAssetPanel({ project, open, disabled, uploading, deletingAssetId, onUpload, onInsert, onDelete, onClose }: CanvasAssetPanelProps) {
  const assets = project?.assets ?? [];
  return (
    <aside className={`lfaa-canvas-assets${open ? " is-open" : ""}`} aria-label="项目素材面板">
      <header className="lfaa-canvas-assets__header">
        <div className="lfaa-canvas-assets__heading">
          <strong>素材</strong>
          <span>{assets.length}/{CANVAS_LIMITS.assets}</span>
        </div>
        <label className={`lfaa-canvas-assets__upload${disabled ? " is-disabled" : ""}`}>
          <span>{uploading ? "正在上传…" : "上传素材"}</span>
          <input type="file" accept={CANVAS_ASSET_MIME_TYPES.join(",")} aria-label="上传图片或视频素材" disabled={disabled} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) onUpload(file); }} />
        </label>
        <Button className="lfaa-canvas-assets__close" size="small" type="text" aria-label="关闭素材面板" onClick={onClose}>关闭</Button>
      </header>
      <p className="lfaa-canvas-assets__hint">单张图片 ≤ {formatCanvasBytes(CANVAS_LIMITS.imageBytes)}，单个视频 ≤ {formatCanvasBytes(CANVAS_LIMITS.videoBytes)}；插入画布后保存项目才会写入素材引用。</p>
      {assets.length === 0
        ? <p className="lfaa-canvas-assets__empty">{project ? "还没有素材。上传后会按项目保存。" : "打开或新建画布后可以上传素材。"}</p>
        : <div className="lfaa-canvas-assets__list">
          {assets.map(asset => (
            <article key={asset.assetId} className="lfaa-canvas-asset">
              {asset.mimeType.startsWith("image/")
                ? <img className="lfaa-canvas-asset__thumb" src={canvasAssetUrl(project!.id, asset.assetId)} alt={`素材缩略图：${asset.name}`} loading="lazy" decoding="async" />
                : <video className="lfaa-canvas-asset__thumb" src={canvasAssetUrl(project!.id, asset.assetId)} preload="metadata" muted playsInline aria-label={`素材预览：${asset.name}`} />}
              <div className="lfaa-canvas-asset__meta">
                <span className="lfaa-canvas-asset__name" title={asset.name}>{asset.name}</span>
                <span className="lfaa-canvas-asset__detail">{mimeLabel(asset.mimeType)} · {formatCanvasBytes(asset.bytes)}</span>
              </div>
              <div className="lfaa-canvas-asset__actions">
                <Button size="small" disabled={disabled} onClick={() => onInsert(asset)}>插入画布</Button>
                <Popconfirm title={`删除素材「${asset.name}」？`} description="仍在画布节点中引用时，需要先移除这些节点。" okText="删除" cancelText="取消" disabled={disabled} onConfirm={() => onDelete(asset)}>
                  <Button size="small" type="text" danger loading={deletingAssetId === asset.assetId} disabled={disabled} aria-label={`删除素材：${asset.name}`}>删除</Button>
                </Popconfirm>
              </div>
            </article>
          ))}
        </div>}
    </aside>
  );
}
