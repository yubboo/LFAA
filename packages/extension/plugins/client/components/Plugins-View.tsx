// @lfaa/plugins 插件中心主视图：汇总真实状态与可安装目录，操作前二次确认并展示执行进度。
import { useCallback, useEffect, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { ConfirmDialog } from "@lfaa/ui-primitives/client";
import type { PluginRecord } from "../../contract/index";
import { AddPluginDialog } from "./Add-Plugin";
import { CatalogCard } from "./Catalog-Card";
import { PluginCard } from "./Plugin-Card";
import { pluginsMessages } from "../locales";
import {
  disablePluginRequest,
  setPresetRequest,
  enableBuiltinRequest,
  enablePluginRequest,
  fetchPluginsState,
  forkPluginRequest,
  installPluginRequest,
  type PluginsStatePayload,
  uninstallPluginRequest,
  updatePluginManifestRequest,
} from "../plugins-client";
import styles from "./Plugins-View.module.css";

type Action = "install" | "enable" | "disable" | "uninstall";

/** 待确认与执行中的操作状态；同一时刻只允许一个操作推进。 */
interface PendingAction {
  action: Action;
  id: string;
  moduleName: string;
  name: string;
  /** 来源类型：内置插件走一步启用，不存在安装语义。 */
  kind?: "builtin" | "external" | undefined;
}

export function PluginsView({
  isZh,
  onSyncInstalled,
}: {
  isZh: boolean;
  onSyncInstalled: (installed: PluginRecord[]) => void;
}) {
  const t = pluginsMessages[isZh ? "zh" : "en"];
  const [state, setState] = useState<PluginsStatePayload>({ installed: [], availableCatalog: [] });
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [working, setWorking] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [switching, setSwitching] = useState(false);

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
      if (target.action === "install" && target.kind === "builtin") {
        applyState(await enableBuiltinRequest(target.moduleName));
      } else if (target.action === "install") {
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

  // 插件中心按新会话的默认模式展示其能力组合。
  const catalog = state.availableCatalog.filter((entry) =>
    matches(entry.manifest.name, entry.manifest.description, entry.moduleName));
  const activePreset = state.presets?.find((preset) => preset.id === state.activePreset) ?? state.presets?.[0];
  const sessionModules = new Set(activePreset?.modules ?? []);
  const sessionCatalog = catalog.filter((entry) => sessionModules.has(entry.moduleName));
  const globalCatalog = catalog.filter((entry) => !sessionModules.has(entry.moduleName));

  /** 更新新会话默认模式并刷新状态。 */
  const switchPreset = async (id: string) => {
    setSwitching(true);
    setError(null);
    try {
      applyState(await setPresetRequest(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t.title}</h2>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        <div className={styles.headerActions}>
          {state.presets && state.presets.length > 0 && (
            <label className={styles.modePicker}>
              <span>{t.modeLabel}</span>
              <select
                value={state.activePreset ?? state.presets[0]?.id}
                disabled={switching || working !== null}
                onChange={(event) => void switchPreset(event.target.value)}
              >
                {state.presets.map((preset) => (
                  <option key={preset.id} value={preset.id} disabled={preset.unavailable}>
                    {isZh ? preset.name : preset.nameEn}
                  </option>
                ))}
              </select>
            </label>
          )}
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
        ) : (
          <div className={styles.grid}>
            {state.installed
              .filter((record) => matches(record.manifest.name, record.manifest.description, record.moduleName))
              .map((record) => (
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

      <section>
        <h3 className={styles.sectionTitle}>{t.sessionSection}</h3>
        <div className={styles.grid}>
          {sessionCatalog.map((entry) => (
            <CatalogCard
              key={`s-${entry.moduleName}`}
              entry={entry}
              t={t}
              busy={working !== null}
              busyLabel={working && working.moduleName === entry.moduleName ? t.confirm[working.action].working : undefined}
              onInstall={() => setPending({ action: "install", id: entry.manifest.id, moduleName: entry.moduleName, name: entry.manifest.name, kind: entry.kind })}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className={styles.sectionTitle}>{t.globalSection}</h3>
        {globalCatalog.length === 0 ? (
          <div className={styles.emptyText}>{t.emptyCatalog}</div>
        ) : (
          <div className={styles.grid}>
            {globalCatalog
              .map((entry) => (
                <CatalogCard
                  key={entry.moduleName}
                  entry={entry}
                  t={t}
                  busy={working !== null}
                  busyLabel={working && working.moduleName === entry.moduleName ? t.confirm[working.action].working : undefined}
                  onInstall={() => setPending({
                    action: "install",
                    id: entry.manifest.id,
                    moduleName: entry.moduleName,
                    name: entry.manifest.name,
                    kind: entry.kind,
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
