// 白模预演编辑器：内置简模、人物走位、相机关键帧与可重复使用的媒体输出。
import { useEffect, useRef, useState } from "react";
import type { CanvasAsset, StageObject, StageScene, Vector } from "@lfaa/canvas/contract";
import { StageViewport } from "./Stage-Viewport";
import { cameraAt, defaultStage, newStageObject, objectPosition, setKey, type CameraKey } from "./stage-scene";
import { renderClip, renderFrame } from "./stage-export";
import styles from "./Previs.module.css";

interface Props {
  isZh: boolean;
  scene?: StageScene | undefined;
  frameUrl?: string | undefined;
  clipUrl?: string | undefined;
  onChange: (scene: StageScene) => void;
  onExport: (file: Blob, field: "imageId" | "videoId") => Promise<CanvasAsset>;
  onExit: () => void;
}

const words = {
  zh: { back: "返回画布", title: "白模预演", actor: "人物", box: "方块", sphere: "球体", add: "添加简模", stage: "场景", move: "移动", rotate: "旋转", view: "相机预览", edit: "自由视角", play: "播放", pause: "暂停", start: "时间轴", duration: "时长", aspect: "画幅", camera: "相机关键帧", position: "走位关键帧", remove: "移除对象", removeKey: "删除当前关键帧", frame: "输出静帧", clip: "输出短片", capturing: "正在输出…", download: "下载", webm: "当前浏览器输出 WebM，可预览。运动参考需要 MP4。", empty: "添加人物或道具" },
  en: { back: "Back to canvas", title: "3D previs", actor: "Actor", box: "Box", sphere: "Sphere", add: "Add object", stage: "Scene", move: "Move", rotate: "Rotate", view: "Camera preview", edit: "Free view", play: "Play", pause: "Pause", start: "Timeline", duration: "Duration", aspect: "Aspect ratio", camera: "Camera keyframe", position: "Blocking keyframe", remove: "Remove object", removeKey: "Delete current keyframe", frame: "Export frame", clip: "Export clip", capturing: "Exporting…", download: "Download", webm: "This browser recorded WebM for preview. Motion reference requires MP4.", empty: "Add an actor or object" },
};

