/**
 * 文件：BottomTerminalRegion.tsx
 * 作用：工作台底部终端完整模块外壳。
 * 负责：终端 Tab、关闭按钮、Host 内容插槽和本模块静态样式。
 * 不负责：PTY、Bottom Dock Resize、terminalOpen 状态所有权。
 */
import { WorkbenchIcon } from "#workbench/shared";
import type { AgentWorkbenchProps } from "#workbench/contracts";
import { IconButton } from "#workbench/shared";
import styles from "../styles/BottomTerminal.module.css";

export function BottomTerminalRegion({ terminal,onClose }:{ terminal:AgentWorkbenchProps["terminal"]; onClose:()=>void }) {
  return <section className={styles.root} data-ui="bottom-terminal"><header className={styles.header}><div className={styles.tab}><WorkbenchIcon name="terminal" size={15}/><strong>终端</strong></div><IconButton type="button" onClick={onClose} aria-label="关闭终端" title="关闭终端"><WorkbenchIcon name="close" size={15}/></IconButton></header><div className={styles.content}>{terminal??<div className={styles.unavailable}>当前宿主没有提供终端后端。</div>}</div></section>;
}
