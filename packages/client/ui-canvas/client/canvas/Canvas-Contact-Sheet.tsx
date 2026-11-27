// 九宫格排版：从当前画布选图，按勾选顺序生成一张新的九宫格图片。
import { useEffect, useRef, useState } from "react";
import type { CanvasAsset } from "@lfaa/canvas/contract";
import { assetUrl } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import { renderContactSheet, type CanvasMediaOutput } from "./canvas-media-image";
import styles from "./Canvas-Media-Editor.module.css";

export function CanvasContactSheet({ assets, path, preferredId, t, onSave }: {
  assets: readonly CanvasAsset[];
  path: string;
  preferredId: string | undefined;
  t: CanvasLabels;
  onSave: (outputs: CanvasMediaOutput[], signal: AbortSignal) => Promise<void>;
}) {
  const [selection, setSelection] = useState<string[]>(() => preferredId && assets.some((asset) => asset.id === preferredId) ? [preferredId] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  const selected = selection.filter((id) => assets.some((asset) => asset.id === id));

  useEffect(() => () => pending.current?.abort(), []);

  async function save() {
    if (pending.current || selected.length < 2) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      const blob = await renderContactSheet(selected.map((id) => assetUrl(path, id)), controller.signal);
      await onSave([{ blob, name: `${t.contactSheet}.png` }], controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <>
      <p className={styles.status}>{t.contactSheetHelp}</p>
      <div className={styles.sheetGrid}>
        {assets.map((asset) => {
          const index = selected.indexOf(asset.id);
          const pressed = index >= 0;
          return (
            <button type="button" key={asset.id} className={styles.sheetCell} aria-pressed={pressed} disabled={busy || (!pressed && selected.length >= 9)}
              onClick={() => setSelection(pressed ? selected.filter((id) => id !== asset.id) : [...selected, asset.id])}>
              <img alt="" loading="lazy" src={assetUrl(path, asset.id)} />
              <span>{asset.name}</span>
              {pressed && <small aria-hidden="true">{index + 1}</small>}
            </button>
          );
        })}
      </div>
      {error && <p className={styles.status} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={busy || selected.length < 2} onClick={() => void save()}>{busy ? t.exporting : t.exportToBoard}</button>
      </div>
    </>
  );
}
