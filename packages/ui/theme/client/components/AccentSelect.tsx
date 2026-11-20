// 提供带色点预览与自定义取色器的强调色下拉菜单，使用 Portal 挂载到 body 避免被毛玻璃卡片裁切或偏移。
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { ACCENT_PRESETS, type AccentPresetId } from "../../contract/index";
import type { ThemeLocaleMessages } from "../locales";
import styles from "./AccentSelect.module.css";

/** 选择预设强调色或自定义颜色，把结果交给共享外观存储。 */
export function AccentSelect({
  locale,
  accent,
  customAccent,
  resolvedScheme,
  onSelectAccent,
  onCustomAccentChange,
}: {
  locale: ThemeLocaleMessages;
  accent: AccentPresetId;
  customAccent: string;
  resolvedScheme: "light" | "dark";
  onSelectAccent: (accent: AccentPresetId) => void;
  onCustomAccentChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 16 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isZh = locale.isZh;

  const fallbackPreset = { id: "pink" as const, color: "#E66AA8", labelZh: "粉色", labelEn: "Pink" };
  const currentPreset = ACCENT_PRESETS.find((item) => item.id === accent) ?? fallbackPreset;
  const currentDotColor = accent === "custom"
    ? customAccent
    : accent === "default"
      ? (resolvedScheme === "dark" ? "#E5E7EB" : "#292B26")
      : currentPreset.color;

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node
        && !rootRef.current?.contains(event.target)
        && !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const syncPosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = 320;
      const top = rect.bottom + 6 + estimatedHeight > window.innerHeight
        ? Math.max(12, rect.top - estimatedHeight - 6)
        : rect.bottom + 6;
      setMenuPos({
        top,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    };
    syncPosition();
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      {accent === "custom" && (
        <label className={styles.customPicker} title={customAccent}>
          <input
            type="color"
            value={customAccent}
            aria-label={locale.accentColor}
            onChange={(event) => onCustomAccentChange(event.target.value.toUpperCase())}
          />
          <span>{customAccent}</span>
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={locale.accentColor}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.dot} style={{ background: currentDotColor }} aria-hidden="true" />
        <span>{isZh ? currentPreset.labelZh : currentPreset.labelEn}</span>
        <IconChevronDown className={styles.chevron} aria-hidden="true" />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className={styles.menu}
          style={{ top: menuPos.top, right: menuPos.right }}
          role="listbox"
          aria-label={locale.accentColor}
        >
          {ACCENT_PRESETS.map((item) => {
            const selected = item.id === accent;
            const dotColor = item.id === "custom"
              ? customAccent
              : item.id === "default"
                ? (resolvedScheme === "dark" ? "#E5E7EB" : "#292B26")
                : item.color;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                onClick={() => {
                  onSelectAccent(item.id);
                  setOpen(false);
                }}
              >
                {item.id !== "custom" ? (
                  <span className={styles.dot} style={{ background: dotColor }} aria-hidden="true" />
                ) : (
                  <span className={styles.customSpacer} aria-hidden="true" />
                )}
                <span className={styles.optionLabel}>{isZh ? item.labelZh : item.labelEn}</span>
                {selected && <IconCheck className={styles.check} aria-hidden="true" />}
              </button>
            );
          })}
        </div>,
        rootRef.current?.closest("[data-device]") ?? document.body,
      )}
    </div>
  );
}
