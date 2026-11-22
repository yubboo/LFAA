// 渲染设置中心「存储」视图：支持默认目录 / 项目推荐目录 / 自定义目录切换，并执行无损数据迁移。
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconFolderOpen } from "@tabler/icons-react";
import type { ChatClientStore, StorageLocationMode } from "@lfaa/chat/client";
import type { ChatLocaleMessages } from "@lfaa/chat/client";
import styles from "./StorageSettingsView.module.css";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function previewCustomDataPath(raw: string): string {
  const trimmed = raw.trim().replace(/[/\\]+$/u, "");
  if (!trimmed) return "";
  if (/([/\\]|^)data$/iu.test(trimmed)) return trimmed;
  const sep = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${sep}data`;
}

/** 展示当前资料存储位置与用量，将目录变更和迁移请求交由 Host 处理。 */
export function StorageSettingsView({
  locale,
  store,
  boundProjectId,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  boundProjectId: string | null;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [selectedMode, setSelectedMode] = useState<StorageLocationMode>(state.storageState?.mode ?? "default");
  const [customInput, setCustomInput] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const syncedStorageKeyRef = useRef<string>("");

  useEffect(() => {
    void store.refreshLibraryAndStorage(boundProjectId);
  }, [boundProjectId, store]);

  useEffect(() => {
    if (!state.storageState) return;
    const key = `${state.storageState.mode}:${state.storageState.dataRoot}`;
    if (syncedStorageKeyRef.current === key) return;
    syncedStorageKeyRef.current = key;
    setSelectedMode(state.storageState.mode);
    if (state.storageState.mode === "custom") {
      setCustomInput((prev) => prev || state.storageState!.dataRoot);
    }
  }, [state.storageState]);

  const storageState = state.storageState;
  const stats = state.storageStats;
  const customPreview = previewCustomDataPath(customInput);

  const handleBrowse = async () => {
    setNotice(null);
    try {
      const picked = await store.pickStorageFolder();
      if (picked.error) {
        setNotice({ ok: false, text: picked.error });
        return;
      }
      if (!picked.cancelled && picked.path) {
        setSelectedMode("custom");
        setCustomInput(picked.path);
      }
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleMigrate = async () => {
    setNotice(null);
    setMigrating(true);
    try {
      const res = await store.migrateStorage({
        mode: selectedMode,
        ...(selectedMode === "custom" ? { targetPath: customInput } : {}),
        projectId: boundProjectId,
      });
      setNotice({
        ok: true,
        text: `${locale.storageMigrationDone} ${res.toRoot}（${res.copiedFiles} files, ${formatSize(res.copiedBytes)}）`,
      });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <section className={styles.root} aria-label={locale.storageTitle}>
      <div className={styles.header}>
        <h1 className={styles.title}>{locale.storageTitle}</h1>
        <p className={styles.subtitle}>{locale.storageSubtitle}</p>
      </div>

      <div className={styles.card}>
        <div className={styles.pathRow}>
          <h2 className={styles.cardTitle}>{locale.storageCurrentPath}</h2>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => void store.openStorageFolderInExplorer()}
          >
            <IconFolderOpen size={15} aria-hidden="true" />
            <span>{locale.openStorageDirBtn}</span>
          </button>
        </div>
        <code className={styles.pathCode}>{storageState?.dataRoot || "..."}</code>
        {storageState?.appDataRoot && (
          <>
            <p className={styles.modeDesc}>{locale.isZh ? "应用数据文件夹（类似 .codex）" : "Application Data Folder"}</p>
            <code className={styles.pathCode}>{storageState.appDataRoot}</code>
          </>
        )}
        {storageState?.sessionsRoot && (
          <>
            <p className={styles.modeDesc}>{locale.storageFixedSessionsLabel}</p>
            <code className={styles.pathCode}>{storageState.sessionsRoot}</code>
          </>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{locale.storageStatsTitle}</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>{locale.storageMemoriesLabel}</span>
            <span className={styles.statValue}>{stats?.memoryCount ?? 0}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>{locale.storageSessionsLabel}</span>
            <span className={styles.statValue}>{stats?.sessionCount ?? 0}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>{locale.storageArtifactsLabel}</span>
            <span className={styles.statValue}>{stats?.artifactCount ?? 0}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>{locale.storageAssetsLabel}</span>
            <span className={styles.statValue}>{stats?.assetCount ?? 0}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>{locale.storageTotalSizeLabel}</span>
            <span className={styles.statValue}>{formatSize(stats?.totalBytes ?? 0)}</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <label
          className={`${styles.modeOption} ${selectedMode === "default" ? styles.modeOptionActive : ""}`}
          onClick={() => setSelectedMode("default")}
        >
          <span className={styles.modeTop}>
            <input
              type="radio"
              name="storage-mode"
              checked={selectedMode === "default"}
              onChange={() => setSelectedMode("default")}
            />
            <span>{locale.storageModeDefaultTitle}</span>
          </span>
          <p className={styles.modeDesc}>{locale.storageModeDefaultDesc}</p>
          <code className={styles.pathCode}>{storageState?.defaultDataRoot || locale.storageDetectingUserPath}</code>
        </label>

        <label
          className={`${styles.modeOption} ${selectedMode === "project" ? styles.modeOptionActive : ""}`}
          onClick={() => setSelectedMode("project")}
        >
          <span className={styles.modeTop}>
            <input
              type="radio"
              name="storage-mode"
              checked={selectedMode === "project"}
              onChange={() => setSelectedMode("project")}
            />
            <span>{locale.storageModeProjectTitle}</span>
          </span>
          <p className={styles.modeDesc}>{locale.storageModeProjectDesc}</p>
          <code className={styles.pathCode}>{storageState?.recommendedProjectDataRoot || locale.storageDetectingProjectPath}</code>
        </label>

        <div
          className={`${styles.modeOption} ${selectedMode === "custom" ? styles.modeOptionActive : ""}`}
          onClick={() => setSelectedMode("custom")}
        >
          <span className={styles.modeTop}>
            <input
              type="radio"
              name="storage-mode"
              checked={selectedMode === "custom"}
              onChange={() => setSelectedMode("custom")}
            />
            <span>{locale.storageModeCustomTitle}</span>
          </span>
          <p className={styles.modeDesc}>{locale.storageModeCustomDesc}</p>
          <div className={styles.customRow}>
            <input
              type="text"
              className={styles.input}
              placeholder={locale.storageCustomPlaceholder}
              value={customInput}
              onFocus={() => setSelectedMode("custom")}
              onChange={(e) => {
                setSelectedMode("custom");
                setCustomInput(e.target.value);
              }}
            />
            <button type="button" className={styles.secondaryBtn} onClick={() => void handleBrowse()}>
              {locale.storagePickFolderBtn}
            </button>
          </div>
          {selectedMode === "custom" && customPreview && (
            <p className={styles.modeDesc}>
              {`${locale.storageResolvedPreview} `}
              <code className={styles.pathCode}>{customPreview}</code>
            </p>
          )}
        </div>

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={migrating || (selectedMode === "custom" && !customInput.trim())}
            onClick={() => void handleMigrate()}
          >
            {migrating ? locale.storageMigratingBtn : locale.storageApplyMigrateBtn}
          </button>
        </div>

        {notice && (
          <p className={notice.ok ? styles.noticeOk : styles.noticeErr} role="status">
            {notice.text}
          </p>
        )}
      </div>
    </section>
  );
}
