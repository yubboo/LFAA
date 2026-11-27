// 编辑生成参数和已选产物；模型能力会影响视频模式与可连端口。
import type { ChangeEvent } from "react";
import type { CanvasAsset, CanvasNode, CanvasRun, VideoMode } from "@lfaa/canvas/contract";
import { assetUrl, type CanvasModel } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import styles from "./Canvas.module.css";

type Settings = CanvasNode["settings"];

interface InspectorProps {
  node: CanvasNode; models: CanvasModel[]; assets: CanvasAsset[]; runs: CanvasRun[];
  path: string; t: CanvasLabels; onUpdate: (settings: Settings) => void;
  onRun: () => void; onPick: (run: CanvasRun) => void;
  onPrevis: () => void; onUpload: (blob: File) => void; onRemove: () => void;
}

export function NodeInspector({ node, models, assets, runs, path, t, onUpdate, onRun, onPick, onPrevis, onUpload, onRemove }: InspectorProps) {
  const { settings, kind } = node;
  const isGenerator = kind === "image" || kind === "video";
  const available = models.filter((model) => model.kind === kind);
  const selected = available.find((model) => model.profileId === settings.profileId && model.modelId === settings.modelId);
  const chosenAsset = assets.find((asset) => asset.id === settings.assetId);
  const mode = settings.mode ?? "text";
  const busy = runs.some((run) => run.status === "starting" || run.status === "running");
  const selectModel = (event: ChangeEvent<HTMLSelectElement>) => {
    const model = available[Number.parseInt(event.target.value, 10)];
    const { profileId: _profile, modelId: _model, ...previous } = settings;
    if (model) onUpdate({ ...previous, modelId: model.modelId, profileId: model.profileId, ...(kind === "video" && !model.referenceVideo ? { mode: "text" } : {}) });
    else onUpdate(previous);
  };

  return (
    <aside className={styles.inspect} aria-label={t.edit}>
      <div className={styles.inline}><strong>{t[kind]}</strong><button onClick={onRemove}>{t.remove}</button></div>
      {(kind === "prompt" || isGenerator) && <label>{t.prompt}<textarea rows={4} value={settings.prompt ?? ""} maxLength={12000}
        onChange={(event) => onUpdate({ ...settings, prompt: event.target.value })} /></label>}
      {kind === "asset" && <label>{chosenAsset?.name ?? t.upload}<input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ""; }} /></label>}
      {kind === "previs" && <button onClick={onPrevis}>{t.edit} · {t.previs}</button>}
      {isGenerator && <>
        <label>{t.selectModel}<select value={selected ? available.indexOf(selected) : ""} onChange={selectModel}>
          <option value="">{t.selectModel}</option>
          {available.map((model, index) => <option key={model.profileId + ":" + model.modelId} value={index}>{model.profileName} · {model.modelId}</option>)}
        </select></label>
        {kind === "video" && selected?.referenceVideo && <label>{t.mode}<select value={mode} onChange={(event) => onUpdate({ ...settings, mode: event.target.value as VideoMode })}>
          <option value="text">{t.text}</option><option value="frames">{t.frames}</option><option value="reference">{t.reference}</option>
        </select></label>}
        <div className={styles.parameters}>
          {(kind !== "video" || mode !== "frames") && <label>{t.ratio}<select value={settings.ratio ?? "16:9"} onChange={(event) => onUpdate({ ...settings, ratio: event.target.value })}>
            {["16:9", "9:16", "1:1", "4:3", "3:4"].map((ratio) => <option key={ratio}>{ratio}</option>)}
          </select></label>}
          {kind === "video" && <>
            <label>{t.duration}<input type="number" min={2} max={15} value={settings.duration ?? 5} onChange={(event) => {
              const value = event.target.valueAsNumber;
              if (Number.isInteger(value) && value >= 2 && value <= 15) onUpdate({ ...settings, duration: value });
            }} /></label>
            <label>{t.resolution}<select value={settings.resolution ?? "720p"} onChange={(event) => onUpdate({ ...settings, resolution: event.target.value })}>
              {["480p", "720p", "1080p"].map((resolution) => <option key={resolution}>{resolution}</option>)}
            </select></label>
          </>}
          <label>{t.seed}<input type="number" min={0} max={2147483647} placeholder={t.unset} value={settings.seed ?? ""}
            onChange={(event) => {
              const value = event.target.valueAsNumber;
              const { seed: _seed, ...previous } = settings;
              if (event.target.value === "") onUpdate(previous);
              else if (Number.isInteger(value) && value >= 0 && value <= 2147483647) onUpdate({ ...previous, seed: value });
            }} /></label>
        </div>
        <button className={styles.primary} disabled={!selected || busy} onClick={onRun}>{busy ? t.running : t.run}</button>
      </>}
      {runs.length > 0 && <div className={styles.results} aria-label={t.output}>
        {runs.map((run) => <section key={run.id}>
          <span>{t[run.status]} {run.model && "· " + run.model}</span>
          {run.error && <p role="status" className={styles.error}>{run.error}</p>}
          {run.assetId && <>
            {run.kind === "image" ? <img alt={t.image} src={assetUrl(path, run.assetId)} /> : <video controls preload="metadata" src={assetUrl(path, run.assetId)} />}
            <div className={styles.inline}>
              <button disabled={settings.resultId === run.assetId} onClick={() => onPick(run)}>{settings.resultId === run.assetId ? t.selected : t.choose}</button>
              <a href={assetUrl(path, run.assetId)} download>{t.download}</a>
            </div>
          </>}
        </section>)}
      </div>}
    </aside>
  );
}
