// 基于 @base-ui/react/tabs 封装的平滑滑块分段标签原语。
import type { ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import styles from "./BasePrimitives.module.css";

export interface UiTabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean | undefined;
}

export interface UiTabsProps {
  value: string;
  items: UiTabItem[];
  onValueChange: (value: string) => void;
  ariaLabel?: string | undefined;
}

export function UiTabs({ value, items, onValueChange, ariaLabel }: UiTabsProps) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
    >
      <Tabs.List className={styles.tabsList} aria-label={ariaLabel}>
        {items.map((item) => (
          <Tabs.Tab
            key={item.value}
            value={item.value}
            disabled={item.disabled === true}
            className={styles.tabBtn}
          >
            {item.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className={styles.tabIndicator} />
      </Tabs.List>
    </Tabs.Root>
  );
}
