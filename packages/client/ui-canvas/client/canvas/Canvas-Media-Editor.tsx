// 画布媒体编辑器：选择画布素材、预览范围和输出结果，跨来源切换时终止当前处理。
import { useEffect, useRef, useState } from "react";
import { IconArrowBackUp } from "@tabler/icons-react";
import type { CanvasAsset } from "@lfaa/canvas/contract";
import { assetUrl } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import { CanvasContactSheet } from "./Canvas-Contact-Sheet";
import { CanvasMediaControls } from "./Canvas-Media-Controls";
import { defaultMediaParameters, downloadCanvasAudio, exportCanvasMedia } from "./canvas-media-actions";
import { isVideoOperation, type CanvasMediaOperation, type CanvasMediaOutput } from "./canvas-media-image";
import { canTrimVideo, exportVideoClip } from "./canvas-media-video";
import { CanvasToolsDialog } from "./Canvas-Tools-Dialog";
import styles from "./Canvas-Media-Editor.module.css";

type SaveOutputs = (outputs: CanvasMediaOutput[], signal: AbortSignal) => Promise<void>;

export function CanvasMediaEditor({ operation, path, assets, preferredId, fromCatalog, t, onClose, onLibrary, onBack, onSave }: {
  operation: CanvasMediaOperation;
  path: string;
  assets: readonly CanvasAsset[];
  preferredId: string | undefined;
  fromCatalog: boolean;
  t: CanvasLabels;
  onClose: () => void;
  onLibrary: () => void;
  onBack: () => void;
  onSave: SaveOutputs;
}) {
  const choices = assets.filter((asset) => asset.kind === (isVideoOperation(operation) ? "video" : "image"));
  const [id, setId] = useState(preferredId);
  const selected = choices.find((asset) => asset.id === id) ?? choices[0];

  return (
    <CanvasToolsDialog title={fromCatalog ? t[operation] : t.clipEditor} closeLabel={t.close} onClose={onClose}>
      <div className={styles.layout}>
        {fromCatalog && <button type="button" className={styles.button} onClick={onBack}><IconArrowBackUp size={16} />{t.allTools}</button>}

        {selected && operation !== "contactSheet" && (
          <label className={styles.source}>{t.sourceAsset}
            <select value={selected.id} onChange={(event) => setId(event.target.value)}>
              {choices.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
        )}

        {operation === "contactSheet" && choices.length >= 2 && <CanvasContactSheet assets={choices} path={path} preferredId={preferredId} t={t} onSave={onSave} />}
        {operation !== "contactSheet" && selected && <MediaOperation key={selected.id} operation={operation} src={assetUrl(path, selected.id)} name={selected.name} t={t} onSave={onSave} />}
        {(!selected || (operation === "contactSheet" && choices.length < 2)) && (
          <button type="button" className={styles.button} onClick={onLibrary}>{operation === "contactSheet" ? t.contactSheetHelp : t.chooseMedia}</button>
        )}
      </div>
    </CanvasToolsDialog>
  );
}

/** 单素材状态在切换来源时重建，离开面板时释放进行中的录制和上传。 */
function MediaOperation({ operation, src, name, t, onSave }: {
  operation: CanvasMediaOperation; src: string; name: string; t: CanvasLabels; onSave: SaveOutputs;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [ready, setReady] = useState(false);
  const [params, setParams] = useState(defaultMediaParameters);
  const [duration, setDuration] = useState(0);
  const [supportsRecording, setSupportsRecording] = useState(false);
  const [supportsAudio, setSupportsAudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isVideo = isVideoOperation(operation);
  const needsRange = isVideo && operation !== "snapshot";
  const needsRecording = needsRange && operation !== "frameStrip";
  const validRange = params.start >= 0 && params.end > params.start && params.end <= duration;
  const canExport = ready && !busy && (!needsRange || validRange) && (!needsRecording || supportsRecording)
    && (operation !== "annotate" || (params.annotation.text.trim().length > 0 && params.annotation.x >= 0 && params.annotation.x <= 95 && params.annotation.y >= 0 && params.annotation.y <= 95));

  useEffect(() => () => pending.current?.abort(), []);

  async function save(action: CanvasMediaOperation | "audio" = operation) {
    const source = isVideo ? videoRef.current : imageRef.current;
    if (!source || !ready || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setError("");
    setBusy(true);
    const stem = name.replace(/\.[^.]+$/u, "");

    try {
      if (action === "audio" && source instanceof HTMLVideoElement) {
        const audio = await exportVideoClip(source, params.start, params.end, controller.signal, { tracks: "audio" });
        controller.signal.throwIfAborted();
        downloadCanvasAudio(audio, stem + "-" + t.audioTrack);
      } else if (action !== "audio") {
        const blobs = await exportCanvasMedia(action, source, params, controller.signal, t.invalidCrop);
        controller.signal.throwIfAborted();
        await onSave(blobs.map((blob, index) => {
          const extension = blob.type === "video/mp4" ? "mp4" : blob.type === "video/webm" ? "webm" : "png";
          const suffix = blobs.length > 1 ? "-" + (index + 1) : "";
          return { blob, name: stem + "-" + t[action] + suffix + "." + extension };
        }), controller.signal);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.preview}>
        <div className={styles.imageFrame}>
          {isVideo ? (
            <video ref={videoRef} controls={!busy} preload="auto" playsInline src={src} onLoadedData={(event) => {
              const video = event.currentTarget;
              const seconds = Number.isFinite(video.duration) ? video.duration : 0;
              setDuration(seconds);
              setParams((value) => ({ ...value, end: seconds }));
              setSupportsRecording(canTrimVideo(video, operation === "splitTracks" ? "video" : "both"));
              setSupportsAudio(canTrimVideo(video, "audio"));
              setReady(true);
            }} onError={() => setError(t.mediaLoadFailed)} />
          ) : <img ref={imageRef} src={src} alt={name} style={{ transform: "rotate(" + params.rotation + "deg)" }} onLoad={() => setReady(true)} onError={() => setError(t.mediaLoadFailed)} />}
          {(operation === "crop" || operation === "videoCrop") && <span className={styles.cropRegion} aria-hidden="true" style={{ left: params.crop.x + "%", top: params.crop.y + "%", width: params.crop.width + "%", height: params.crop.height + "%" }} />}
          {operation === "annotate" && params.annotation.text && <span className={styles.annotation} aria-hidden="true" style={{ left: params.annotation.x + "%", top: params.annotation.y + "%" }}>{params.annotation.text}</span>}
        </div>
      </div>

      <CanvasMediaControls operation={operation} params={params} duration={duration} busy={busy} t={t} onChange={(update) => setParams((value) => ({ ...value, ...update }))} />

      {ready && needsRecording && !supportsRecording && <p className={styles.status}>{t.clipUnsupported}</p>}
      {error && <p className={styles.status} role="alert">{error}</p>}
      <div className={styles.actions}>
        {operation === "trim" && <button type="button" className={styles.button} disabled={!ready || busy} onClick={() => void save("snapshot")}>{t.snapshot}</button>}
        {operation === "splitTracks" && <button type="button" className={styles.button} disabled={!ready || busy || !validRange || !supportsAudio} onClick={() => void save("audio")}>{t.downloadAudio}</button>}
        <button type="button" className={styles.primary} disabled={!canExport} onClick={() => void save()}>{busy ? t.exporting : operation === "splitTracks" ? t.saveSilentVideo : t.exportToBoard}</button>
      </div>
    </>
  );
}
