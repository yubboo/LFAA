/**
 * 文件：AnimatedDisclosure.tsx
 * 作用：提供稳定挂载的展开/收起容器，避免 Popover 子面板 mount/unmount 导致 layout flash。
 * 负责：高度/透明度/位移的统一过渡与 reduced-motion 兼容。
 * 不负责：业务状态、定位、z-index、outside-dismiss。
 */
import type { ReactNode } from "react";
import "./animated-disclosure.css";

export interface AnimatedDisclosureProps {
  open: boolean;
  children: ReactNode;
  className?: string;
  ariaHiddenWhenClosed?: boolean;
}

export function AnimatedDisclosure({ open, children, className = "", ariaHiddenWhenClosed = true }: AnimatedDisclosureProps) {
  return (
    <div
      className={`lfaa-animated-disclosure${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      data-open={open ? "true" : "false"}
      aria-hidden={ariaHiddenWhenClosed && !open ? true : undefined}
    >
      <div className="lfaa-animated-disclosure__clip">
        <div className="lfaa-animated-disclosure__content">{children}</div>
      </div>
    </div>
  );
}
