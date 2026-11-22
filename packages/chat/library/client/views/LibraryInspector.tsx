// 资料库右栏检视器：未选中时展示存储概览，选中生成素材或资产后展示内容、提示词与操作。
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  IconArrowLeft,
  IconChevronRight,
  IconFolderOpen,
  IconMaximize,
  IconMinimize,
  IconSettings,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import type { ChatClientStore, ChatLocaleMessages, LibraryAssetItem } from "@lfaa/chat/client";
import {
  formatByteSize,
  getMediaThumbnail,
  libraryMediaStore,
  librarySelectionStore,
  mediaKindLabel,
  PREVIEW_WIDTH,
  useLibraryMedia,
  useLibrarySelection,
  useMediaBlob,
} from "@lfaa/tool-media/client";
import styles from "./LibraryInspector.module.css";

/** 资产详情读取状态：只在选中资产时触发一次读取。 */
interface AssetDetail {
  status: "loading" | "ready" | "error";
  item?: LibraryAssetItem;
  content?: string;
  isText?: boolean;
}

/** 把生成时间格式化为本地可读文本，界面不暴露磁盘路径。 */
function formatCreatedAt(createdAt: number, isZh: boolean): string {
  return new Date(createdAt).toLocaleString(isZh ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 右栏检视器外壳：头部标题与栏位控制，主体按选中项切换概览/媒体/资产。 */
// 头部图标：返回箭头清空选中，最大化/还原与收起草共同使用现有右栏能力。
export function LibraryInspector({
  locale,
  store,
  compact = false,
  maximized = false,
  onToggleMaximize,
  onCollapse,
  onCloseDrawer,
  onOpenStorageSettings,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  compact?: boolean | undefined;
  maximized?: boolean | undefined;
  onToggleMaximize?: (() => void) | undefined;
  onCollapse?: (() => void) | undefined;
  onCloseDrawer?: (() => void) | undefined;
  onOpenStorageSettings: () => void;
}) {
  const selection = useLibrarySelection();
  const media = useLibraryMedia();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [assetDetail, setAssetDetail] = useState<AssetDetail>({ status: "loading" });
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // 图片用 960px 缓存预览，视频/音频才需要完整文件；避免每点一张图都拉一次原图。
  const needsFullMedia = selection?.kind === "media" && selection.item.kind !== "image";
  const mediaUrl = useMediaBlob(needsFullMedia ? selection.item.path : "");

  // 先用 480px 缩略图垫底，再换成 960px 预览；两者都走同一份缓存。
  useEffect(() => {
    setThumbUrl(null);
    setPreviewUrl(null);
    if (selection?.kind !== "media") return;
    let cancelled = false;
    void getMediaThumbnail(selection.item).then((url) => {
      if (!cancelled) setThumbUrl(url);
    });
    if (selection.item.kind === "image") {
      void getMediaThumbnail(selection.item, PREVIEW_WIDTH).then((url) => {
        if (!cancelled) setPreviewUrl(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [selection]);

  // 选中项变化时重置操作态；资产内容按 id 现读，避免把全文塞进全局状态。
  useEffect(() => {
    setCopied(false);
    setConfirmDelete(false);
    setActionError(false);
    if (selection?.kind !== "asset") {
      setAssetDetail({ status: "loading" });
      return;
    }
    let cancelled = false;
    setAssetDetail({ status: "loading" });
    void store.readLibraryAsset(selection.id)
      .then((detail) => {
        if (cancelled) return;
        setAssetDetail({ status: "ready", item: detail.item, content: detail.content, isText: detail.isText });
      })
      .catch(() => {
        if (!cancelled) setAssetDetail({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [selection, store]);

  const closePanel = () => {
    if (compact) onCloseDrawer?.();
    else onCollapse?.();
  };

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
  };

  const deleteSelected = async () => {
    if (!selection || deleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setActionError(false);
    try {
      if (selection.kind === "media") {
        if (!(await libraryMediaStore.remove(selection.item.path))) {
          setActionError(true);
          return;
        }
      } else {
        await store.removeLibraryAsset(selection.id);
      }
      librarySelectionStore.clear();
    } catch {
      setActionError(true);
    } finally {
      setDeleting(false);
    }
  };

  const title = selection
    ? selection.kind === "media" ? locale.libraryInspectorMedia : locale.libraryInspectorAsset
    : locale.libraryInspectorOverview;
  const storagePath = snapshot.storageState?.dataRoot ?? "";
  const counts = [
    { id: "media", label: locale.libraryTabImages, value: media.items.length },
    { id: "artifact", label: locale.libraryTabArtifacts, value: snapshot.libraryAssets.filter((item) => item.category === "artifact").length },
    { id: "asset", label: locale.libraryTabAssets, value: snapshot.libraryAssets.filter((item) => item.category === "asset").length },
    { id: "memory", label: locale.libraryTabMemories, value: snapshot.memories.length },
  ];

  return (
    <section className={styles.panel} aria-label={title} data-region="library-inspector">
      <header className={styles.header}>
        <strong className={styles.title} title={title}>{title}</strong>
        <div className={styles.headerActions}>
          {selection && (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={locale.libraryInspectorCancel}
              title={locale.libraryInspectorCancel}
              onClick={() => librarySelectionStore.clear()}
            >
              <IconArrowLeft size={15} aria-hidden="true" />
            </button>
          )}
          {!compact && onToggleMaximize && (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={maximized ? locale.libraryInspectorRestore : locale.libraryInspectorMaximize}
              title={maximized ? locale.libraryInspectorRestore : locale.libraryInspectorMaximize}
              onClick={onToggleMaximize}
            >
              {maximized ? <IconMinimize size={15} aria-hidden="true" /> : <IconMaximize size={15} aria-hidden="true" />}
            </button>
          )}
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={locale.libraryInspectorCollapse}
            title={locale.libraryInspectorCollapse}
            onClick={closePanel}
          >
            {compact ? <IconX size={15} aria-hidden="true" /> : <IconChevronRight size={16} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {!selection && (
          <div className={styles.overview}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{locale.libraryInspectorStorage}</h2>
              <p className={styles.path} title={storagePath}>{storagePath || "..."}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => void store.openStorageFolderInExplorer()}>
                  <IconFolderOpen size={14} aria-hidden="true" />
                  <span>{locale.openStorageDirBtn}</span>
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={onOpenStorageSettings}>
                  <IconSettings size={14} aria-hidden="true" />
                  <span>{locale.manageStorageBtn}</span>
                </button>
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{locale.libraryInspectorOverview}</h2>
              <div className={styles.counts}>
                {counts.map((entry) => (
                  <div key={entry.id} className={styles.countCard}>
                    <span className={styles.countValue}>{entry.value}</span>
                    <span className={styles.countLabel}>{entry.label}</span>
                  </div>
                ))}
              </div>
              <p className={styles.hint}>{locale.libraryInspectorHint}</p>
            </section>
          </div>
        )}

        {selection?.kind === "media" && (
          <div className={styles.detail}>
            {selection.item.kind === "image" ? (
              previewUrl || thumbUrl ? (
                <img
                  className={styles.media}
                  src={previewUrl ?? thumbUrl ?? ""}
                  alt={selection.item.prompt || selection.item.name}
                  onError={() => {
                    // 960 坏掉就退回 480；两者都坏则显示加载/占位，而不是浏览器坏图标。
                    if (previewUrl) setPreviewUrl(null);
                    else setThumbUrl(null);
                  }}
                />
              ) : (
                <p className={styles.status}>{locale.libraryMediaLoading}</p>
              )
            ) : mediaUrl ? (
              selection.item.kind === "video" ? (
                <video className={styles.media} src={mediaUrl} controls playsInline preload="metadata" />
              ) : (
                <audio className={styles.audio} src={mediaUrl} controls preload="metadata" />
              )
            ) : selection.item.kind === "video" && thumbUrl ? (
              <img
                className={styles.media}
                src={thumbUrl}
                alt={selection.item.prompt || selection.item.name}
                onError={() => setThumbUrl(null)}
              />
            ) : (
              <p className={styles.status}>{locale.libraryMediaLoading}</p>
            )}

            <p className={styles.meta}>
              {mediaKindLabel(selection.item.kind, locale.isZh)}
              {" · "}{formatByteSize(selection.item.bytes)}
              {selection.item.model ? ` · ${selection.item.model}` : ""}
              {" · "}{formatCreatedAt(selection.item.createdAt, locale.isZh)}
            </p>

            {selection.item.prompt && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{locale.libraryMediaPromptLabel}</h2>
                <p className={styles.promptText}>{selection.item.prompt}</p>
              </section>
            )}
            <p className={styles.fileName}>{selection.item.name}</p>

            <div className={styles.actions}>
              {selection.item.prompt && (
                <button type="button" className={styles.secondaryBtn} onClick={() => copy(selection.item.prompt ?? "")}>
                  <span>{copied ? locale.copiedNotice : locale.libraryMediaCopyPrompt}</span>
                </button>
              )}
              <button
                type="button"
                className={`${styles.dangerBtn} ${confirmDelete ? styles.dangerBtnArmed : ""}`}
                disabled={deleting}
                onClick={() => void deleteSelected()}
                onBlur={() => setConfirmDelete(false)}
              >
                <IconTrash size={14} aria-hidden="true" />
                <span>{deleting ? locale.libraryMediaDeleting : confirmDelete ? locale.libraryMediaDeleteConfirm : locale.libraryMediaDelete}</span>
              </button>
            </div>
            {actionError && <p className={styles.error} role="alert">{locale.libraryMediaDeleteError}</p>}
          </div>
        )}

        {selection?.kind === "asset" && (
          <div className={styles.detail}>
            {assetDetail.status === "loading" && <p className={styles.status}>{locale.libraryInspectorLoading}</p>}
            {assetDetail.status === "error" && <p className={styles.error} role="alert">{locale.libraryInspectorLoadError}</p>}
            {assetDetail.status === "ready" && assetDetail.item && (
              <>
                <strong className={styles.assetTitle}>{assetDetail.item.title}</strong>
                <p className={styles.meta}>
                  {formatByteSize(assetDetail.item.sizeBytes)} · {formatCreatedAt(assetDetail.item.createdAt, locale.isZh)}
                </p>
                <p className={styles.path}>{assetDetail.item.relativePath}</p>
                {assetDetail.isText ? (
                  <pre className={styles.content}>{assetDetail.content}</pre>
                ) : (
                  <p className={styles.hint}>{locale.libraryInspectorBinary}</p>
                )}
                <div className={styles.actions}>
                  {assetDetail.isText && (
                    <button type="button" className={styles.secondaryBtn} onClick={() => copy(assetDetail.content ?? "")}>
                      <span>{copied ? locale.copiedNotice : locale.copyContentBtn}</span>
                    </button>
                  )}
                  <button type="button" className={styles.secondaryBtn} onClick={() => void store.openStorageFolderInExplorer()}>
                    <IconFolderOpen size={14} aria-hidden="true" />
                    <span>{locale.openStorageDirBtn}</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.dangerBtn} ${confirmDelete ? styles.dangerBtnArmed : ""}`}
                    disabled={deleting}
                    onClick={() => void deleteSelected()}
                    onBlur={() => setConfirmDelete(false)}
                  >
                    <IconTrash size={14} aria-hidden="true" />
                    <span>{deleting ? locale.libraryMediaDeleting : confirmDelete ? locale.libraryMediaDeleteConfirm : locale.libraryMediaDelete}</span>
                  </button>
                </div>
                {actionError && <p className={styles.error} role="alert">{locale.libraryMediaDeleteError}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}