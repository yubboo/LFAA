// Bash 本地执行入口，区分原生 Bash、Git Bash 和选择的 WSL 路由。
import { access } from "node:fs/promises";
import { basename, delimiter, isAbsolute, join } from "node:path";
import type { ShellInvocation } from "../index";

export async function resolveBash(command: string, cwd: string, mode: "native" | "git_bash" | "wsl"): Promise<ShellInvocation> {
  if (mode === "wsl") {
    if (process.platform !== "win32") throw new Error("WSL 仅在 Windows Host 上可用。");
    const file = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "wsl.exe");
    return { file, args: ["--cd", cwd, "--exec", "bash", "-c", command] };
  }
  if (mode === "git_bash" && process.platform === "win32") {
    const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]];
    for (const root of roots) {
      if (!root) continue;
      const gitBash = join(root, "Git", "bin", "bash.exe");
      if (await access(gitBash).then(() => true, () => false)) return { file: gitBash, args: ["-c", command] };
    }
    for (const folder of (process.env.PATH ?? "").split(delimiter).filter(isAbsolute)) {
      if (!/^(cmd|bin)$/iu.test(basename(folder))) continue;
      if (!await access(join(folder, "git.exe")).then(() => true, () => false)) continue;
      const gitBash = join(folder, "..", "bin", "bash.exe");
      if (await access(gitBash).then(() => true, () => false)) return { file: gitBash, args: ["-c", command] };
    }
    throw new Error("未找到 Git Bash。请将 Git for Windows 加入 PATH。");
  }
  return { file: "bash", args: ["-c", command] };
}
