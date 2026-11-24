// 渲染「资料库」中心页：按左二分类展示生成素材、资产与记忆；选中项交给右栏检视器，页面本身不再放预览列。
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { IconBooks, IconFolderOpen, IconPlus, IconSearch, IconSettings, IconTrash, IconUpload } from "@tabler/icons-react";
import type { LibraryTabKey } from "@lfaa/ui-layout/client";
import type { ChatClientStore, ChatLocaleMessages, LongTermMemoryItem } from "@lfaa/client-ui-chat/client";
import {
  formatByteSize,
  libraryMediaStore,
  librarySelectionStore,
  useLibraryMedia,
  useLibrarySelection,
  type LibrarySelection,
  type MediaLibraryItem,
} from "@lfaa/client-ui-tool-media/client";
import { LibraryMediaGrid } from "./LibraryMediaGrid";
import styles from "./LibraryView.module.css";
import cardStyles from "./LibraryView.cards.module.css";

/** 根据左二分类查看资料和资产详情，选中项交给右栏检视器展示内容与操作。 */
export function LibraryView({
  locale,
  store,
  boundProjectId,
  activeTab = "all",
  onSelectTab,
  onShowDetails,
  onOpenStorageSettings,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  boundProjectId: string | null;
  activeTab?: LibraryTabKey;
  onSelectTab: (tab: LibraryTabKey) => void;
  onShowDetails: () => void;
  onOpenStorageSettings: () => void;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const media = useLibraryMedia();
  const selection = useLibrarySelection();
  const [query, setQuery] = useState("");
  const [newMemoryText, setNewMemoryText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const tab = activeTab;
  const isMediaTab = tab === "media";

  useEffect(() => {
    void store.refreshLibraryAndStorage(boundProjectId);
  }, [boundProjectId, store]);

  // 生成素材来自工作区/媒体目录，与资料库存储分离；读取由共享存储去重。
  useEffect(() => {
    void libraryMediaStore.reload();
  }, []);

  // 分类切换后，只保留与新分类兼容的选中项；离开资料库时清空，避免右栏残留旧详情。
  useEffect(() => {
    const current = librarySelectionStore.getSnapshot();
    if (!current) return;
    const visible = current.kind === "media"
      ? tab === "media"
      : (tab === "asset" || tab === "artifact");
    if (!visible && tab !== "all") librarySelectionStore.clear();
  }, [tab]);

  useEffect(() => () => librarySelectionStore.clear(), []);

  const q = query.trim().toLowerCase();
  const filteredAssets = useMemo(() => {
    if (tab === "memory" || tab === "media") return [];
    return state.libraryAssets.filter((item) => {
      if ((tab === "artifact" || tab === "asset") && item.category !== tab) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q)
        || item.fileName.toLowerCase().includes(q)
        || Boolean(item.summary && item.summary.toLowerCase().includes(q))
        || item.tags.some((t) => t.toLowerCase().includes(q));
    });
  }, [q, state.libraryAssets, tab]);

  const filteredMemories = useMemo<LongTermMemoryItem[]>(() => {
    if (tab === "artifact" || tab === "asset" || tab === "media") return [];
    return state.memories.filter((m) => {
      if (!q) return true;
      return m.content.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q));
    });
  }, [q, state.memories, tab]);

  const artifactCount = state.libraryAssets.filter((a) => a.category === "artifact").length;
  const assetCount = state.libraryAssets.filter((a) => a.category === "asset").length;
  const memoryCount = state.memories.length;
  const mediaCount = media.items.length;
  const totalCount = state.libraryAssets.length + memoryCount;
  const count = tab === "media"
    ? mediaCount
    : tab === "artifact"
      ? artifactCount
      : tab === "asset"
        ? assetCount
        : tab === "memory"
          ? memoryCount
          : totalCount;

  const category = tab === "media"
    ? { label: locale.libraryTabImages, hint: locale.libraryCategoryHintMedia }
    : tab === "artifact"
      ? { label: locale.libraryTabArtifacts, hint: locale.libraryCategoryHintArtifact }
      : tab === "asset"
        ? { label: locale.libraryTabAssets, hint: locale.libraryCategoryHintAsset }
        : tab === "memory"
          ? { label: locale.libraryTabMemories, hint: locale.libraryCategoryHintMemory }
          : { label: locale.libraryTabAll, hint: locale.libraryCategoryHintAll };

  const reveal = (next: Exclude<LibrarySelection, null>) => {
    librarySelectionStore.set(next);
    onShowDetails();
  };

  const handleSelectMedia = useCallback((item: MediaLibraryItem) => {
    librarySelectionStore.set({ kind: "media", item });
    onShowDetails();
  }, [onShowDetails]);

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const isText = file.type.startsWith("text/")
        || /\.(md|txt|json|ts|tsx|js|jsx|css|html|yaml|yml|py|csv)$/iu.test(file.name);
      if (isText) {
        const text = await file.text();
        const created = await store.saveLibraryAsset({
          category: "asset",
          title: file.name,
          fileName: file.name,
          content: text,
          encoding: "utf8",
          projectId: boundProjectId,
        });
        onSelectTab("asset");
        reveal({ kind: "asset", id: created.id, title: created.title });
      } else {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (const b of bytes) bin += String.fromCharCode(b);
        const created = await store.saveLibraryAsset({
          category: "asset",
          title: file.name,
          fileName: file.name,
          content: btoa(bin),
          encoding: "base64",
          mimeType: file.type || "application/octet-stream",
          projectId: boundProjectId,
        });
        onSelectTab("asset");
        reveal({ kind: "asset", id: created.id, title: created.title });
      }
    } finally {
      event.target.value = "";
    }
  };

  const handleAddMemory = async () => {
    const text = newMemoryText.trim();
    if (!text) return;
    await store.addLongTermMemory({
      scope: boundProjectId ? "project" : "global",
      projectId: boundProjectId,
      content: text,
    });
    setNewMemoryText("");
  };

  const showItems = filteredAssets.length > 0 || filteredMemories.length > 0;

  return (
    <section className={styles.root} aria-label={locale.libraryTitle}>
      <header className={styles.topBar}>
        <div className={styles.titleBlock}>
          <div className={styles.titleLine}>
            <h1 className={styles.title}>{category.label}</h1>
            <span className={styles.titleCount}>{count}</span>
            <button
              type="button"
              className={styles.pathBadge}
              title={state.storageState?.dataRoot || ""}
              onClick={() => void store.openStorageFolderInExplorer()}
            >
              <IconFolderOpen size={13} aria-hidden="true" />
              <span>{state.storageState?.dataRoot || "..."}</span>
            </button>
          </div>
          <p className={styles.subtitle}>{category.hint}</p>
        </div>

        <div className={styles.topControls}>
          <label className={styles.searchPill}>
            <IconSearch size={14} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder={locale.librarySearchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <input ref={fileRef} type="file" hidden onChange={(e) => void handleImportFile(e)} />
          <button type="button" className={styles.primaryBtn} onClick={() => fileRef.current?.click()}>
            <IconUpload size={14} aria-hidden="true" />
            <span>{locale.importAssetBtn}</span>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={locale.manageStorageBtn}
            title={locale.manageStorageBtn}
            onClick={onOpenStorageSettings}
          >
            <IconSettings size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className={styles.mainBody}>
        {/* 图像面板保持挂载、仅切显隐：来回切分类时不再重建 30+ 张卡片与已解码缩略图。 */}
        <div className={isMediaTab ? styles.mediaPanel : styles.mediaPanelHidden}>
          <LibraryMediaGrid
            locale={locale}
            items={media.items}
            loading={media.loading}
            error={media.error}
            query={query}
            onSelect={handleSelectMedia}
          />
        </div>

        {!isMediaTab && (tab === "all" || tab === "memory") && (
          <div className={styles.quickMemoryBar}>
            <input
              type="text"
              className={styles.memoryInput}
              placeholder={locale.addMemoryPlaceholder}
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddMemory();
              }}
            />
            <button type="button" className={styles.secondaryBtn} onClick={() => void handleAddMemory()}>
              <IconPlus size={14} aria-hidden="true" />
              <span>{locale.addMemory}</span>
            </button>
          </div>
        )}

        {!isMediaTab && (!showItems ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <IconBooks size={28} aria-hidden="true" />
            </div>
            <p className={styles.emptyTitle}>{locale.emptyLibraryHint}</p>
            <div className={styles.emptyActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => fileRef.current?.click()}>
                <IconUpload size={14} aria-hidden="true" />
                <span>{locale.importAssetBtn}</span>
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => void store.openStorageFolderInExplorer()}>
                <IconFolderOpen size={14} aria-hidden="true" />
                <span>{locale.openStorageDirBtn}</span>
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={onOpenStorageSettings}>
                <IconSettings size={14} aria-hidden="true" />
                <span>{locale.manageStorageBtn}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className={cardStyles.cardsGrid}>
            {filteredAssets.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${cardStyles.vaultCard} ${selection?.kind === "asset" && selection.id === item.id ? cardStyles.vaultCardSelected : ""}`}
                onClick={() => reveal({ kind: "asset", id: item.id, title: item.title })}
              >
                <div className={cardStyles.cardTopRow}>
                  <span className={cardStyles.badge}>
                    {item.category === "artifact" ? locale.artifactBadge : locale.assetBadge}
                  </span>
                  <span className={cardStyles.cardSize}>{formatByteSize(item.sizeBytes)}</span>
                </div>
                <strong className={cardStyles.cardTitle}>{item.title}</strong>
                <span className={cardStyles.cardPath}>{item.relativePath}</span>
              </button>
            ))}

            {filteredMemories.map((mem) => (
              <div key={mem.id} className={cardStyles.vaultCard}>
                <div className={cardStyles.cardTopRow}>
                  <span className={cardStyles.badge}>{locale.memoryBadge}</span>
                  <button
                    type="button"
                    className={cardStyles.deleteBtn}
                    aria-label={locale.deleteMemory}
                    onClick={() => void store.removeLongTermMemory(mem.id)}
                  >
                    <IconTrash size={13} aria-hidden="true" />
                  </button>
                </div>
                <p className={cardStyles.memoryContent}>{mem.content}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}