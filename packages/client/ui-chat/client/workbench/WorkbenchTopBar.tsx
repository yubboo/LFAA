// 右栏工作台顶栏：标签区与动作组装进左二栏、中间区同款胶囊，外观只由 @lfaa/ui-primitives 的 CapsuleBar 定义。
// 拆成独立组件是因为主壳体已接近 400 行硬上限，顶栏本身与主舞台、终端条没有耦合。
import type { ComponentProps } from "react";
import { CapsuleBar } from "@lfaa/ui-primitives/client";
import { RightWorkbenchActions } from "./RightWorkbenchActions";
import { WorkbenchTabs } from "./WorkbenchTabs";
import styles from "./RightWorkbenchPane.module.css";

/** 组装「标签栏 + 右侧动作组」，两者都由调用方传入完整属性，这里只管胶囊外壳与分区。 */
export function WorkbenchTopBar({
  tabProps,
  actionProps,
}: {
  tabProps: ComponentProps<typeof WorkbenchTabs>;
  actionProps: ComponentProps<typeof RightWorkbenchActions>;
}) {
  return (
    <header className={styles.topHeader}>
      <CapsuleBar className={styles.headerCapsule}>
        <WorkbenchTabs {...tabProps} />
        <RightWorkbenchActions {...actionProps} />
      </CapsuleBar>
    </header>
  );
}