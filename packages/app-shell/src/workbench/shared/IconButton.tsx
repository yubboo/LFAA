/**
 * 文件：shared/IconButton.tsx
 * 作用：Workbench 内多个区域复用的无业务图标按钮 Primitive。
 * 负责：统一按钮盒尺寸、focus/hover 与基础 ARIA 转发。
 * 不负责：任何区域状态、快捷键、Popover、业务动作。
 * 状态归属：无状态。
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
}

export function IconButton({ className = "", children, ...props }: IconButtonProps) {
  return <button {...props} className={`${styles.button}${className ? ` ${className}` : ""}`}>{children}</button>;
}
