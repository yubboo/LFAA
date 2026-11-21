// 资料库「图像」分类：生成素材的类型筛选与缩略图网格；选中后的详情交给右栏检视器，不再占用画布宽度。
import { memo, useMemo, useState } from "react";
import { IconMusic, IconPhoto, IconVideo } from "@tabler/icons-react";
import type { ChatLocaleMessages } from "../locales";
import {
  filterMediaItems,
  MEDIA_FILTER_OPTIONS,
  type MediaFilterKind,
  type MediaLibraryItem,
} from "../media-library";
import type { LibraryMediaError } from "../library-store";
import { useLibrarySelection } from "../useLibraryState";
import { MediaThumb } from "./MediaThumb";
import styles from "./LibraryMediaGrid.module.css";

/** 媒体类型角标图标，与「生成素材库」弹窗保持一致。 */
function KindIcon({ kind }: { kind: MediaLibraryItem["kind"] }) {
  if (kind === "video") return <IconVideo size={12} stroke={1.8} aria-hidden="true" />;
  if (kind === "audio") return <IconMusic size={12} stroke={1.8} aria-hidden="true" />;
  return <IconPhoto size={12} stroke={1.8} aria-hidden="true" />;
}

// 单张素材卡片：选中态变化时只重绘受影响的两张卡，避免整页 30+ 张同时重渲染。
const MediaCard = memo(function MediaCard({
  item,
  selected,
  onSelect,
}: {
  item: MediaLibraryItem;
  selected: boolean;
  onSelect: (item: MediaLibraryItem) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.card} ${selected ? styles.cardActive : ""}`}
      aria-pressed={selected}
      onClick={() => onSelect(item)}
      title={item.prompt ?? item.name}
      data-media-name={item.name}
    >
      <span className={styles.thumb}>
        <MediaThumb item={item} mediaClassName={styles.media} fallbackClassName={styles.thumbFallback} />
      </span>
      <span className={styles.cardFooter}>
        <span className={styles.kindIcon} aria-hidden="true"><KindIcon kind={item.kind} /></span>
        <span className={styles.cardName}>{item.prompt || item.name}</span>
      </span>
    </button>
  );
});

/** 图像分类面板：类型筛选 + 全宽卡片网格；点击卡片选中并由外层展开右栏详情。 */
export function LibraryMediaGrid({
  locale,
  items,
  loading,
  error,
  query,
  onSelect,
}: {
  locale: ChatLocaleMessages;
  items: MediaLibraryItem[];
  loading: boolean;
  error: LibraryMediaError;
  query: string;
  onSelect: (item: MediaLibraryItem) => void;
}) {
  const [filter, setFilter] = useState<MediaFilterKind>("all");
  const selection = useLibrarySelection();
  const selectedPath = selection?.kind === "media" ? selection.item.path : null;
  const visible = useMemo(() => filterMediaItems(items, filter, query), [filter, items, query]);

  if (loading && items.length === 0) {
    return <p className={styles.status}>{locale.libraryMediaLoading}</p>;
  }
  if (error === "load") {
    return <p className={styles.error} role="alert">{locale.libraryMediaLoadError}</p>;
  }
  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <IconPhoto size={28} aria-hidden="true" />
        </div>
        <p className={styles.emptyTitle}>{locale.libraryMediaEmptyHint}</p>
      </div>
    );
  }

  return (
    <div className={styles.root} data-library-media="true">
      <div className={styles.filters} role="group" aria-label={locale.libraryTabImages}>
        {MEDIA_FILTER_OPTIONS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`${styles.filterBtn} ${filter === entry.id ? styles.filterBtnActive : ""}`}
            aria-pressed={filter === entry.id}
            onClick={() => setFilter(entry.id)}
          >
            {locale.isZh ? entry.zh : entry.en}
          </button>
        ))}
      </div>

      {error === "delete" && <p className={styles.error} role="alert">{locale.libraryMediaDeleteError}</p>}
      {visible.length === 0 ? (
        <p className={styles.status}>{locale.libraryMediaNoMatch}</p>
      ) : (
        <div className={styles.grid}>
          {visible.map((item) => (
            <MediaCard
              key={item.path}
              item={item}
              selected={selectedPath === item.path}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}