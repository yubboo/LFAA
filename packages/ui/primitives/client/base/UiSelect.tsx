// 基于 @base-ui/react/select 封装的通用下拉选择器：键盘导航、防溢出定位与双主题皮肤。
import { Select } from "@base-ui/react/select";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import styles from "./BasePrimitives.module.css";

export interface UiSelectOption {
  value: string;
  label: string;
  disabled?: boolean | undefined;
}

export interface UiSelectProps {
  value: string;
  options: UiSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string | undefined;
  ariaLabel?: string | undefined;
  disabled?: boolean | undefined;
}

export function UiSelect({
  value,
  options,
  onValueChange,
  placeholder,
  ariaLabel,
  disabled = false,
}: UiSelectProps) {
  const current = options.find((item) => item.value === value);
  return (
    <Select.Root
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
    >
      <Select.Trigger className={styles.selectTrigger} aria-label={ariaLabel}>
        <Select.Value>{current?.label ?? placeholder ?? value}</Select.Value>
        <IconChevronDown size={13} aria-hidden="true" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className={styles.positioner} sideOffset={5}>
          <Select.Popup className={`${styles.popup} ${styles.selectPopup}`}>
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled === true}
                className={styles.menuItem}
              >
                <span className={styles.menuItemLabel}>{opt.label}</span>
                <Select.ItemIndicator className={styles.menuItemCheck}>
                  <IconCheck size={13} aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
