// 会话模式选择与锁定展示：渲染在顶栏标题右侧，由 Host 提供可用预设。
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { IconCheck, IconChevronDown, IconLock, IconSparkles } from "@tabler/icons-react";
import { HoverTip, PopoverCard } from "@lfaa/ui-primitives/client";
import styles from "./Session-Mode.module.css";

interface ModeCatalog {
  presets: Array<{ id: string; name: string; nameEn?: string; description: string; descriptionEn?: string; unavailable?: boolean }>;
  activePreset: string;
}

/** 共享模式目录缓存，避免首屏挂载与会话锁定切换重复请求 /api/plugins。 */
let sharedModeCatalog: ModeCatalog | null = null;
let inflightModeCatalog: Promise<ModeCatalog> | null = null;

function loadModeCatalog(): Promise<ModeCatalog> {
  if (sharedModeCatalog) return Promise.resolve(sharedModeCatalog);
  if (!inflightModeCatalog) {
    inflightModeCatalog = fetch("/api/plugins")
      .then(async (response) => {
        if (!response.ok) throw new Error("模式目录读取失败。");
        const data = (await response.json()) as ModeCatalog;
        sharedModeCatalog = data;
        return data;
      })
      .finally(() => {
        inflightModeCatalog = null;
      });
  }
  return inflightModeCatalog;
}

export function SessionMode({ isZh, selected, locked, busy, compact = false, onSelect }: {
  isZh: boolean;
  selected: string | undefined;
  locked: boolean;
  busy: boolean;
  /** 聊天模式只留一枚图标：模式名收进 aria-label 与悬浮提示，点开仍是完整菜单。 */
  compact?: boolean;
  onSelect: (id: string) => void;
}) {
  const [catalog, setCatalog] = useState<ModeCatalog | null>(sharedModeCatalog);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  useEffect(() => {
    let active = true;
    void loadModeCatalog().then((data) => {
      if (!active) return;
      setCatalog(data);
      setFailed(false);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);

  const label = isZh ? "会话模式" : "Session mode";
  // 早期会话没有记录预设，实际按当时的默认预设运行：展示当前默认预设名，而不是「旧会话」。
  const value = selected ?? catalog?.activePreset ?? "";
  const name = (preset: ModeCatalog["presets"][number]) => isZh ? preset.name : (preset.nameEn ?? preset.name);
  const current = catalog?.presets.find((preset) => preset.id === value);
  const defaultPreset = catalog?.presets.find((preset) => preset.id === catalog.activePreset);
  const lockedHint = isZh ? "会话模式已锁定。新建会话可切换。" : "Mode locked. Start a new chat to change it.";
  const unavailable = isZh ? "模式不可用" : "Mode unavailable";
  const modeName = current
    ? name(current)
    : failed
      ? unavailable
      : defaultPreset
        ? name(defaultPreset)
        : value || label;

  const presets = catalog?.presets ?? [];
  const enabledIndexes = presets.flatMap((preset, index) => preset.unavailable ? [] : [index]);
  const selectedIndex = presets.findIndex((preset) => preset.id === value);
  const disabled = busy || presets.length === 0;

  // 打开时把焦点放到当前模式（不可选时放到第一个可选模式），键盘可直接上下切换。
  const focusIndex = (index: number) => {
    setActiveIndex(index);
    window.requestAnimationFrame(() => optionRefs.current[index]?.focus());
  };

  const move = (delta: number) => {
    if (enabledIndexes.length === 0) return;
    const position = enabledIndexes.indexOf(activeIndex);
    const next = position < 0
      ? (delta > 0 ? 0 : enabledIndexes.length - 1)
      : (position + delta + enabledIndexes.length) % enabledIndexes.length;
    focusIndex(enabledIndexes[next]!);
  };

  const closeMenu = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    focusIndex(selectedIndex >= 0 && !presets[selectedIndex]?.unavailable ? selectedIndex : (enabledIndexes[0] ?? -1));
  };

  const choose = (preset: ModeCatalog["presets"][number]) => {
    if (preset.unavailable) return;
    onSelect(preset.id);
    closeMenu(true);
  };

  const onListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        if (enabledIndexes.length > 0) focusIndex(enabledIndexes[0]!);
        break;
      case "End":
        event.preventDefault();
        if (enabledIndexes.length > 0) focusIndex(enabledIndexes[enabledIndexes.length - 1]!);
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const preset = presets[activeIndex];
        if (preset) choose(preset);
        break;
      }
      case "Escape":
        event.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        closeMenu(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className={styles.root}>
      {locked ? (
        <HoverTip label={`${modeName} · ${lockedHint}`}>
          <span className={styles.locked} data-compact={compact || undefined} aria-label={`${modeName}. ${lockedHint}`}>
            <IconLock size={14} aria-hidden="true" />
            {!compact && <span>{modeName}</span>}
          </span>
        </HoverTip>
      ) : (
        <>
          <HoverTip label={`${label} · ${modeName}`} disabled={open}>
            <button
              ref={triggerRef}
              type="button"
              className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
              data-compact={compact || undefined}
              aria-label={`${label}: ${modeName}`}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={open ? listboxId : undefined}
              disabled={disabled}
              onClick={() => open ? closeMenu(true) : openMenu()}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  openMenu();
                }
              }}
            >
              <IconSparkles className={styles.icon} size={14} aria-hidden="true" />
              {!compact && <span className={styles.triggerLabel}>{modeName}</span>}
              {!compact && <IconChevronDown className={styles.chevron} size={13} aria-hidden="true" data-open={open || undefined} />}
            </button>
          </HoverTip>

          <PopoverCard
            open={open}
            label={label}
            placement="bottom-start"
            className={styles.menu}
            anchorRef={triggerRef}
            onClose={() => setOpen(false)}
          >
            <div id={listboxId} role="listbox" aria-label={label} className={styles.list} onKeyDown={onListKeyDown}>
              {presets.map((preset, index) => {
                const isActive = preset.id === value;
                const isUnavailable = preset.unavailable === true;
                return (
                  <button
                    key={preset.id}
                    ref={(node) => { optionRefs.current[index] = node; }}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    aria-disabled={isUnavailable || undefined}
                    tabIndex={-1}
                    className={`${styles.option} ${isActive ? styles.optionActive : ""}`}
                    data-disabled={isUnavailable || undefined}
                    onClick={() => choose(preset)}
                  >
                    <span className={styles.optionTop}>
                      <span className={styles.optionName}>{name(preset)}</span>
                      {isUnavailable ? (
                        <span className={styles.badge}>{isZh ? "尚未接入" : "Unavailable"}</span>
                      ) : isActive ? (
                        <IconCheck className={styles.check} size={15} aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className={styles.optionDesc}>{isZh ? preset.description : preset.descriptionEn ?? preset.description}</span>
                  </button>
                );
              })}
            </div>
          </PopoverCard>
        </>
      )}
    </div>
  );
}