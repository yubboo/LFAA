// 舞台主体布局：把 RightWorkbenchPane 里「分割区 + 最右图标轨 + 底部终端坞」这段 JSX 整体搬出，
// 舞台容器只保留 stageProps 的对象组装，不再同时持有这块四十余个 props 的排版结构。
import type { ComponentProps, ReactNode, RefObject } from "react";
import { WorkbenchStageContent } from "../WorkbenchStageContent";
import styles from "../RightWorkbenchPane.module.css";

/** 舞台主体需要的布局输入：内容 props 由舞台容器组装，图标轨与终端坞只负责排版。 */
export interface PaneStageProps {
  /** 分割区容器引用：辅助栏拖拽与方向键调宽都要量它的宽度。 */
  splitAreaRef: RefObject<HTMLDivElement | null>;
  stageProps: ComponentProps<typeof WorkbenchStageContent>;
  /** 最右图标轨：动作入口与辅助栏开关。 */
  rail: ReactNode;
  /** 底部终端坞；未注册工作台服务时为 null。 */
  dock: ReactNode;
}

/** 舞台主体：内容与图标轨横向分割，终端坞挂在分割区之外，保持原布局层级。 */
export function PaneStage({ splitAreaRef, stageProps, rail, dock }: PaneStageProps) {
  return (
    <>
      <div ref={splitAreaRef} className={styles.bodySplit}>
        <WorkbenchStageContent {...stageProps} />
        {rail}
      </div>
      {dock}
    </>
  );
}