// 资料库「回收站」视图：统一管理最近 30 天内删除的素材、文档资产、无限画布与项目，支持按类型筛选、多选批量恢复与二次确认彻底删除。
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCheck, IconMinus, IconPhoto, IconTrash } from "@tabler/icons-react";
import styles from "./LibraryTrashView.module.css";

type TrashKind = "all" | "media" | "asset" | "canvas" | "project";

interface TrashItem {
  id: string;
  kind: Exclude<TrashKind, "all">;
  title: string;
  deletedAt: number;
  remainingDays: number;
  originLabel?: string;
  previewUrl?: string;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export function LibraryTrashView({
  isZh,
  query,
  onRestored,
}: {
  isZh: boolean;
  query: string;
  onRestored?: () => void;
}) {
  const [kind, setKind] = useState<TrashKind>("all");
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trash?kind=${encodeURIComponent(kind)}`);
      const data = await res.json() as { items?: TrashItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
      setSelected(new Set());
      setConfirmPurge(false);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return items;
    return items.filter((item) =>
      item.title.toLowerCase().includes(q)
      || Boolean(item.originLabel && item.originLabel.toLowerCase().includes(q)));
  }, [items, q]);

  const allSelected = visible.length > 0 && visible.every((item) => selected.has(item.id));
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
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(visible.map((item) => item.id)));
  }

  async function handleRestore() {
    if (!someSelected || busy) return;
    setBusy(true);
    try {
      await fetch("/api/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      await reload();
      onRestored?.();
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
    try {
      await fetch("/api/trash/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const kindLabel = (k: Exclude<TrashKind, "all">) => {
    if (k === "media") return isZh ? "图像素材" : "Media";
    if (k === "asset") return isZh ? "文档资产" : "Asset";
    if (k === "canvas") return isZh ? "画布" : "Canvas";
    return isZh ? "项目" : "Project";
  };

  const tabs: Array<{ id: TrashKind; label: string }> = [
    { id: "all", label: isZh ? "全部" : "All" },
    { id: "media", label: isZh ? "图像素材" : "Media" },
    { id: "asset", label: isZh ? "文档资产" : "Assets" },
    { id: "canvas", label: isZh ? "画布" : "Canvases" },
    { id: "project", label: isZh ? "项目" : "Projects" },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.filterBar}>
        <div className={styles.pills}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={styles.pill}
              data-active={kind === tab.id ? "true" : undefined}
              onClick={() => setKind(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scroll}>
        {loading ? (
          <div className={styles.empty}>{isZh ? "正在加载回收站…" : "Loading recycle bin…"}</div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>
            <IconTrash size={26} stroke={1.4} aria-hidden="true" />
            <span>{isZh ? "回收站为空" : "Recycle bin is empty"}</span>
          </div>
        ) : (
          <div className={styles.grid}>
            {visible.map((item) => {
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
                      <img src={item.previewUrl} alt={item.title} className={styles.thumbImg} loading="lazy" />
                    ) : (
                      <IconPhoto size={24} stroke={1.5} aria-hidden="true" />
                    )}
                    <span className={styles.checkbox} data-checked={checked ? "true" : undefined}>
                      {checked && <IconCheck size={12} stroke={2.4} />}
                    </span>
                    <span className={styles.kindBadge}>{kindLabel(item.kind)}</span>
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.title} title={item.title}>{item.title}</span>
                    <span className={styles.sub}>
                      {`${formatDate(item.deletedAt)} · ${isZh ? `剩余 ${item.remainingDays} 天` : `${item.remainingDays}d left`}`}
                    </span>
                    {item.originLabel && (
                      <span className={styles.sub}>
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
        <button type="button" className={styles.selectAllBtn} onClick={toggleAll} disabled={visible.length === 0}>
          <span className={styles.checkInline} data-checked={someSelected ? "true" : undefined}>
            {allSelected ? <IconCheck size={11} stroke={2.4} /> : someSelected ? <IconMinus size={11} stroke={2.4} /> : null}
          </span>
          <span>{isZh ? `已选择 ${selected.size} 项` : `${selected.size} selected`}</span>
        </button>

        <div className={styles.actions}>
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
  );
}
