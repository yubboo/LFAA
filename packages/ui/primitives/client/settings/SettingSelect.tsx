// 设置中心「可搜索下拉」与「多选下拉」：带图标、副标题与搜索过滤的受控选项弹层，供所有设置页统一使用。
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";
import styles from "./SettingsSelect.module.css";

/** 描述下拉菜单可显示和选中的一个值。 */
export interface SettingSelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

/** 弹层打开期间监听外部点击与 Esc，关闭时清空搜索词。 */
function useMenuDismiss(
  open: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
  resetQuery: () => void,
) {
  // 回调放进 ref：只在打开/关闭时绑定监听，搜索输入引起的重渲染不会重复绑定。
  const handlersRef = useRef({ onClose, resetQuery });
  handlersRef.current = { onClose, resetQuery };

  useEffect(() => {
    if (!open) {
      handlersRef.current.resetQuery();
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handlersRef.current.onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        handlersRef.current.onClose();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [containerRef, open]);
}

/** 按关键字过滤选项：命中标签、说明或原始值。 */
function filterOptions<T extends string>(
  options: ReadonlyArray<SettingSelectOption<T>>,
  query: string,
): ReadonlyArray<SettingSelectOption<T>> {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (item) =>
      item.label.toLowerCase().includes(q)
      || (item.description?.toLowerCase().includes(q) ?? false)
      || item.value.toLowerCase().includes(q),
  );
}

/** 为可枚举的设置项提供搜索和选项弹层，通过值回调更新当前选项。 */
export function SettingSelect<T extends string>({
  value,
  label,
  options,
  searchPlaceholder,
  emptyText,
  onChange,
}: {
  value: T;
  label: string;
  options: ReadonlyArray<SettingSelectOption<T>>;
  searchPlaceholder?: string;
  emptyText?: string;
  onChange: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const resetQuery = () => setQuery("");
  useMenuDismiss(open, containerRef, close, resetQuery);

  const active = options.find((item) => item.value === value) ?? options[0];
  const filteredOptions = useMemo(() => filterOptions(options, query), [options, query]);

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
        <span className={styles.selectValue}>{active?.label ?? value}</span>
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
            {filteredOptions.length === 0 && <p className={styles.menuEmpty}>{emptyText ?? ""}</p>}
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
                    if (item.value !== value) onChange(item.value);
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

/** 多选版本：用于"可勾选若干项"的枚举设置，触发按钮显示已选数量。 */
export function SettingMultiSelect<T extends string>({
  values,
  label,
  options,
  summary,
  onChange,
}: {
  values: ReadonlyArray<T>;
  label: string;
  options: ReadonlyArray<SettingSelectOption<T>>;
  /** 触发按钮上的文案，通常是"已选择 N 个"。 */
  summary: string;
  onChange: (next: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const noop = () => {};
  useMenuDismiss(open, containerRef, close, noop);

  const toggle = (item: T) => {
    onChange(values.includes(item) ? values.filter((value) => value !== item) : [...values, item]);
  };

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
        <span className={styles.selectValue}>{summary}</span>
        <IconChevronDown size={14} className={styles.chevronIcon} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.selectMenu} role="group" aria-label={label}>
          <div className={styles.menuList}>
            {options.map((item) => {
              const checked = values.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  className={`${styles.menuOption} ${checked ? styles.menuOptionActive : ""}`}
                  onClick={() => toggle(item.value)}
                >
                  <span className={styles.menuOptionMain}>
                    <span className={styles.menuOptionText}>
                      <span className={styles.menuOptionLabel}>{item.label}</span>
                    </span>
                  </span>
                  {checked && <IconCheck size={15} className={styles.checkIcon} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}