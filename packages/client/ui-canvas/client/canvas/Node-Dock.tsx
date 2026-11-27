// 选中节点的底部悬浮生成控制台：严格还原参考图 8/9 的深色玻璃输入卡片，不挤占画布两侧空间。
import { IconArrowUp, IconBox, IconUpload } from "@tabler/icons-react";
import type { CanvasAsset, CanvasNode, CanvasRun } from "@lfaa/canvas/contract";
import { assetUrl, type CanvasModel } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import styles from "./Node-Dock.module.css";

const ratios = ["16:9", "9:16", "4:3", "3:4", "1:1"];

export function NodeDock({
  node,
  models,
  assets,
  runs,
  path,
  t,
  onUpdate,
  onRun,
  onPick,
  onPrevis,
  onUpload,
}: {
  node: CanvasNode;
  models: CanvasModel[];
  assets: CanvasAsset[];
  runs: CanvasRun[];
  path: string;
  t: CanvasLabels;
  onUpdate: (settings: CanvasNode["settings"]) => void;
  onRun: () => void;
  onPick: (run: CanvasRun) => void;
  onPrevis: () => void;
  onUpload: (file: File) => void;
}) {
  const { settings } = node;
  const available = node.kind === "image" || node.kind === "video"
    ? models.filter((model) => model.kind === node.kind)
    : [];
  const chosenModel = available.find((item) => item.profileId === settings.profileId && item.modelId === settings.modelId);
  const promptValue = settings.prompt ?? "";
  const isMediaGen = node.kind === "image" || node.kind === "video";
  const running = runs.some((run) => run.status === "starting" || run.status === "running");

  if (node.kind === "asset" || node.kind === "previs") {
    const asset = assets.find((item) => item.id === settings.assetId);
    return (
      <div className={styles.dock}>
        <div className={styles.compactRow}>
          <span className={styles.compactLabel}>{asset ? asset.name : t[node.kind]}</span>
          {node.kind === "previs" ? (
            <button type="button" className={styles.primaryPill} onClick={onPrevis}>
              <IconBox size={14} />{t.previs}
            </button>
          ) : (
            <label className={styles.primaryPill}>
              <IconUpload size={14} />{t.upload}
              <input
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUpload(file);
                  event.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dock}>
      {node.kind === "video" && (
        <div className={styles.modeTabs}>
          <button
            type="button"
            className={styles.modeTab}
            data-active={(settings.mode ?? "frames") === "frames" ? "true" : undefined}
            onClick={() => onUpdate({ ...settings, mode: "frames" })}
          >
            {t.frames}
          </button>
          <button
            type="button"
            className={styles.modeTab}
            data-active={settings.mode === "reference" ? "true" : undefined}
            onClick={() => onUpdate({ ...settings, mode: "reference" })}
          >
            {t.reference}
          </button>
        </div>
      )}

      <div className={styles.inputArea}>
        <textarea
          rows={2}
          maxLength={5000}
          placeholder={t.promptPlaceholder}
          value={promptValue}
          onChange={(event) => onUpdate({ ...settings, prompt: event.target.value })}
        />
        <span className={styles.counter}>{promptValue.length}/5000</span>
      </div>

      <div className={styles.footer}>
        <div className={styles.controls}>
          {isMediaGen && (
            <>
              <select
                className={styles.select}
                aria-label={t.selectModel}
                value={settings.profileId && settings.modelId ? `${settings.profileId}\0${settings.modelId}` : ""}
                onChange={(event) => {
                  const [profileId, modelId] = event.target.value.split("\0");
                  onUpdate({ ...settings, ...(profileId && modelId ? { profileId, modelId } : {}) });
                }}
              >
                <option value="">{t.selectModel}</option>
                {available.map((model) => (
                  <option key={`${model.profileId}\0${model.modelId}`} value={`${model.profileId}\0${model.modelId}`}>
                    {model.profileName} · {model.modelId}
                  </option>
                ))}
              </select>

              <select
                className={styles.select}
                aria-label={t.ratio}
                value={settings.ratio ?? "16:9"}
                onChange={(event) => onUpdate({ ...settings, ratio: event.target.value })}
              >
                {ratios.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
              </select>

              {node.kind === "video" && (
                <>
                  <select
                    className={styles.select}
                    aria-label={t.duration}
                    value={settings.duration ?? 5}
                    onChange={(event) => onUpdate({ ...settings, duration: Number(event.target.value) })}
                  >
                    {[5, 8, 10].map((sec) => <option key={sec} value={sec}>{sec}s</option>)}
                  </select>
                  <select
                    className={styles.select}
                    aria-label={t.resolution}
                    value={settings.resolution ?? "720p"}
                    onChange={(event) => onUpdate({ ...settings, resolution: event.target.value })}
                  >
                    <option value="720p">720P</option>
                    <option value="1080p">1080P</option>
                  </select>
                </>
              )}
            </>
          )}
          {chosenModel && <span className={styles.modelTag}>{chosenModel.modelId}</span>}
        </div>

        {isMediaGen && (
          <button
            type="button"
            className={styles.sendBtn}
            aria-label={t.run}
            title={t.run}
            disabled={running}
            onClick={onRun}
          >
            <IconArrowUp size={16} stroke={2.2} />
          </button>
        )}
      </div>

      {runs.length > 0 && (
        <div className={styles.runsStrip}>
          {runs.slice(0, 5).map((run) => (
            <button
              key={run.id}
              type="button"
              className={styles.runChip}
              data-active={settings.resultId === run.assetId ? "true" : undefined}
              disabled={!run.assetId}
              onClick={() => onPick(run)}
            >
              {run.assetId && run.kind === "image" && <img alt="" src={assetUrl(path, run.assetId)} />}
              <span>{t[run.status]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
