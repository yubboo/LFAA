// 渲染设置中心「存储」页：当前存储位置、用量统计与「默认 / 项目 / 自定义」三种位置模式的迁移表单。
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconFolderOpen } from "@tabler/icons-react";
import type { ChatClientStore, StorageLocationMode } from "@lfaa/client-ui-chat/client";
import type { ChatLocaleMessages } from "@lfaa/client-ui-chat/client";
import {
  SettingFormActions,
  SettingGroup,
  SettingRow,
  SettingsPage,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
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

  // 三种位置模式共用的选项定义，渲染成表单内的单选项。
  const modeOptions: Array<{ mode: StorageLocationMode; title: string; desc: string; path: string }> = [
    {
      mode: "default",
      title: locale.storageModeDefaultTitle,
      desc: locale.storageModeDefaultDesc,
      path: storageState?.defaultDataRoot || locale.storageDetectingUserPath,
    },
    {
      mode: "project",
      title: locale.storageModeProjectTitle,
      desc: locale.storageModeProjectDesc,
      path: storageState?.recommendedProjectDataRoot || locale.storageDetectingProjectPath,
    },
    {
      mode: "custom",
      title: locale.storageModeCustomTitle,
      desc: locale.storageModeCustomDesc,
      path: "",
    },
  ];

  return (
    <SettingsPage title={locale.storageTitle} description={locale.storageSubtitle}>
      <SettingGroup title={locale.storageCurrentPath}>
        <SettingRow
          title={locale.storageCurrentPath}
          description={<code className={styles.pathCode}>{storageState?.dataRoot || "..."}</code>}
          control={(
            <button
              type="button"
              className={baseStyles.actionBtn}
              onClick={() => void store.openStorageFolderInExplorer()}
            >
              <IconFolderOpen size={15} aria-hidden="true" />
              <span>{locale.openStorageDirBtn}</span>
            </button>
          )}
        />
        {storageState?.appDataRoot && (
          <SettingRow
            title={locale.isZh ? "应用数据文件夹" : "Application data folder"}
            description={locale.isZh ? "类似 .codex 的应用数据目录" : "App data directory, similar to .codex"}
            control={<code className={styles.pathCode}>{storageState.appDataRoot}</code>}
          />
        )}
        {storageState?.sessionsRoot && (
          <SettingRow
            title={locale.storageFixedSessionsLabel}
            description={locale.isZh ? "所有会话历史固定存放于此，不随位置模式变化" : "Chat history always lives here regardless of mode"}
            control={<code className={styles.pathCode}>{storageState.sessionsRoot}</code>}
          />
        )}
      </SettingGroup>

      <SettingGroup title={locale.storageStatsTitle}>
        <SettingRow
          title={locale.storageMemoriesLabel}
          control={<span className={styles.statValue}>{stats?.memoryCount ?? 0}</span>}
        />
        <SettingRow
          title={locale.storageSessionsLabel}
          control={<span className={styles.statValue}>{stats?.sessionCount ?? 0}</span>}
        />
        <SettingRow
          title={locale.storageArtifactsLabel}
          control={<span className={styles.statValue}>{stats?.artifactCount ?? 0}</span>}
        />
        <SettingRow
          title={locale.storageAssetsLabel}
          control={<span className={styles.statValue}>{stats?.assetCount ?? 0}</span>}
        />
        <SettingRow
          title={locale.storageTotalSizeLabel}
          control={<span className={styles.statValue}>{formatSize(stats?.totalBytes ?? 0)}</span>}
        />
      </SettingGroup>

      {/* 位置模式是需要一次提交的表单：选项、自定义路径与迁移按钮上下排。 */}
      <SettingGroup
        title={locale.isZh ? "存储位置" : "Storage location"}
        description={locale.isZh
          ? "切换位置会把现有资料复制到新目录，原目录内容保留。"
          : "Switching copies existing data into the new directory; the old one is left in place."}
      >
        <div className={styles.modeList} role="radiogroup" aria-label={locale.isZh ? "存储位置模式" : "Storage location mode"}>
          {modeOptions.map((option) => (
            <label
              key={option.mode}
              className={`${styles.modeOption} ${selectedMode === option.mode ? styles.modeOptionActive : ""}`}
            >
              <span className={styles.modeTop}>
                <input
                  type="radio"
                  name="storage-mode"
                  checked={selectedMode === option.mode}
                  onChange={() => setSelectedMode(option.mode)}
                />
                <span className={styles.modeTitle}>{option.title}</span>
              </span>
              <span className={styles.modeDesc}>{option.desc}</span>
              {option.path && <code className={styles.pathCode}>{option.path}</code>}
              {option.mode === "custom" && (
                <span className={styles.customRow}>
                  <input
                    type="text"
                    className={baseStyles.input}
                    placeholder={locale.storageCustomPlaceholder}
                    value={customInput}
                    onFocus={() => setSelectedMode("custom")}
                    onChange={(e) => {
                      setSelectedMode("custom");
                      setCustomInput(e.target.value);
                    }}
                  />
                  <button type="button" className={baseStyles.actionBtn} onClick={() => void handleBrowse()}>
                    {locale.storagePickFolderBtn}
                  </button>
                </span>
              )}
              {option.mode === "custom" && selectedMode === "custom" && customPreview && (
                <span className={styles.modeDesc}>
                  {`${locale.storageResolvedPreview} `}
                  <code className={styles.pathCode}>{customPreview}</code>
                </span>
              )}
            </label>
          ))}
        </div>

        <SettingFormActions>
          <button
            type="button"
            className={baseStyles.primaryBtn}
            disabled={migrating || (selectedMode === "custom" && !customInput.trim())}
            onClick={() => void handleMigrate()}
          >
            {migrating ? locale.storageMigratingBtn : locale.storageApplyMigrateBtn}
          </button>
          {notice && (
            <span className={notice.ok ? styles.noticeOk : styles.noticeErr} role="status">
              {notice.text}
            </span>
          )}
        </SettingFormActions>
      </SettingGroup>
    </SettingsPage>
  );
}