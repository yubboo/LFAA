// 基于 @base-ui/react/context-menu 封装的通用右键菜单原语：在指针位置或长按处展开，复用下拉菜单的双主题皮肤与条目。
import type { ReactElement, ReactNode } from "react";
import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import styles from "./BasePrimitives.module.css";

// 右键菜单与下拉菜单共用同一套条目与分隔线：两者都建立在 Base UI Menu 的根上下文上。
export { DropdownMenuItem as ContextMenuItem, DropdownMenuSeparator as ContextMenuSeparator } from "./DropdownMenu";

export interface ContextMenuProps {
  /** 接收右键/长按的元素；属性通过 Base UI render prop 合并，不再额外包一层触发按钮。 */
  trigger: ReactElement;
  children: ReactNode;
}

/** 右键菜单外壳：负责定位、Portal、焦点恢复与防溢出；条目直接复用 DropdownMenuItem。 */
export function ContextMenu({ trigger, children }: ContextMenuProps) {
  return (
    <BaseContextMenu.Root>
      <BaseContextMenu.Trigger render={trigger} />
      <BaseContextMenu.Portal>
        <BaseContextMenu.Positioner className={styles.positioner}>
          <BaseContextMenu.Popup className={`${styles.popup} ${styles.contextMenuPopup}`}>{children}</BaseContextMenu.Popup>
        </BaseContextMenu.Positioner>
      </BaseContextMenu.Portal>
    </BaseContextMenu.Root>
  );
}