/** 右侧 Shell 的“终端 / 右栏”控制组。状态归父级 Chrome Controller。 */
import { WorkbenchIcon } from "../shared";
import { ShellHeaderButton } from "./ShellHeaderButton";
import styles from "./RightShellActions.module.css";

export function RightShellActions({ terminalOpen, rightCollapsed, onToggleTerminal, onToggleRight }: {
  terminalOpen: boolean;
  rightCollapsed: boolean;
  onToggleTerminal: () => void;
  onToggleRight: () => void;
}) {
  return (
    <div className={styles.actions} aria-label="工作台面板控制">
      <ShellHeaderButton label="切换底部面板显示" shortcut="Ctrl+J" active={terminalOpen} expanded={terminalOpen} onClick={onToggleTerminal} tooltipAlign="end"><WorkbenchIcon name="terminal" size={16} /></ShellHeaderButton>
      <ShellHeaderButton label="显示/隐藏侧边面板" shortcut="Ctrl+Alt+B" expanded={!rightCollapsed} onClick={onToggleRight} tooltipAlign="end"><WorkbenchIcon name="panelRight" size={16} /></ShellHeaderButton>
    </div>
  );
}
