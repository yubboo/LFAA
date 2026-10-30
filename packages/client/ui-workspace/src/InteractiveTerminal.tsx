/** 功能：为工作区底部提供统一终端管理器入口。作用：不再单独持有 Shell；标签、PTY 和会话状态由 TerminalManagerProvider 共享。关联文件：TaskTerminal.tsx、TerminalManagerProvider.tsx、terminal-controller。 */
import { TerminalManagerDock } from "lfaa-client-ui-sidebar-terminal/src/TerminalManagerProvider.js";
import type { ApplicationId, UserSettings, UserRole } from "lfaa-client-connection/src/api.js";

export function InteractiveTerminal({ appId, sessionId, onClose, onTasks }: { appId: ApplicationId; sessionId: string | null; settings: UserSettings; role: UserRole; onClose: () => void; onTasks: () => void }) {
  return <TerminalManagerDock placement="bottom" appId={appId} sessionId={sessionId} onClose={onClose} onTasks={onTasks} />;
}
