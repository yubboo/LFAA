// @lfaa/plugins 插件中心主视图：只管理外部/自研插件（安装、启停、卸载、二创），内置插件已迁到设置中心。
import { useCallback, useEffect, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { ConfirmDialog } from "@lfaa/ui-primitives/client";
import type { PluginRecord } from "@lfaa/plugins/contract";
import { AddPluginDialog } from "./Add-Plugin";
import { PluginCard } from "./Plugin-Card";
import { pluginsMessages } from "../locales";
import {
  disablePluginRequest,
  enablePluginRequest,
  fetchPluginsState,
  forkPluginRequest,
  installPluginRequest,
  type PluginsStatePayload,
  uninstallPluginRequest,
  updatePluginManifestRequest,
} from "../api/plugins-client";
import styles from "./Plugins-View.module.css";

type Action = "install" | "enable" | "disable" | "uninstall";

/** 待确认与执行中的操作状态；同一时刻只允许一个操作推进。 */
interface PendingAction {
  action: Action;
  id: string;
  moduleName: string;
  name: string;
}

export function PluginsView({
  isZh,
  onSyncInstalled,
}: {
  isZh: boolean;
  onSyncInstalled: (installed: PluginRecord[]) => void;
}) {
  const t = pluginsMessages[isZh ? "zh" : "en"];
  const [state, setState] = useState<PluginsStatePayload>({ installed: [] });
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [working, setWorking] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const applyState = useCallback((next: PluginsStatePayload) => {
    setState(next);
    onSyncInstalled(next.installed);
  }, [onSyncInstalled]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      applyState(await fetchPluginsState());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [applyState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 执行已确认的操作，期间卡片显示进度行并禁用其他入口。 */
  const runPending = async (target: PendingAction) => {
    setPending(null);
    setWorking(target);
    setError(null);
    try {
      if (target.action === "install") {
        // 安装后立即启用：少一次点击，也让「已安装但没运行」的中间态不出现。
        const installed = await installPluginRequest(target.moduleName);
        applyState(installed);
        setWorking({ ...target, action: "enable", id: installed.plugin.id });
        applyState(await enablePluginRequest(installed.plugin.id));
      } else if (target.action === "enable") {
        applyState(await enablePluginRequest(target.id));
      } else if (target.action === "disable") {
        applyState(await disablePluginRequest(target.id));
      } else {
        applyState(await uninstallPluginRequest(target.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(null);
    }
  };

  const q = query.trim().toLowerCase();
  const matches = useCallback(
    (name: string, description: string, moduleName: string) =>
      !q || name.toLowerCase().includes(q) || description.toLowerCase().includes(q) || moduleName.toLowerCase().includes(q),
    [q],
  );

  const confirmText = pending ? t.confirm[pending.action] : null;
  const installed = state.installed.filter((record) =>
    matches(record.manifest.name, record.manifest.description, record.moduleName));

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t.title}</h2>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btn} onClick={() => setAdding(true)} disabled={working !== null}>
            {t.addEntry}
          </button>
          <button type="button" className={styles.btn} onClick={() => void refresh()} disabled={working !== null}>
            <IconRefresh size={14} /> {t.refresh}
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          value={query}
          placeholder={t.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && <div className={styles.notice} role="alert">{error}</div>}

      <section>
        <h3 className={styles.sectionTitle}>{t.installedSection}</h3>
        {state.installed.length === 0 ? (
          <div className={styles.emptyText}>{t.emptyInstalled}</div>
        ) : installed.length === 0 ? (
          <div className={styles.emptyText}>{t.emptyInstalledSearch}</div>
        ) : (
          <div className={styles.grid}>
            {installed.map((record) => (
              <PluginCard
                key={record.id}
                record={record}
                t={t}
                busy={working !== null}
                busyLabel={working?.id === record.id ? t.confirm[working.action].working : undefined}
                onEnable={() => setPending({ action: "enable", id: record.id, moduleName: record.moduleName, name: record.manifest.name })}
                onDisable={() => setPending({ action: "disable", id: record.id, moduleName: record.moduleName, name: record.manifest.name })}
                onUninstall={() => setPending({ action: "uninstall", id: record.id, moduleName: record.moduleName, name: record.manifest.name })}
                onUpdate={(patch) => void updatePluginManifestRequest(record.id, patch).then(applyState).catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : String(err));
                })}
                onFork={() => void forkPluginRequest(record.id).then(applyState).catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : String(err));
                })}
              />
            ))}
          </div>
        )}
      </section>

      <AddPluginDialog
        open={adding}
        t={t}
        onClose={() => setAdding(false)}
        onInstalled={(next) => applyState(next)}
      />

      <ConfirmDialog
        open={pending !== null}
        title={confirmText?.title ?? ""}
        description={(confirmText?.description ?? "").replace("{name}", pending?.name ?? "")}
        cancelLabel={t.cancel}
        confirmLabel={confirmText?.confirm ?? ""}
        closeLabel={t.cancel}
        onConfirm={() => {
          if (pending) void runPending(pending);
        }}
        onClose={() => setPending(null)}
      />
    </div>
  );
}