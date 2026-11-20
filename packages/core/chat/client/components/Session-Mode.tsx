// 输入栏的会话模式选择与锁定展示，由 Host 提供可用预设。
import { useEffect, useState } from "react";
import { IconLock, IconSparkles } from "@tabler/icons-react";
import styles from "./Session-Mode.module.css";

interface ModeCatalog {
  presets: Array<{ id: string; name: string; nameEn?: string; description: string; descriptionEn?: string; unavailable?: boolean }>;
  activePreset: string;
}

export function SessionMode({ isZh, selected, locked, busy, onSelect }: {
  isZh: boolean;
  selected: string | undefined;
  locked: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
}) {
  const [catalog, setCatalog] = useState<ModeCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/plugins", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("模式目录读取失败。");
      setCatalog(await response.json() as ModeCatalog);
      setFailed(false);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [locked]);

  const label = isZh ? "会话模式" : "Session mode";
  const value = selected ?? (locked ? "" : catalog?.activePreset ?? "");
  const name = (preset: ModeCatalog["presets"][number]) => isZh ? preset.name : (preset.nameEn ?? preset.name);
  const current = catalog?.presets.find((preset) => preset.id === value);
  const lockedHint = isZh ? "会话模式已锁定。新建会话可切换。" : "Mode locked. Start a new chat to change it.";
  const unavailable = isZh ? "模式不可用" : "Mode unavailable";
  const modeName = current ? name(current) : value || (isZh ? "旧会话" : "Legacy chat");

  return (
    <div className={styles.root}>
      {locked ? (
        <span className={styles.locked} title={lockedHint} aria-label={`${modeName}. ${lockedHint}`}>
          <IconLock size={14} aria-hidden="true" />
          <span>{modeName}</span>
        </span>
      ) : (
        <>
          <IconSparkles className={styles.icon} size={14} aria-hidden="true" />
          <select
            className={styles.select}
            aria-label={label}
            title={current ? (isZh ? current.description : current.descriptionEn ?? current.description) : label}
            value={value}
            disabled={busy || !catalog?.presets.length}
            onChange={(event) => onSelect(event.target.value)}
          >
            {!current && <option value={value} disabled>{failed ? unavailable : value || label}</option>}
            {catalog?.presets.map((preset) => (
              <option key={preset.id} value={preset.id} disabled={preset.unavailable}>
                {name(preset)}{preset.unavailable ? (isZh ? " · 尚未接入" : " · Unavailable") : ""}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
