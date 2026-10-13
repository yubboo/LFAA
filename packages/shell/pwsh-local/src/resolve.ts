/**
 * 功能：解析本机可用的 PowerShell 解释器。
 * 作用：优先选用 PowerShell 7（pwsh.exe）；缺失时回退到系统自带的 Windows PowerShell 5.1（powershell.exe）。
 * 说明：LFAA 运行于 Windows，pwsh 是主 shell；无 pty，故用非交互 -Command 模式。
 * 关联文件：index.ts（拼 argv）。
 */
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

/** 解析结果。 */
export interface PwshResolution {
  /** 可执行体（PATH 中的绝对路径或可被 PATH 解析的裸名）。 */
  exe: string;
  /** pwsh = PowerShell 7+；windows = 系统自带 Windows PowerShell 5.1。 */
  edition: "pwsh" | "windows";
  /** 供日志/界面展示的版本描述。 */
  version: string;
}

/** 在 PATH 中查找指定可执行体。 */
function findOnPath(names: readonly string[]): string | undefined {
  const dirs = (process.env.PATH ?? "").split(delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = join(dir, name);
      try {
        if (existsSync(candidate)) return candidate;
      } catch { /* 忽略无权限目录 */ }
    }
  }
  return undefined;
}

let cached: PwshResolution | undefined;

/** 解析（带缓存）。PowerShell 7 优先，否则回退 Windows PowerShell。 */
export function resolvePwsh(): PwshResolution {
  if (cached !== undefined) return cached;
  const pwsh = findOnPath(["pwsh.exe", "pwsh"]);
  if (pwsh !== undefined) {
    cached = { exe: pwsh, edition: "pwsh", version: "PowerShell 7+" };
    return cached;
  }
  // Windows PowerShell 5.1 随系统自带；用 PATH 中的 powershell.exe（找不到时由 spawn 报 127）。
  cached = { exe: "powershell.exe", edition: "windows", version: "Windows PowerShell 5.1" };
  return cached;
}
