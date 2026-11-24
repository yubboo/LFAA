// 基于 @base-ui/react/menu 封装的通用下拉菜单原语：自动防溢出定位、键盘导航、焦点恢复与双主题适配。
import type { ReactElement, ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { IconCheck } from "@tabler/icons-react";
import styles from "./BasePrimitives.module.css";

export interface DropdownMenuProps {
  /** 触发按钮（通过 Base UI render prop 无缝透传属性，不额外套一层 button）。 */
  trigger: ReactElement;
  children: ReactNode;
  align?: "start" | "center" | "end" | undefined;
  side?: "top" | "bottom" | "left" | "right" | undefined;
  sideOffset?: number | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}

export function DropdownMenu({
  trigger,
  children,
  align = "end",
  side = "bottom",
  sideOffset = 6,
  open,
  onOpenChange,
}: DropdownMenuProps) {
  return (
    <Menu.Root
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} align={align} side={side} sideOffset={sideOffset}>
          <Menu.Popup className={styles.popup}>{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function DropdownMenuItem({
  icon,
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  icon?: ReactNode | undefined;
  label: ReactNode;
  danger?: boolean | undefined;
  disabled?: boolean | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <Menu.Item
      className={`${styles.menuItem} ${danger ? styles.menuItemDanger : ""}`}
      disabled={disabled}
      {...(onClick ? { onClick } : {})}
    >
      {icon}
      <span className={styles.menuItemLabel}>{label}</span>
    </Menu.Item>
  );
}

export function DropdownMenuCheckboxItem({
  icon,
  label,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  icon?: ReactNode | undefined;
  label: ReactNode;
  checked: boolean;
  disabled?: boolean | undefined;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Menu.CheckboxItem
      className={styles.menuItem}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    >
      {icon}
      <span className={styles.menuItemLabel}>{label}</span>
      <Menu.CheckboxItemIndicator className={styles.menuItemCheck}>
        <IconCheck size={13} aria-hidden="true" />
      </Menu.CheckboxItemIndicator>
    </Menu.CheckboxItem>
  );
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className={styles.menuSeparator} />;
}