export default function PrevisEditor({ isZh, scene, frameUrl, clipUrl, onChange, onExport, onExit }: Props) {
  const t = words[isZh ? "zh" : "en"];
  const [fallback] = useState(defaultStage);
  const stage = scene ?? fallback;
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [cameraPreview, setCameraPreview] = useState(false);
  const [rotation, setRotation] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const orbitView = useRef<CameraKey | null>(null);
  const capture = useRef<AbortController | null>(null);
  const actor = stage.objects.find((object) => object.id === selected);
  const timeKey = Math.round(time * 10) / 10;

  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const from = time >= stage.duration ? 0 : time;
    let frame = 0;
    const next = (now: number) => {
      const current = Math.min(stage.duration, from + (now - start) / 1000);
      setTime(current);
      if (current < stage.duration) frame = requestAnimationFrame(next);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(next);
    return () => cancelAnimationFrame(frame);
  // 仅在按下播放或修改总时长时重建动画时钟。
  }, [playing, stage.duration]);

  useEffect(() => () => capture.current?.abort(), []);

  function add(kind: StageObject["kind"]) {
    const object = newStageObject(kind, stage.objects.length);
    setSelected(object.id);
    onChange({ ...stage, objects: [...stage.objects, object] });
  }

  function transform(id: string, position: Vector, facing: number) {
    onChange({ ...stage, objects: stage.objects.map((object) => {
      if (object.id !== id) return object;
      if (!timeKey) return {
        ...object, position, rotation: facing,
        keys: object.keys.some((item) => item.time === 0) ? setKey(object.keys, { time: 0, position }) : object.keys,
      };
      return { ...object, rotation: facing, keys: setKey(object.keys, { time: timeKey, position }) };
    }) });
  }

  const handleError = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));

  async function output(field: "imageId" | "videoId") {
    const controller = new AbortController();
    capture.current = controller;
    setExporting(true);
    setError("");
    setPlaying(false);
    try {
      const blob = field === "imageId" ? await renderFrame(stage, time) : await renderClip(stage, controller.signal);
      if (controller.signal.aborted) return;
      const asset = await onExport(blob, field);
      if (asset.mime === "video/webm") setError(t.webm);
    } catch (cause) {
      if (!controller.signal.aborted) handleError(cause);
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  }

  return (
    <section className={styles.previs} aria-label={t.title}>
      <div className={styles.bar}>
        <button onClick={onExit} disabled={exporting}>{t.back}</button>
        <strong>{t.title}</strong>
        <button disabled={exporting} onClick={() => void output("imageId")}>{t.frame}</button>
        <button disabled={exporting} onClick={() => void output("videoId")}>{t.clip}</button>
        {exporting && <span role="status">{t.capturing}</span>}
      </div>
      {error && <div role="alert" className={styles.error}>{error}</div>}
      <div className={styles.workspace}>
        <div className={styles.viewer}>
          <div className={styles.frame}>
            <StageViewport stage={stage} time={time} cameraPreview={cameraPreview} rotation={rotation} selected={selected}
              orbitView={orbitView} onSelect={setSelected} onTransform={transform} onError={handleError} />
          </div>
          <div className={styles.bar}>
            <button aria-pressed={cameraPreview} onClick={() => { setPlaying(false); setCameraPreview(!cameraPreview); }}>{cameraPreview ? t.edit : t.view}</button>
            <button aria-pressed={!rotation} onClick={() => setRotation(false)}>{t.move}</button>
            <button aria-pressed={rotation} onClick={() => setRotation(true)}>{t.rotate}</button>
            <select aria-label={t.aspect} value={stage.ratio} onChange={(event) => onChange({ ...stage, ratio: event.target.value === "9:16" ? "9:16" : "16:9" })}>
              <option>16:9</option><option>9:16</option>
            </select>
          </div>
        </div>
        <aside className={styles.scene} aria-label={t.stage}>
          <div className={styles.bar}>
            {(["actor", "box", "sphere"] as const).map((kind) => <button key={kind} disabled={stage.objects.length >= 24}
              onClick={() => add(kind)}>{t.add} · {t[kind]}</button>)}
          </div>
          {stage.objects.length ? <select aria-label={t.stage} value={selected ?? ""} onChange={(event) => setSelected(event.target.value || null)}>
            <option value="">{t.stage}</option>
            {stage.objects.map((object, index) => <option key={object.id} value={object.id}>{t[object.kind]} {index + 1}</option>)}
          </select> : <span>{t.empty}</span>}
          {actor && <>
            <div className={styles.coords}>
              {(["X", "Y", "Z"] as const).map((axis, index) => <label key={axis}>{axis}<input type="number" step={0.1} min={-100} max={100}
                value={Number((objectPosition(actor, time)[index] ?? 0).toFixed(2))} onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  if (!Number.isFinite(value) || Math.abs(value) > 100) return;
                  const position = objectPosition(actor, time);
                  position[index as 0 | 1 | 2] = value;
                  transform(actor.id, position, actor.rotation);
                }} /></label>)}
            </div>
            <button onClick={() => transform(actor.id, objectPosition(actor, time), actor.rotation)}>{t.position}</button>
            <button onClick={() => { onChange({ ...stage, objects: stage.objects.filter((object) => object.id !== actor.id) }); setSelected(null); }}>{t.remove}</button>
          </>}
          {frameUrl && <a href={frameUrl} download>{t.download} · PNG</a>}
          {clipUrl && <><video controls preload="metadata" src={clipUrl} /><a href={clipUrl} download>{t.download} · {t.clip}</a></>}
        </aside>
      </div>
      <div className={styles.timeline}>
        <button onClick={() => { setPlaying(!playing); setCameraPreview(true); }}>{playing ? t.pause : t.play}</button>
        <input type="range" aria-label={t.start} min={0} max={stage.duration} step={0.1} value={timeKey}
          onChange={(event) => { setPlaying(false); setTime(event.target.valueAsNumber); }} />
        <output>{timeKey.toFixed(1)} s</output>
        <label>{t.duration} <input type="number" min={1} max={15} value={stage.duration} onChange={(event) => {
          const value = event.target.valueAsNumber;
          if (!Number.isInteger(value) || value < 1 || value > 15) return;
          setTime((current) => Math.min(current, value));
          onChange({ ...stage, duration: value });
        }} /></label>
        <button disabled={cameraPreview} onClick={() => {
          const view = orbitView.current ?? cameraAt(stage, time);
          onChange({ ...stage, camera: setKey(stage.camera, { ...view, time: timeKey }) });
        }}>{t.camera}</button>
        {stage.camera.length > 1 && stage.camera.some((key) => key.time === timeKey) && <button onClick={() => {
          onChange({ ...stage, camera: stage.camera.filter((key) => key.time !== timeKey) });
        }}>{t.removeKey}</button>}
        <div className={styles.keyframes}>
          {stage.camera.map((key) => <button key={key.time} aria-label={t.camera + " " + key.time + " s"}
            aria-pressed={timeKey === key.time} onClick={() => { setPlaying(false); setTime(key.time); setCameraPreview(true); }}>{key.time}s</button>)}
          {actor?.keys.map((key) => <button key={"actor" + key.time} aria-label={t.position + " " + key.time + " s"}
            aria-pressed={timeKey === key.time} onClick={() => { setPlaying(false); setTime(key.time); }}>{key.time}s</button>)}
        </div>
      </div>
    </section>
  );
}
