// 外观页顶部的「预设 / 高级设置」选项卡：受控组件，支持左右方向键与 Home/End 在两项间切换。
import { useRef, type KeyboardEvent } from "react";
import styles from "./AppearanceSettings.module.css";

/** 外观页的两个分区标识，同时用于选项卡与面板的 DOM id。 */
export type AppearanceTabId = "presets" | "advanced";

/** 渲染外观页分区选项卡；选中状态与切换结果由调用方持有。 */
export function AppearanceTabs({
  value,
  label,
  items,
  onChange,
}: {
  value: AppearanceTabId;
  label: string;
  items: ReadonlyArray<{ id: AppearanceTabId; label: string }>;
  onChange: (next: AppearanceTabId) => void;
}) {
  const refs = useRef<Partial<Record<AppearanceTabId, HTMLButtonElement | null>>>({});
  const order = items.map((item) => item.id);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = Math.max(0, order.indexOf(value));
    const pick = (offset: number): AppearanceTabId | null => {
      const target = order[(index + offset + order.length) % order.length];
      return target ?? null;
    };
    let next: AppearanceTabId | null = null;
    if (event.key === "ArrowRight") next = pick(1);
    else if (event.key === "ArrowLeft") next = pick(-1);
    else if (event.key === "Home") next = order[0] ?? null;
    else if (event.key === "End") next = order[order.length - 1] ?? null;
    if (!next) return;
    event.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div className={styles.tabBar} role="tablist" aria-label={label}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(element) => {
              refs.current[item.id] = element;
            }}
            type="button"
            role="tab"
            id={`appearance-tab-${item.id}`}
            aria-selected={active}
            aria-controls={`appearance-panel-${item.id}`}
            tabIndex={active ? 0 : -1}
            className={`${styles.tabBtn} ${active ? styles.tabBtnActive : ""}`}
            onClick={() => onChange(item.id)}
            onKeyDown={handleKeyDown}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}