// @lfaa/plugins 插件中心主视图，支持安装、启停、卸载、编辑清单、二创副本及跳转运行中扩展详情。
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCopy, IconEdit, IconPlayerPlay, IconPlayerStop, IconRefresh, IconTrash } from "@tabler/icons-react";
import type { PluginRecord } from "../contract/index";
import { pluginsMessages } from "./locales";
import {
  disablePluginRequest,
  enablePluginRequest,
  fetchPluginsState,
  forkPluginRequest,
  installPluginRequest,
  type PluginsStatePayload,
  uninstallPluginRequest,
  updatePluginManifestRequest,
} from "./plugins-client";
import styles from "./Plugins-View.module.css";

export function PluginsView({
  isZh,
  onSyncInstalled,
  onOpenPluginView,
}: {
  isZh: boolean;
  onSyncInstalled: (installed: PluginRecord[]) => void;
  onOpenPluginView: (viewId: string) => void;
}) {
  const t = pluginsMessages[isZh ? "zh" : "en"];
  const [state, setState] = useState<PluginsStatePayload>({ installed: [], availableCatalog: [] });
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const applyState = useCallback((next: PluginsStatePayload) => {
    setState(next);
    onSyncInstalled(next.installed);
  }, [onSyncInstalled]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchPluginsState();
      applyState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [applyState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = async (id: string, task: () => Promise<PluginsStatePayload>) => {
    setBusyId(id);
    setError(null);
    try {
      const next = await task();
      applyState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const filteredInstalled = useMemo(() => {
    if (!q) return state.installed;
    return state.installed.filter(
      (p) => p.manifest.name.toLowerCase().includes(q) || p.manifest.description.toLowerCase().includes(q),
    );
  }, [q, state.installed]);

  const filteredCatalog = useMemo(() => {
    if (!q) return state.availableCatalog;
    return state.availableCatalog.filter(
      (c) => c.manifest.name.toLowerCase().includes(q) || c.manifest.description.toLowerCase().includes(q),
    );
  }, [q, state.availableCatalog]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t.title}</h2>
          <p className={styles.subtitle}>
            {t.subtitle}
            {state.profileRoot ? ` (${state.profile ?? "web"}: ${state.profileRoot})` : ""}
          </p>
        </div>
        <button type="button" className={styles.btn} onClick={() => void refresh()} disabled={busyId !== null}>
          <IconRefresh size={14} /> {t.refresh}
        </button>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          value={query}
          placeholder={t.searchPlaceholder}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <div className={styles.notice} role="alert">{error}</div>}

      <div>
        <h3 className={styles.sectionTitle}>{t.installedSection}</h3>
        {filteredInstalled.length === 0 ? (
          <div className={styles.emptyText}>{t.emptyInstalled}</div>
        ) : (
          <div className={styles.grid}>
            {filteredInstalled.map((item) => {
              const running = item.status === "running";
              const busy = busyId === item.id;
              const isEditing = editingId === item.id;
              return (
                <div key={item.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{item.manifest.name}</span>
                    <span className={`${styles.badge} ${running ? styles.badgeRunning : ""}`}>
                      {t.statusMap[item.status]} · v{item.manifest.version}
                    </span>
                  </div>
                  <p className={styles.desc}>{item.manifest.description}</p>
                  <div className={styles.capList}>
                    {item.manifest.capabilities.tools.length > 0 && (
                      <span>{t.toolsLabel}{item.manifest.capabilities.tools.join(", ")}</span>
                    )}
                    {item.manifest.capabilities.skills.length > 0 && (
                      <span>{t.skillsLabel}{item.manifest.capabilities.skills.join(", ")}</span>
                    )}
                    {item.originPluginId && (
                      <span>{t.originLabel}{item.originPluginId}</span>
                    )}
                  </div>

                  {isEditing && (
                    <div className={styles.editBox}>
                      <input
                        className={styles.searchInput}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      <input
                        className={styles.searchInput}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          disabled={busy}
                          onClick={() => {
                            void runAction(item.id, () =>
                              updatePluginManifestRequest(item.id, { name: editName, description: editDesc }),
                            ).then(() => setEditingId(null));
                          }}
                        >
                          {t.save}
                        </button>
                        <button type="button" className={styles.btn} onClick={() => setEditingId(null)}>
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={styles.actions}>
                    {running ? (
                      <>
                        {item.manifest.capabilities.views[0] && (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => onOpenPluginView(item.manifest.capabilities.views[0]!)}
                          >
                            {t.openDetail}
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy}
                          onClick={() => void runAction(item.id, () => disablePluginRequest(item.id))}
                        >
                          <IconPlayerStop size={13} /> {t.disable}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        disabled={busy}
                        onClick={() => void runAction(item.id, () => enablePluginRequest(item.id))}
                      >
                        <IconPlayerPlay size={13} /> {t.enable}
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.manifest.name);
                        setEditDesc(item.manifest.description);
                      }}
                    >
                      <IconEdit size={13} /> {t.edit}
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => void runAction(item.id, () => forkPluginRequest(item.id))}
                    >
                      <IconCopy size={13} /> {t.fork}
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={busy}
                      onClick={() => void runAction(item.id, () => uninstallPluginRequest(item.id))}
                    >
                      <IconTrash size={13} /> {t.uninstall}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className={styles.sectionTitle}>{t.catalogSection}</h3>
        <div className={styles.grid}>
          {filteredCatalog.map((entry) => (
            <div key={entry.manifest.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>{entry.manifest.name}</span>
                <span className={styles.badge}>v{entry.manifest.version}</span>
              </div>
              <p className={styles.desc}>{entry.manifest.description}</p>
              <div className={styles.actions}>
                {entry.installed ? (
                  <span className={styles.badge}>{t.installedBadge}</span>
                ) : (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    disabled={busyId === entry.manifest.id}
                    onClick={() => void runAction(entry.manifest.id, () => installPluginRequest(entry.manifest.id))}
                  >
                    {t.install}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
