// 设置中心「内置插件」页：只读清单，按当前预设拆会话插件与全局插件，支持搜索与逐卡展开。
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconChevronDown, IconRefresh, IconSearch } from "@tabler/icons-react";
import { SettingsPage } from "@lfaa/ui-primitives/client";
import type { PluginInventorySnapshot } from "@lfaa/plugins/contract";
import { fetchPluginInventory, toggleBuiltinRequest } from "../api/plugins-client";
import { InventoryCard } from "./Inventory-Card";
import { inventoryMessages } from "./locales";
import styles from "./Plugin-Inventory.module.css";

type ViewState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; snapshot: PluginInventorySnapshot };

/** 内置插件只读页；写操作仍留在插件中心，这里只呈现 Loader 的真实状态。 */
export function PluginInventoryView({ isZh }: { isZh: boolean }) {
  const t = inventoryMessages[isZh ? "zh" : "en"];
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chosenPreset, setChosenPreset] = useState<string | null>(null);
  const [globalOpen, setGlobalOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", snapshot: await fetchPluginInventory() });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 启停内置插件：Host 返回新快照，直接替换当前视图。 */
  const setEnabled = useCallback(async (moduleName: string, enabled: boolean) => {
    setToggling(moduleName);
    setToggleError(null);
    try {
      setState({ status: "ready", snapshot: await toggleBuiltinRequest(moduleName, enabled) });
    } catch {
      setToggleError(t.toggleFailed);
    } finally {
      setToggling(null);
    }
  }, [t.toggleFailed]);

  const snapshot = state.status === "ready" ? state.snapshot : undefined;
  const presets = snapshot?.presets ?? [];
  const selected = presets.find((preset) => preset.id === chosenPreset)
    ?? presets.find((preset) => preset.id === snapshot?.activePreset)
    ?? presets[0];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searching = normalizedQuery.length > 0;

  const matches = useCallback((entry: PluginInventorySnapshot["entries"][number]) => {
    if (!searching) return true;
    const title = entry.meta.title[isZh ? "zh" : "en"];
    const description = entry.meta.description[isZh ? "zh" : "en"];
    return [entry.moduleName, entry.entryId, title, description]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  }, [isZh, normalizedQuery, searching]);

  const { sessionEntries, globalEntries } = useMemo(() => {
    const modules = new Set(selected?.modules ?? []);
    const all = (snapshot?.entries ?? []).filter(matches);
    return {
      sessionEntries: all.filter((entry) => modules.has(entry.moduleName)),
      globalEntries: all.filter((entry) => !modules.has(entry.moduleName)),
    };
  }, [matches, selected, snapshot]);

  const toggle = (entryId: string) => setExpanded((current) => (current === entryId ? null : entryId));
  const presetName = (preset: { name: string; nameEn: string }) => (isZh ? preset.name : preset.nameEn);

  // 搜索时两段都展开，避免命中结果藏在折叠区里。
  const sessionOpen = true;
  const globalExpanded = searching || globalOpen;
  const nothingMatches = searching && sessionEntries.length === 0 && globalEntries.length === 0;

  return (
    <SettingsPage title={t.title} description={t.description} size="wide">
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <IconSearch size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={t.search}
            aria-label={t.search}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <button type="button" className={styles.iconButton} onClick={() => void load()} aria-label={t.retry}>
          <IconRefresh size={14} aria-hidden="true" />
        </button>
      </div>

      {state.status === "loading" && <p className={styles.status} role="status">{t.reading}</p>}
      {state.status === "error" && (
        <p className={styles.status} role="alert">
          {t.loadError}
          <button type="button" className={styles.linkButton} onClick={() => void load()}>{t.retry}</button>
        </p>
      )}
      {toggleError && <p className={styles.status} role="alert">{toggleError}</p>}

      {snapshot && (
        <div className={styles.catalog}>
          {presets.length === 0 && snapshot.entries.length === 0 && <p className={styles.status}>{t.empty}</p>}
          {nothingMatches && <p className={styles.status}>{t.emptySearch}</p>}

          {selected && (
            <section className={styles.group} data-scope="preset">
              <header className={styles.groupHeader}>
                <h2 className={styles.groupTitle}>{t.sessionSection}</h2>
                <label className={styles.presetPicker}>
                  <span className={styles.visuallyHidden}>{t.modeLabel}</span>
                  <select
                    value={selected.id}
                    onChange={(event) => setChosenPreset(event.currentTarget.value)}
                  >
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id} disabled={preset.unavailable}>
                        {presetName(preset)}
                      </option>
                    ))}
                  </select>
                </label>
              </header>
              <p className={styles.groupSub}>{t.sessionSubtitle}</p>
              {sessionOpen && sessionEntries.length > 0 && (
                <ul className={styles.grid}>
                  {sessionEntries.map((entry) => (
                    <InventoryCard
                      key={`s-${entry.entryId}`}
                      entry={entry}
                      t={t}
                      isZh={isZh}
                      fromPreset={presetName(selected)}
                      open={expanded === `s-${entry.entryId}`}
                      onToggle={() => toggle(`s-${entry.entryId}`)}
                      {...(entry.provided ? {} : {
                        onSetEnabled: (enabled: boolean) => void setEnabled(entry.moduleName, enabled),
                        busy: toggling === entry.moduleName,
                      })}
                    />
                  ))}
                </ul>
              )}
              {sessionOpen && sessionEntries.length === 0 && !nothingMatches && !searching && (
                <p className={styles.status}>{t.empty}</p>
              )}
            </section>
          )}

          {snapshot.entries.length > 0 && (
            <section className={styles.group} data-scope="global">
              <header className={styles.groupHeader}>
                <button
                  type="button"
                  className={styles.groupToggle}
                  aria-expanded={globalExpanded}
                  onClick={() => setGlobalOpen(!globalExpanded)}
                >
                  <IconChevronDown className={styles.groupChevron} size={13} aria-hidden="true" />
                  <h2 className={styles.groupTitle}>{t.globalSection}</h2>
                </button>
              </header>
              <p className={styles.groupSub}>{t.globalSubtitle}</p>
              {globalExpanded && globalEntries.length > 0 && (
                <ul className={styles.grid}>
                  {globalEntries.map((entry) => (
                    <InventoryCard
                      key={`g-${entry.entryId}`}
                      entry={entry}
                      t={t}
                      isZh={isZh}
                      open={expanded === `g-${entry.entryId}`}
                      onToggle={() => toggle(`g-${entry.entryId}`)}
                      {...(entry.provided ? {} : {
                        onSetEnabled: (enabled: boolean) => void setEnabled(entry.moduleName, enabled),
                        busy: toggling === entry.moduleName,
                      })}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </SettingsPage>
  );
}