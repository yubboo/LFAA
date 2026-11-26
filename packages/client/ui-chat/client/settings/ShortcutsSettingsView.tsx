// 设置中心「键盘快捷键」页：列出所有已注册的真实动作，支持搜索、录制改键、清除与恢复默认，并提示冲突。
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  SettingGroup,
  SettingRow,
  SettingsPage,
} from "@lfaa/ui-primitives/client";
import {
  findShortcutConflict,
  formatShortcutKeys,
  normalizeShortcutEvent,
  type WorkbenchClientService,
  type WorkbenchShortcutBinding,
} from "@lfaa/ui-layout/client";
import type { ChatLocaleMessages } from "../locales";
import styles from "./ShortcutsSettingsView.module.css";

/** 快捷键分组顺序与标题；只展示当前真正注册了的动作。 */
const GROUP_TITLES = {
  global: { zh: "全局", en: "Global" },
  navigation: { zh: "导航", en: "Navigation" },
  session: { zh: "会话", en: "Chats" },
  workbench: { zh: "右侧工作台", en: "Right workbench" },
} as const;

const GROUP_ORDER = ["global", "navigation", "session", "workbench"] as const;

/** 单行键位控件：点一下进入录制，Esc 取消，Backspace 清除，重复键位就地提示。 */
function ShortcutKeyControl({
  isZh,
  binding,
  recording,
  onToggleRecord,
  onClear,
  onReset,
}: {
  isZh: boolean;
  binding: WorkbenchShortcutBinding;
  recording: boolean;
  onToggleRecord: () => void;
  onClear: () => void;
  onReset: () => void;
}) {
  const changed = binding.keys !== binding.defaultKeys;
  return (
    <div className={styles.keyControl}>
      <button
        type="button"
        className={`${styles.keyChip} ${recording ? styles.keyChipRecording : ""} ${binding.keys ? "" : styles.keyChipEmpty}`}
        aria-label={
          recording
            ? (isZh ? "正在录制快捷键，按 Esc 取消" : "Recording shortcut, press Esc to cancel")
            : (isZh ? `修改「${binding.title.zh}」快捷键` : `Change shortcut for “${binding.title.en}”`)
        }
        aria-pressed={recording}
        onClick={onToggleRecord}
      >
        {recording
          ? (isZh ? "按下组合键…" : "Press keys…")
          : binding.keys
            ? formatShortcutKeys(binding.keys)
            : (isZh ? "未分配" : "Not set")}
      </button>
      {binding.keys && (
        <button type="button" className={styles.iconAction} title={isZh ? "清除快捷键" : "Clear shortcut"} aria-label={isZh ? "清除快捷键" : "Clear shortcut"} onClick={onClear}>
          ×
        </button>
      )}
      {changed && (
        <button type="button" className={styles.textAction} onClick={onReset}>
          {isZh ? "恢复默认" : "Reset"}
        </button>
      )}
    </div>
  );
}

/** 键盘快捷键设置页；动作来自工作台注册表，没有注册的功能不会出现在这里。 */
export function ShortcutsSettingsView({
  locale,
  workbench,
}: {
  locale: ChatLocaleMessages;
  workbench: WorkbenchClientService;
}) {
  const snapshot = useSyncExternalStore(workbench.subscribe, workbench.getSnapshot, workbench.getSnapshot);
  const isZh = locale.isZh;
  const [query, setQuery] = useState("");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState("");

  const bindings = snapshot.shortcuts;
  const normalized = query.trim().toLowerCase();
  const visible = bindings.filter((item) => {
    if (!normalized) return true;
    const text = [item.title.zh, item.title.en, item.description.zh, item.description.en, item.keys ?? ""]
      .join(" ")
      .toLowerCase();
    return text.includes(normalized);
  });

  // 录制期间在捕获阶段吃掉按键，避免同一次组合键又触发全局动作或写入输入框。
  useEffect(() => {
    if (!recordingId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecordingId(null);
        setConflict("");
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        workbench.setShortcutKeys(recordingId, null);
        setRecordingId(null);
        setConflict("");
        return;
      }
      const keys = normalizeShortcutEvent(event);
      if (!keys) return;
      const hit = findShortcutConflict(bindings, keys, recordingId);
      if (hit) {
        setConflict(isZh ? `与「${hit.title.zh}」相同，请换一个组合` : `Already used by “${hit.title.en}”`);
        return;
      }
      workbench.setShortcutKeys(recordingId, keys);
      setRecordingId(null);
      setConflict("");
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [bindings, isZh, recordingId, workbench]);

  // 菜单等其它入口展示的键位必须与设置页一致；这里顺带清理已不存在的录制目标。
  useEffect(() => {
    if (recordingId && !bindings.some((item) => item.id === recordingId)) setRecordingId(null);
  }, [bindings, recordingId]);

  return (
    <SettingsPage
      title={isZh ? "键盘快捷键" : "Keyboard shortcuts"}
      description={isZh ? "查看并修改已接入功能的快捷键。" : "View and change shortcuts for features that are wired up."}
      actions={(
        <button
          type="button"
          className={styles.resetAll}
          onClick={() => {
            setRecordingId(null);
            setConflict("");
            for (const item of bindings) workbench.resetShortcutKeys(item.id);
          }}
        >
          {isZh ? "全部恢复默认" : "Reset all"}
        </button>
      )}
    >
      <div className={styles.searchWrap}>
        <input
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={isZh ? "搜索快捷键或功能" : "Search shortcuts"}
          aria-label={isZh ? "搜索快捷键" : "Search shortcuts"}
        />
      </div>
      {conflict && <div className={styles.conflict} role="status">{conflict}</div>}
      {GROUP_ORDER.map((group) => {
        const items = visible.filter((item) => item.group === group);
        if (items.length === 0) return null;
        const title = GROUP_TITLES[group];
        return (
          <SettingGroup key={group} title={isZh ? title.zh : title.en}>
            {items.map((item) => (
              <SettingRow
                key={item.id}
                title={isZh ? item.title.zh : item.title.en}
                description={isZh ? item.description.zh : item.description.en}
                control={(
                  <ShortcutKeyControl
                    isZh={isZh}
                    binding={item}
                    recording={recordingId === item.id}
                    onToggleRecord={() => {
                      setConflict("");
                      setRecordingId(recordingId === item.id ? null : item.id);
                    }}
                    onClear={() => workbench.setShortcutKeys(item.id, null)}
                    onReset={() => workbench.resetShortcutKeys(item.id)}
                  />
                )}
              />
            ))}
          </SettingGroup>
        );
      })}
      {visible.length === 0 && (
        <p className={styles.empty}>{isZh ? "没有匹配的快捷键。" : "No matching shortcuts."}</p>
      )}
      <p className={styles.hint}>
        {isZh
          ? "单击键位开始录制；Esc 取消，Backspace 清除。设置页里的行只对应当前已接入的真实功能；右侧工作台收起时，标签类快捷键随标签栏一起暂不可用。"
          : "Click a key to record. Esc cancels, Backspace clears. Rows exist only for features that are actually wired up; tab shortcuts are unavailable while the right workbench is collapsed."}
      </p>
    </SettingsPage>
  );
}