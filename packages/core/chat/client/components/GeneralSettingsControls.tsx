// 提供设置中心「常规」页复用的分组卡片、条目行、开关与圆角弹出式下拉选择菜单（支持图标、副标题与搜索过滤）。
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";
import styles from "./GeneralSettingsView.module.css";

export interface SettingSelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export function SettingGroupCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.groupSection} aria-label={title}>
      {title && <h2 className={styles.groupTitle}>{title}</h2>}
      <div className={styles.groupCard}>{children}</div>
    </section>
  );
}

export function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowTitle}>{title}</div>
        <div className={styles.rowDesc}>{description}</div>
      </div>
      <div className={styles.rowControl}>{control}</div>
    </div>
  );
}

export function SettingSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${styles.switchTrack} ${checked ? styles.switchChecked : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.switchThumb} aria-hidden="true" />
    </button>
  );
}

export function SettingSelect<T extends string>({
  value,
  label,
  options,
  searchPlaceholder,
  onChange,
}: {
  value: T;
  label: string;
  options: ReadonlyArray<SettingSelectOption<T>>;
  searchPlaceholder?: string;
  onChange: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const active = options.find((item) => item.value === value) ?? options[0];

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (item) =>
        item.label.toLowerCase().includes(q)
        || (item.description?.toLowerCase().includes(q) ?? false)
        || item.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={styles.selectWrap}>
      <button
        type="button"
        className={styles.selectTrigger}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {active?.icon && <span className={styles.optionIcon}>{active.icon}</span>}
        <span>{active?.label ?? value}</span>
        <IconChevronDown size={14} className={styles.chevronIcon} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.selectMenu} role="listbox" aria-label={label}>
          {searchPlaceholder && (
            <div className={styles.menuSearchWrap}>
              <IconSearch size={14} className={styles.menuSearchIcon} aria-hidden="true" />
              <input
                type="text"
                className={styles.menuSearchInput}
                placeholder={searchPlaceholder}
                value={query}
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          )}
          <div className={styles.menuList}>
            {filteredOptions.map((item) => {
              const selected = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`${styles.menuOption} ${selected ? styles.menuOptionActive : ""}`}
                  onClick={() => {
                    setOpen(false);
                    if (item.value !== value) {
                      onChange(item.value);
                    }
                  }}
                >
                  <span className={styles.menuOptionMain}>
                    {item.icon && <span className={styles.optionIcon}>{item.icon}</span>}
                    <span className={styles.menuOptionText}>
                      <span className={styles.menuOptionLabel}>{item.label}</span>
                      {item.description && <span className={styles.menuOptionDesc}>{item.description}</span>}
                    </span>
                  </span>
                  {selected && <IconCheck size={15} className={styles.checkIcon} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
