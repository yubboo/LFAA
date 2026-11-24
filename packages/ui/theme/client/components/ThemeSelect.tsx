// 通用外观设置页液态玻璃下拉选择器：复用强调色菜单视觉规范，替代原生浏览器 <select> 弹窗。
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import styles from "./AccentSelect.module.css";

/** 定义外观选择器中提交给设置的值和显示标签。 */
export interface ThemeSelectOption<T extends string> {
  value: T;
  label: string;
}

/** 为外观设置提供共享选项菜单，统一当前选择及其更新回调。 */
export function ThemeSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ThemeSelectOption<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 16 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentOption = options.find((item) => item.value === value) ?? options[0];

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
      const estimatedHeight = Math.min(320, options.length * 38 + 18);
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
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [open, options.length]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{currentOption?.label ?? value}</span>
        <IconChevronDown className={styles.chevron} aria-hidden="true" />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className={styles.menu}
          style={{ top: menuPos.top, right: menuPos.right }}
          role="listbox"
          aria-label={label}
        >
          {options.map((item) => {
            const selected = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                onClick={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                <span className={styles.optionLabel}>{item.label}</span>
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
