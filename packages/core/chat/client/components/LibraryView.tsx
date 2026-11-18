// 渲染「资料库」视图：参考画廊网格与顶部筛选栏布局，并与左二「资料库」分类菜单双向同步。
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { IconBooks, IconFolderOpen, IconPlus, IconSearch, IconSettings, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import type { LibraryTabKey } from "@lfaa/ui-layout/client";
import type { ChatClientStore, LibraryAssetItem, LongTermMemoryItem } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import styles from "./LibraryView.module.css";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 根据工作台的分类导航查看资料和资产详情，并触发选中资料的管理操作。 */
export function LibraryView({
  locale,
  store,
  boundProjectId,
  activeTab = "all",
  onChangeTab,
  onOpenStorageSettings,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  boundProjectId: string | null;
  activeTab?: LibraryTabKey;
  onChangeTab?: (tab: LibraryTabKey) => void;
  onOpenStorageSettings: () => void;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [localTab, setLocalTab] = useState<LibraryTabKey>(activeTab);
  const tab = onChangeTab ? activeTab : localTab;
  const setTab = (next: LibraryTabKey) => {
    setLocalTab(next);
    onChangeTab?.(next);
  };

  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ item: LibraryAssetItem; content: string } | null>(null);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [copiedNotice, setCopiedNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void store.refreshLibraryAndStorage(boundProjectId);
  }, [boundProjectId, store]);

  const q = query.trim().toLowerCase();
  const filteredAssets = useMemo(() => {
    if (tab === "memory") return [];
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
    if (tab === "artifact" || tab === "asset") return [];
    return state.memories.filter((m) => {
      if (!q) return true;
      return m.content.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q));
    });
  }, [q, state.memories, tab]);

  const artifactCount = state.libraryAssets.filter((a) => a.category === "artifact").length;
  const assetCount = state.libraryAssets.filter((a) => a.category === "asset").length;
  const memoryCount = state.memories.length;
  const totalCount = state.libraryAssets.length + memoryCount;

  const handleSelectAsset = async (asset: LibraryAssetItem) => {
    setSelectedAssetId(asset.id);
    setCopiedNotice("");
    try {
      const detail = await store.readLibraryAsset(asset.id);
      setPreviewData({ item: detail.item, content: detail.content });
    } catch {
      setPreviewData({ item: asset, content: asset.summary || asset.relativePath });
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
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
      await handleSelectAsset(created);
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
      await handleSelectAsset(created);
    }
    event.target.value = "";
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
            <h1 className={styles.title}>{locale.libraryTitle}</h1>
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
          <p className={styles.subtitle}>{locale.librarySubtitle}</p>
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

      <nav className={styles.tabStrip} aria-label={locale.libraryTitle}>
        {([
          ["all", locale.libraryTabAll, totalCount],
          ["artifact", locale.libraryTabArtifacts, artifactCount],
          ["asset", locale.libraryTabAssets, assetCount],
          ["memory", locale.libraryTabMemories, memoryCount],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            className={`${styles.tabItem} ${tab === key ? styles.tabItemActive : ""}`}
            onClick={() => setTab(key)}
          >
            <span>{label}</span>
            <span className={styles.tabCount}>{count}</span>
          </button>
        ))}
      </nav>

      <div className={styles.mainBody}>
        {(tab === "all" || tab === "memory") && (
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

        {!showItems ? (
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
          <div className={previewData ? styles.workspaceWithPreview : styles.cardsOnly}>
            <div className={styles.cardsGrid}>
              {filteredAssets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.vaultCard} ${selectedAssetId === item.id ? styles.vaultCardSelected : ""}`}
                  onClick={() => void handleSelectAsset(item)}
                >
                  <div className={styles.cardTopRow}>
                    <span className={styles.badge}>
                      {item.category === "artifact" ? locale.artifactBadge : locale.assetBadge}
                    </span>
                    <span className={styles.cardSize}>{formatSize(item.sizeBytes)}</span>
                  </div>
                  <strong className={styles.cardTitle}>{item.title}</strong>
                  <span className={styles.cardPath}>{item.relativePath}</span>
                </button>
              ))}

              {filteredMemories.map((mem) => (
                <div key={mem.id} className={styles.vaultCard}>
                  <div className={styles.cardTopRow}>
                    <span className={styles.badge}>{locale.memoryBadge}</span>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      aria-label={locale.deleteMemory}
                      onClick={() => void store.removeLongTermMemory(mem.id)}
                    >
                      <IconTrash size={13} aria-hidden="true" />
                    </button>
                  </div>
                  <p className={styles.memoryContent}>{mem.content}</p>
                </div>
              ))}
            </div>

            {previewData && (
              <aside className={styles.previewCard} aria-label={previewData.item.title}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitleWrap}>
                    <strong className={styles.cardTitle}>{previewData.item.title}</strong>
                    <span className={styles.cardPath}>{previewData.item.relativePath}</span>
                  </div>
                  <div className={styles.previewActions}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => {
                        void navigator.clipboard?.writeText(previewData.content);
                        setCopiedNotice(locale.copiedNotice);
                      }}
                    >
                      {copiedNotice || locale.copyContentBtn}
                    </button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      aria-label={locale.deleteMemory}
                      onClick={() => {
                        void store.removeLibraryAsset(previewData.item.id).then(() => {
                          setPreviewData(null);
                          setSelectedAssetId(null);
                        });
                      }}
                    >
                      <IconTrash size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      aria-label={locale.isZh ? "关闭预览" : "Close preview"}
                      onClick={() => {
                        setPreviewData(null);
                        setSelectedAssetId(null);
                      }}
                    >
                      <IconX size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <pre className={styles.previewBody}>{previewData.content}</pre>
              </aside>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
