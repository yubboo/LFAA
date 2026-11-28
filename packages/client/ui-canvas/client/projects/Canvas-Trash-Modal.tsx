// 无限画布「我的项目」回收站弹窗：与统一回收站 /api/trash 接口联动，支持勾选恢复与二次确认彻底删除。
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconMinus, IconPhoto, IconTrash, IconX } from "@tabler/icons-react";
import styles from "./Canvas-Trash-Modal.module.css";

interface TrashItem {
  id: string;
  kind: "media" | "asset" | "canvas" | "project";
  title: string;
  deletedAt: number;
  remainingDays: number;
  originLabel?: string;
  previewUrl?: string;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function withApiToken(url: string): string {
  if (typeof document === "undefined") return url;
  const token = document.querySelector<HTMLMetaElement>('meta[name="lfaa-api-token"]')?.content?.trim();
  if (!token) return url;
  return url + (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
}

async function readErrorText(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json() as { error?: string };
    return data.error?.trim() || `${fallback} (HTTP ${res.status})`;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

export function CanvasTrashModal({
  isZh,
  onClose,
  onRestored,
}: {
  isZh: boolean;
  onClose: () => void;
  onRestored: (info?: { restoredDefaultCanvas?: boolean }) => void;
}) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trash?kind=all&projectKind=canvas");
      if (!res.ok) {
        setItems([]);
        setError(await readErrorText(res, isZh ? "读取回收站失败" : "Failed to load recycle bin"));
        return;
      }
      const data = await res.json() as { items?: TrashItem[] };
      const all = Array.isArray(data.items) ? data.items : [];
      setItems(all.filter((item) => item.kind === "canvas" || item.kind === "project"));
      setSelected(new Set());
      setConfirmPurge(false);
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [isZh]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const someSelected = selected.size > 0;

  function toggleOne(id: string) {
    setConfirmPurge(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setConfirmPurge(false);
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  }

  async function handleRestore() {
    if (!someSelected || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) {
        setError(await readErrorText(res, isZh ? "恢复失败" : "Restore failed"));
        return;
      }
      const data = await res.json() as { restoredDefaultCanvas?: boolean; failed?: Array<{ reason?: string }> };
      await reload();
      if (Array.isArray(data.failed) && data.failed.length > 0) {
        setError(data.failed[0]?.reason || (isZh ? "部分条目恢复失败" : "Some items failed to restore"));
      }
      onRestored({ restoredDefaultCanvas: data.restoredDefaultCanvas === true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handlePurge() {
    if (!someSelected || busy) return;
    if (!confirmPurge) {
      setConfirmPurge(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/trash/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) {
        setError(await readErrorText(res, isZh ? "彻底删除失败" : "Delete failed"));
        return;
      }
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isZh ? "回收站" : "Recycle Bin"}
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>{isZh ? "回收站" : "Recycle Bin"}</h2>
            <span className={styles.subtitle}>
              {isZh ? "仅显示最近 30 天内删除的内容" : "Only shows items deleted within the last 30 days"}
            </span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label={isZh ? "关闭" : "Close"}
            onClick={onClose}
          >
            <IconX size={16} stroke={1.8} />
          </button>
        </header>

        <div className={styles.body}>
          {error && <div role="alert" className={styles.errorBanner}>{error}</div>}
          {loading ? (
            <div className={styles.empty}>{isZh ? "正在加载…" : "Loading…"}</div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <IconTrash size={26} stroke={1.4} aria-hidden="true" />
              <span>{isZh ? "回收站为空" : "Recycle bin is empty"}</span>
            </div>
          ) : (
            <div className={styles.grid}>
              {items.map((item) => {
                const checked = selected.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={styles.card}
                    data-selected={checked ? "true" : undefined}
                    onClick={() => toggleOne(item.id)}
                  >
                    <div className={styles.thumb}>
                      {item.previewUrl ? (
                        <img src={withApiToken(item.previewUrl)} alt={item.title} className={styles.thumbImg} loading="lazy" />
                      ) : (
                        <IconPhoto size={24} stroke={1.5} aria-hidden="true" />
                      )}
                      <span className={styles.checkbox} data-checked={checked ? "true" : undefined}>
                        {checked && <IconCheck size={12} stroke={2.4} />}
                      </span>
                    </div>
                    <div className={styles.meta}>
                      <span className={styles.cardTitle} title={item.title}>{item.title}</span>
                      <span className={styles.cardSub}>
                        {`${formatDate(item.deletedAt)} · ${isZh ? `剩余 ${item.remainingDays} 天` : `${item.remainingDays}d left`}`}
                      </span>
                      {item.originLabel && (
                        <span className={styles.cardSub}>
                          {`${isZh ? "原位置：" : "From: "}${item.originLabel}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.selectAll} onClick={toggleAll} disabled={items.length === 0}>
            <span className={styles.checkInline} data-checked={someSelected ? "true" : undefined}>
              {allSelected ? <IconCheck size={11} stroke={2.4} /> : someSelected ? <IconMinus size={11} stroke={2.4} /> : null}
            </span>
            <span>{isZh ? `已选择 ${selected.size} 项` : `${selected.size} selected`}</span>
          </button>

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={!someSelected || busy}
              onClick={() => void handlePurge()}
            >
              {confirmPurge
                ? (isZh ? `确认彻底删除 (${selected.size})` : `Confirm delete (${selected.size})`)
                : (isZh ? "彻底删除" : "Delete permanently")}
            </button>
            <button
              type="button"
              className={styles.restoreBtn}
              disabled={!someSelected || busy}
              onClick={() => void handleRestore()}
            >
              {isZh ? "恢复" : "Restore"}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
