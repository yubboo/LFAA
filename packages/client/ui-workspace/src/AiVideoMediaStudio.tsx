import { Alert, Button, Input, InputNumber, Progress, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { aiVideoAssetUrl, deleteAiVideoMediaAsset, loadAiVideoMediaAssets, saveAiVideoExport, uploadAiVideoMediaAsset, type AiVideoCanvas, type AiVideoMediaAsset, type AiVideoTimelineClip } from "lfaa-client-connection/src/api.js";
import { renderAiVideoTimeline } from "./timeline-export.js";

const ACCEPTED_MEDIA = "image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg";
const PAGE_SIZE = 50;

function formatTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024 * 1_024) return `${Math.max(1, Math.ceil(bytes / 1_024))} KiB`;
  return `${(bytes / 1_024 / 1_024).toFixed(1)} MiB`;
}

function isAudio(asset: AiVideoMediaAsset): boolean { return asset.mimeType.startsWith("audio/"); }

export function AiVideoMediaStudio(props: {
  canvas: AiVideoCanvas;
  clips: AiVideoTimelineClip[];
  dirty: boolean;
  saving: boolean;
  maxAssetBytes: number;
  maxImageBytes: number;
  onTimelineChange: (clips: AiVideoTimelineClip[]) => void;
  onCanvasUpdated: (canvas: AiVideoCanvas) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { canvas, clips, dirty, saving, maxAssetBytes, maxImageBytes, onTimelineChange, onCanvasUpdated, onBusyChange } = props;
  const [assets, setAssets] = useState<AiVideoMediaAsset[]>(canvas.mediaAssets ?? []);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [page, setPage] = useState(0);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [lastExport, setLastExport] = useState<AiVideoMediaAsset | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const downloadUrl = useMemo(() => new Map(assets.map(asset => [asset.assetId, aiVideoAssetUrl(canvas.id, asset.assetId)])), [assets, canvas.id]);
  const duration = useMemo(() => Math.min(300, Math.max(0, ...clips.map(clip => clip.startSeconds + clip.durationSeconds))), [clips]);
  const activeVideo = clips.find(clip => clip.track === "video" && playhead >= clip.startSeconds && playhead < clip.startSeconds + clip.durationSeconds && clip.assetId);
  const activeAudio = clips.find(clip => clip.track === "audio" && playhead >= clip.startSeconds && playhead < clip.startSeconds + clip.durationSeconds && clip.assetId);
  const activeSubtitle = clips.find(clip => clip.track === "subtitle" && playhead >= clip.startSeconds && playhead < clip.startSeconds + clip.durationSeconds);
  const activeVideoAsset = assets.find(asset => asset.assetId === activeVideo?.assetId);
  const activeAudioAsset = assets.find(asset => asset.assetId === activeAudio?.assetId);
  const pageCount = Math.max(1, Math.ceil(assets.length / PAGE_SIZE));
  const visibleAssets = assets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setLastExport(null);
  }, [canvas.id]);

  useEffect(() => {
    let mounted = true;
    void loadAiVideoMediaAssets(canvas.id).then(result => { if (mounted) setAssets(result.assets); }).catch(loadError => { if (mounted) setError(loadError instanceof Error ? loadError.message : "媒体库读取失败。"); });
    return () => { mounted = false; };
  }, [canvas.id, canvas.updatedAt]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let lastUpdate = 0;
    const startedAt = performance.now() - playhead * 1_000;
    const tick = (now: number) => {
      const next = (now - startedAt) / 1_000;
      if (next >= duration) { setPlayhead(duration); setPlaying(false); return; }
      if (now - lastUpdate >= 120) { lastUpdate = now; setPlayhead(next); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideo) return;
    if (!playing) {
      const target = activeVideo.inPointSeconds + playhead - activeVideo.startSeconds;
      if (Number.isFinite(target) && !video.seeking) video.currentTime = Math.min(target, Math.max(0, (video.duration || target) - 0.05));
      video.pause();
    }
  }, [activeVideo?.id, activeVideo?.startSeconds, activeVideo?.inPointSeconds, playhead, playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeAudio || playing) return;
    const target = activeAudio.inPointSeconds + playhead - activeAudio.startSeconds;
    if (Number.isFinite(target) && audio.readyState >= HTMLMediaElement.HAVE_METADATA && !audio.seeking) {
      audio.currentTime = Math.min(target, Math.max(0, (audio.duration || target) - 0.05));
    }
    audio.pause();
  }, [activeAudio?.id, activeAudio?.startSeconds, activeAudio?.inPointSeconds, playhead, playing]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (playing) {
      if (video) void video.play().catch(() => setPlaying(false));
      if (audio) void audio.play().catch(() => setPlaying(false));
    } else {
      video?.pause();
      audio?.pause();
    }
  }, [playing, activeVideo?.id, activeAudio?.id]);

  const setOperation = (value: boolean) => { setBusy(value); onBusyChange(value); };

  const importFile = async (files: FileList | null) => {
    if (!files?.length) return;
    if (dirty) { setError("请先保存当前项目，再导入素材。"); return; }
    setOperation(true); setError(""); setNotice("");
    let current = canvas;
    try {
      for (const file of Array.from(files)) {
        if (!ACCEPTED_MEDIA.split(",").includes(file.type)) throw new Error(`不支持 ${file.name} 的媒体格式。`);
        if (file.size > maxAssetBytes) throw new Error(`${file.name} 超过 ${formatBytes(maxAssetBytes)} 的单文件上限。`);
        if (file.type.startsWith("image/") && file.size > maxImageBytes) throw new Error(`${file.name} 超过 ${formatBytes(maxImageBytes)} 的图片上限。`);
        const result = await uploadAiVideoMediaAsset(current.id, current.updatedAt, file);
        current = result.canvas;
      }
      onCanvasUpdated(current);
      setNotice("素材已保存到本机项目文件夹。");
    } catch (importError) {
      if (current.updatedAt !== canvas.updatedAt) onCanvasUpdated(current);
      setError(importError instanceof Error ? importError.message : "导入媒体失败。");
    }
    finally { setOperation(false); }
  };

  const removeAsset = async (asset: AiVideoMediaAsset) => {
    if (dirty) { setError("请先保存当前时间线，再管理素材。"); return; }
    setOperation(true); setError(""); setNotice("");
    try {
      const result = await deleteAiVideoMediaAsset(canvas.id, asset.assetId, canvas.updatedAt);
      onCanvasUpdated(result.canvas);
      setNotice("素材已从项目移除。");
    } catch (removeError) { setError(removeError instanceof Error ? removeError.message : "删除媒体素材失败。"); }
    finally { setOperation(false); }
  };

  const addAssetClip = (asset: AiVideoMediaAsset) => {
    if (!asset.available) { setError("该素材文件缺失，不能加入时间线。"); return; }
    const track = isAudio(asset) ? "audio" : "video";
    const startSeconds = Math.max(0, ...clips.filter(clip => clip.track === track).map(clip => clip.startSeconds + clip.durationSeconds));
    if (startSeconds + 5 > 300) { setError("时间线最长 300 秒。"); return; }
    onTimelineChange([...clips, { id: crypto.randomUUID(), track, assetId: asset.assetId, startSeconds, inPointSeconds: 0, durationSeconds: 5 }]);
    setError(""); setNotice("片段已加入时间线；保存项目后会保留编辑结果。");
  };

  const updateClip = (id: string, change: Partial<AiVideoTimelineClip>) => onTimelineChange(clips.map(clip => clip.id === id ? { ...clip, ...change } : clip));
  const addSubtitle = () => {
    if (!subtitleDraft.trim()) return;
    const startSeconds = Math.max(0, ...clips.filter(clip => clip.track === "subtitle").map(clip => clip.startSeconds + clip.durationSeconds));
    if (startSeconds + 3 > 300) { setError("字幕超出 300 秒时间线范围。"); return; }
    onTimelineChange([...clips, { id: crypto.randomUUID(), track: "subtitle", text: subtitleDraft.trim(), startSeconds, inPointSeconds: 0, durationSeconds: 3 }]);
    setSubtitleDraft(""); setError("");
  };

  const exportProject = async () => {
    if (dirty) { setError("请先保存项目和时间线，再导出成片。"); return; }
    setOperation(true); setError(""); setNotice(""); setExportProgress(0);
    try {
      const blob = await renderAiVideoTimeline(canvas, clips, assets, setExportProgress);
      if (blob.size > maxAssetBytes) throw new Error("导出文件超过项目单文件上限；没有写入项目。");
      const result = await saveAiVideoExport(canvas.id, canvas.updatedAt, blob);
      onCanvasUpdated(result.canvas);
      setLastExport(result.asset);
      setNotice(`成片已保存到本机项目媒体库（${result.asset.mimeType.endsWith("mp4") ? "MP4" : "WebM"}，${formatBytes(result.asset.bytes)}）。`);
    } catch (exportError) { setError(exportError instanceof Error ? exportError.message : "导出成片失败。"); }
    finally { setOperation(false); setExportProgress(null); }
  };

  return <div className="aivideo-media-studio" role="tabpanel" aria-label="媒体库与时间线">
    {error ? <Alert type="error" showIcon message={error} /> : null}
    {notice ? <Typography.Text className="aivideo-media-studio__notice" type="secondary" role="status">{notice}</Typography.Text> : null}
    <section className="aivideo-media-library" aria-labelledby="aivideo-media-heading">
      <header><div><Typography.Title id="aivideo-media-heading" level={4}>项目媒体库</Typography.Title><Typography.Text type="secondary">图片、视频和声音保存在此项目的本机素材目录中。</Typography.Text></div>
        <label className="aivideo-reference-file"><span>{busy ? "正在处理…" : "导入媒体"}<input type="file" accept={ACCEPTED_MEDIA} multiple disabled={busy || saving || dirty} onChange={event => { const files = event.currentTarget.files; event.currentTarget.value = ""; void importFile(files); }} /></span></label>
      </header>
      {dirty ? <Typography.Text type="warning">保存当前项目后可导入、删除素材或导出。</Typography.Text> : null}
      <div className="aivideo-media-library__list" aria-live="polite">
        {visibleAssets.map(asset => <article key={asset.assetId} className="aivideo-media-card">
          <div className="aivideo-media-card__kind" aria-hidden="true">{asset.mimeType.startsWith("image/") ? "图" : asset.mimeType.startsWith("video/") ? "影" : "音"}</div>
          <div className="aivideo-media-card__details"><strong title={asset.name}>{asset.name}</strong><span>{asset.mimeType} · {formatBytes(asset.bytes)}{asset.available === false ? " · 文件缺失" : ""}</span></div>
          {asset.available ? <a className="aivideo-media-card__open" href={downloadUrl.get(asset.assetId)} target="_blank" rel="noreferrer">预览</a> : null}
          <Button size="small" disabled={busy || saving} onClick={() => addAssetClip(asset)}>加入时间线</Button>
          <Button size="small" danger disabled={busy || saving || dirty} onClick={() => void removeAsset(asset)}>删除</Button>
        </article>)}
        {!assets.length ? <Typography.Text type="secondary">还没有媒体。生成的镜头图片/视频也会显示在这里。</Typography.Text> : null}
      </div>
      {pageCount > 1 ? <div className="aivideo-media-library__pagination"><Button size="small" disabled={page <= 0} onClick={() => setPage(value => value - 1)}>上一页</Button><Typography.Text type="secondary">{page + 1}/{pageCount}</Typography.Text><Button size="small" disabled={page + 1 >= pageCount} onClick={() => setPage(value => value + 1)}>下一页</Button></div> : null}
    </section>

    <section className="aivideo-timeline" aria-labelledby="aivideo-timeline-heading">
      <header><div><Typography.Title id="aivideo-timeline-heading" level={4}>时间线</Typography.Title><Typography.Text type="secondary">可编辑各轨道片段的起点、素材入点和长度。单次成片最长 5 分钟。</Typography.Text></div>
        <Button type="primary" disabled={busy || saving || dirty || !clips.some(clip => clip.track === "video")} loading={busy && exportProgress !== null} onClick={() => void exportProject()}>{exportProgress === null ? "导出成片" : `渲染中 ${exportProgress}%`}</Button>
      </header>
      {exportProgress !== null ? <Progress percent={exportProgress} status="active" /> : null}
      {lastExport ? <a className="aivideo-export-download" href={downloadUrl.get(lastExport.assetId)} download={lastExport.name}>下载本机成片 · {lastExport.name}</a> : null}
      <div className="aivideo-timeline__preview">
        <div className="aivideo-timeline__screen">
          {activeVideoAsset?.mimeType.startsWith("image/") ? <img src={downloadUrl.get(activeVideoAsset.assetId)} alt="时间线当前画面" /> : activeVideoAsset?.mimeType.startsWith("video/") ? <video key={activeVideo?.id} ref={videoRef} src={downloadUrl.get(activeVideoAsset.assetId)} muted playsInline preload="metadata" onLoadedMetadata={event => { const clip = activeVideo; if (clip) event.currentTarget.currentTime = clip.inPointSeconds + Math.max(0, playhead - clip.startSeconds); if (playing) void event.currentTarget.play().catch(() => setPlaying(false)); }} /> : <span>拖动播放头预览时间线画面</span>}
          {activeSubtitle?.text ? <strong>{activeSubtitle.text}</strong> : null}
        </div>
        <div className="aivideo-timeline__player"><Button size="small" disabled={!duration || busy} onClick={() => setPlaying(value => !value)}>{playing ? "暂停" : "播放预览"}</Button><span>{formatTime(playhead)} / {formatTime(duration)}</span><input aria-label="时间线播放头" type="range" min={0} max={Math.max(0.1, duration)} step={0.1} value={Math.min(playhead, duration)} disabled={!duration || playing} onChange={event => setPlayhead(Number(event.target.value))} /></div>
        {activeAudioAsset ? <audio key={activeAudio?.id} ref={audioRef} src={downloadUrl.get(activeAudioAsset.assetId)} preload="metadata" onLoadedMetadata={event => { const clip = activeAudio; if (clip) event.currentTarget.currentTime = clip.inPointSeconds + Math.max(0, playhead - clip.startSeconds); if (playing) void event.currentTarget.play().catch(() => setPlaying(false)); }} /> : null}
      </div>

      <div className="aivideo-timeline__tracks">
        {(["video", "audio", "subtitle"] as const).map(track => <section key={track} className="aivideo-timeline-track" aria-label={`${track}轨道`}>
          <h5>{track === "video" ? "视频" : track === "audio" ? "音频" : "字幕"}</h5>
          {clips.filter(clip => clip.track === track).sort((a, b) => a.startSeconds - b.startSeconds).map(clip => {
            const asset = clip.assetId ? assets.find(item => item.assetId === clip.assetId) : undefined;
            return <article key={clip.id} className="aivideo-timeline-clip">
              <strong>{asset?.name ?? clip.text ?? "素材"}</strong>
              <label>起点<InputNumber aria-label="片段起点秒数" min={0} max={300} step={0.5} value={clip.startSeconds} disabled={busy || saving} onChange={value => typeof value === "number" && updateClip(clip.id, { startSeconds: value })} /></label>
              {track !== "subtitle" ? <label>素材入点<InputNumber aria-label="素材入点秒数" min={0} max={300} step={0.5} value={clip.inPointSeconds} disabled={busy || saving} onChange={value => typeof value === "number" && updateClip(clip.id, { inPointSeconds: value })} /></label> : null}
              <label>时长<InputNumber aria-label="片段时长秒数" min={0.1} max={300} step={0.5} value={clip.durationSeconds} disabled={busy || saving} onChange={value => typeof value === "number" && updateClip(clip.id, { durationSeconds: value })} /></label>
              {track === "subtitle" ? <Input aria-label="字幕文字" maxLength={1_000} value={clip.text} disabled={busy || saving} onChange={event => updateClip(clip.id, { text: event.target.value })} /> : null}
              <Button size="small" danger disabled={busy || saving} onClick={() => onTimelineChange(clips.filter(item => item.id !== clip.id))}>移除</Button>
            </article>;
          })}
          {!clips.some(clip => clip.track === track) ? <Typography.Text type="secondary">此轨道暂无片段。</Typography.Text> : null}
        </section>)}
      </div>
      <div className="aivideo-timeline__subtitle-add"><Input aria-label="新增字幕" maxLength={1_000} value={subtitleDraft} disabled={busy || saving} onChange={event => setSubtitleDraft(event.target.value)} placeholder="输入一句字幕" /><Button disabled={!subtitleDraft.trim() || busy || saving} onClick={addSubtitle}>添加字幕</Button></div>
      <Typography.Text type="secondary">时间线更改会与剧本和分镜一起保存。浏览器编码器真实支持 MP4 时导出 MP4，否则按支持情况导出 WebM；成片写回项目媒体库。</Typography.Text>
    </section>
  </div>;
}
