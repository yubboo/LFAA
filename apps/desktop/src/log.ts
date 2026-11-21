// 桌面端日志：启动失败、宿主异常与未捕获错误写入 ~/.lfaa/logs/desktop.log，便于用户回传排查。
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** 桌面端日志文件（与业务数据同目录，卸载不会删除 ~/.lfaa）。 */
export const desktopLogPath = join(homedir(), ".lfaa", "logs", "desktop.log");

/** 追加一条带时间戳的日志；写日志失败绝不影响主流程。 */
export function logDesktop(message: string, error?: unknown): void {
  try {
    mkdirSync(join(homedir(), ".lfaa", "logs"), { recursive: true });
    const detail = error === undefined
      ? ""
      : `\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}`;
    appendFileSync(desktopLogPath, `[${new Date().toISOString()}] ${message}${detail}\n`, "utf8");
  } catch {
    // 日志只是辅助手段，不能因为它阻断启动或退出。
  }
}