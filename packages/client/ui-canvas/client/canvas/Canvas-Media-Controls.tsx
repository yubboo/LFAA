// 画布媒体编辑参数控件，按功能显示必要的裁剪框、输出规格、区间或文字。
import { IconRotate, IconRotateClockwise } from "@tabler/icons-react";
import type { CanvasLabels } from "../locales";
import type { CanvasMediaParameters } from "./canvas-media-actions";
import { isVideoOperation, type CanvasMediaOperation } from "./canvas-media-image";
import styles from "./Canvas-Media-Editor.module.css";

const cropFields = [
  { key: "x", label: "cropLeft" }, { key: "y", label: "cropTop" },
  { key: "width", label: "cropWidth" }, { key: "height", label: "cropHeight" },
] as const;

export function CanvasMediaControls({ operation, params, duration, busy, t, onChange }: {
  operation: CanvasMediaOperation;
  params: CanvasMediaParameters;
  duration: number;
  busy: boolean;
  t: CanvasLabels;
  onChange: (params: Partial<CanvasMediaParameters>) => void;
}) {
  return (
    <div className={styles.controls}>
      {(operation === "crop" || operation === "videoCrop") && cropFields.map(({ key, label }) => (
        <label className={styles.control} key={key}>{t[label]} (%)
          <input type="number" min="0" max="100" value={params.crop[key]} disabled={busy} onChange={(event) => onChange({ crop: { ...params.crop, [key]: Number(event.target.value) } })} />
        </label>
      ))}

      {operation === "rotate" && (
        <>
          <button className={styles.button} type="button" disabled={busy} onClick={() => onChange({ rotation: (params.rotation - 90) % 360 })}><IconRotate size={16} />{t.turnLeft}</button>
          <button className={styles.button} type="button" disabled={busy} onClick={() => onChange({ rotation: (params.rotation + 90) % 360 })}><IconRotateClockwise size={16} />{t.turnRight}</button>
        </>
      )}

      {operation === "splitGrid" && (
        <label className={styles.control}>{t.gridSize}
          <select value={params.side} disabled={busy} onChange={(event) => onChange({ side: Number(event.target.value) })}>
            <option value="2">2 × 2</option><option value="3">3 × 3</option>
          </select>
        </label>
      )}

      {(operation === "imageResize" || operation === "videoResize") && (
        <label className={styles.control}>{t.outputLongEdge}
          <select value={params.longEdge} disabled={busy} onChange={(event) => onChange({ longEdge: Number(event.target.value) })}>
            {[1080, 1920, 2560, 3840].map((size) => <option key={size} value={size}>{size} px</option>)}
          </select>
        </label>
      )}

      {operation === "annotate" && (
        <>
          <label className={styles.control}>{t.annotationText}
            <input type="text" maxLength={80} value={params.annotation.text} disabled={busy} onChange={(event) => onChange({ annotation: { ...params.annotation, text: event.target.value } })} />
          </label>
          {(["x", "y"] as const).map((axis) => (
            <label className={styles.control} key={axis}>{t[axis === "x" ? "cropLeft" : "cropTop"]} (%)
              <input type="number" min="0" max="95" value={params.annotation[axis]} disabled={busy} onChange={(event) => onChange({ annotation: { ...params.annotation, [axis]: Number(event.target.value) } })} />
            </label>
          ))}
        </>
      )}

      {isVideoOperation(operation) && operation !== "snapshot" && (
        <>
          <label className={styles.control}>{t.clipStart}<input type="number" min="0" max={duration} step="0.01" value={params.start} disabled={busy} onChange={(event) => onChange({ start: Number(event.target.value) })} /></label>
          <label className={styles.control}>{t.clipEnd}<input type="number" min="0" max={duration} step="0.01" value={params.end} disabled={busy} onChange={(event) => onChange({ end: Number(event.target.value) })} /></label>
        </>
      )}

      {operation === "frameStrip" && (
        <label className={styles.control}>{t.frameCount}
          <select value={params.frameCount} disabled={busy} onChange={(event) => onChange({ frameCount: Number(event.target.value) })}>
            {[3, 6, 9, 12].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
