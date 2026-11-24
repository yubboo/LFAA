// 基于 @base-ui/react/tooltip 封装的轻量悬浮提示原语：自动避障定位与悬停防抖。
import type { ReactElement, ReactNode } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import styles from "./BasePrimitives.module.css";

export interface UiTooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right" | undefined;
  delay?: number | undefined;
}

export function UiTooltip({ content, children, side = "top", delay = 320 }: UiTooltipProps) {
  return (
    <Tooltip.Provider delay={delay}>
      <Tooltip.Root>
        <Tooltip.Trigger render={children} />
        <Tooltip.Portal>
          <Tooltip.Positioner className={styles.positioner} side={side} sideOffset={6}>
            <Tooltip.Popup className={styles.tooltipPopup}>{content}</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
