// 右栏与设置共用的下载确认和结果。Host 保留请求状态，视图切换后可继续处理。
import { useCallback, useEffect, useRef, useState } from "react";
import { IconDownload } from "@tabler/icons-react";
import { useVisibleInterval } from "@lfaa/ui-primitives/client";
import { decideDownload, fetchDownloadActivity, pickDownloadLocation, type BrowserDownloadStatus } from "../api/browser-data-client";
import styles from "./DownloadActivity.module.css";

/** 有任务在跑时保持 1 秒刷新；全部落地后放慢到 15 秒，避免空转请求。 */
const ACTIVE_POLL_MS = 1000;
const IDLE_POLL_MS = 15_000;

function statusText(item: BrowserDownloadStatus, isZh: boolean) {
  const labels = {
    checking: ["正在检查下载权限", "Checking download permissions"],
    awaiting: ["等待确认下载", "Awaiting download approval"],
    transferring: ["正在下载", "Downloading"],
    saved: ["已保存", "Saved"],
    blocked: ["已按网站规则拦截", "Blocked by site rules"],
    cancelled: item.reason === "timeout" ? ["确认已超时", "Approval expired"] : ["已取消", "Cancelled"],
    failed: item.reason === "history"
      ? ["文件已保存，写入历史失败", "File saved, but history could not be updated"]
      : item.reason === "destination"
        ? ["无法写入保存位置", "Could not write to the destination"]
        : item.reason === "busy"
          ? ["下载任务过多，请稍后重试", "Too many downloads in progress. Try again shortly."]
          : ["下载失败", "Download failed"],
  };
  return labels[item.state][isZh ? 0 : 1];
}

function DownloadRow({ item, isZh, onChange }: { item: BrowserDownloadStatus; isZh: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = item.state === "awaiting";
  const downloadLabel = isZh ? "保存文件" : "Save file";
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      onChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.row} data-download-state={item.state}>
      <IconDownload className={styles.icon} size={15} aria-hidden="true" />
      <div className={styles.details}>
        <strong className={styles.filename}>{item.filename}</strong>
        <span className={styles.state} role="status">{statusText(item, isZh)}</span>
        {pending && item.url && <span className={styles.path} title={item.url}>{item.url}</span>}
        {(pending || item.savePath) && (
          <span className={styles.path} title={item.savePath ?? item.directory}>{item.savePath ?? item.directory}</span>
        )}
        {pending && (
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={busy} onClick={() => void act(() => decideDownload(item, "save"))}>{downloadLabel}</button>
            {item.chooseLocation && (
              <button type="button" disabled={busy} onClick={() => void act(() => pickDownloadLocation(item, isZh))}>
                {isZh ? "更改位置" : "Change location"}
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => void act(() => decideDownload(item, "cancel"))}>
              {isZh ? "取消下载" : "Cancel download"}
            </button>
          </div>
        )}
        {error && <span className={styles.error} role="alert">{error}</span>}
      </div>
    </div>
  );
}

/** 可见时拉取任务状态，历史页收到新增成功记录后刷新当前搜索结果。 */
export function DownloadActivity({ sessionId, isZh, onSaved, onNewDownload }: {
  sessionId?: string;
  isZh: boolean;
  onSaved?: () => void;
  onNewDownload?: () => void;
}) {
  const [items, setItems] = useState<BrowserDownloadStatus[]>([]);
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  // 拉一次下载状态：卸载后不再写回，避免面板切换时的无效 setState。
  const load = useCallback(async () => {
    try {
      const result = await fetchDownloadActivity(sessionId);
      if (!mountedRef.current) return;
      setItems(result.items);
      setFailed(false);
    } catch {
      if (mountedRef.current) setFailed(true);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  // 只有存在待确认/传输中的任务才高频轮询；空闲与后台标签页都不再打接口。
  const polling = items.some((item) => item.state === "awaiting" || item.state === "transferring" || item.state === "checking");
  useVisibleInterval(load, polling ? ACTIVE_POLL_MS : IDLE_POLL_MS);
  const newestId = items.reduce<BrowserDownloadStatus | undefined>((latest, item) => (
    !latest || item.startedAt > latest.startedAt ? item : latest
  ), undefined)?.id;
  useEffect(() => {
    if (newestId) onNewDownload?.();
  }, [newestId, onNewDownload]);
  const saved = items.find((item) => item.state === "saved")?.id;
  useEffect(() => {
    if (saved) onSaved?.();
  }, [saved, onSaved]);

  const visible = items.filter((item) => item.state === "awaiting" || item.state === "transferring" || item.state === "checking");
  const recent = items.filter((item) => !visible.includes(item) && (sessionId || item.state !== "saved")).slice(0, 3);
  if (!visible.length && !recent.length && !failed) return null;
  return (
    <section className={styles.activity} aria-label={isZh ? "下载任务" : "Download activity"}>
      {failed && <div className={styles.error} role="status">{isZh ? "暂时无法读取下载状态" : "Download status is temporarily unavailable"}</div>}
      {[...visible, ...recent].map((item) => <DownloadRow key={item.id} item={item} isZh={isZh} onChange={() => setRevision((value) => value + 1)} />)}
    </section>
  );
}
