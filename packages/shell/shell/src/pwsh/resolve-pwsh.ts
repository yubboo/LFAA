// Windows 进程适配，直接启动 PowerShell 或 CMD，并在 PowerShell 使用 UTF-8。
import { access } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";
import type { ShellInvocation } from "../index";

/** 使用已安装的 PowerShell 7，最后回退到系统自带的 Windows PowerShell。 */
export async function resolvePowerShell(command: string): Promise<ShellInvocation> {
  const programFiles = process.env.ProgramFiles;
  const system32 = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
  let file = process.platform === "win32" ? join(system32, "WindowsPowerShell", "v1.0", "powershell.exe") : "pwsh";
  if (process.platform === "win32") {
    const directories = [...(process.env.PATH ?? "").split(delimiter)];
    if (programFiles) directories.unshift(join(programFiles, "PowerShell", "7"));
    for (const folder of directories.filter(isAbsolute)) {
      const candidate = join(folder, "pwsh.exe");
      if (!await access(candidate).then(() => true, () => false)) continue;
      file = candidate;
      break;
    }
  }
  const utf8 = "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding; $ProgressPreference = 'SilentlyContinue'";
  const encoded = Buffer.from(`${utf8}\n${command}`, "utf16le").toString("base64");
  // 经 -Command 使用文本错误流，Base64 仅负责在参数中无损传递脚本。
  const script = `& ([ScriptBlock]::Create([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'))))`;
  return { file, args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-OutputFormat", "Text", "-Command", script] };
}

/** CMD 由明确的系统路径启动，避免使用用户工作目录里的同名程序。 */
export function resolveCmd(command: string): ShellInvocation {
  return { file: join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"),
    args: ["/d", "/s", "/c", `"${command}"`], windowsVerbatimArguments: true };
}
