// 本机官方 CLI 代理探测器：跨平台定位可执行文件、读取版本号并只读判定系统默认登录态。
// 关联：packages/host/web-server/src/cli-agents/catalog.ts；运行环境：Node Host。
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { CLI_AGENT_CATALOG, type CliAgentDefinition, type CliAgentDetection } from "./catalog";

const execFileAsync = promisify(execFile);
const PROBE_TIMEOUT_MS = 3_000;

/** 查找可执行文件在系统 PATH 中的真实路径；Windows 优先 .cmd/.exe。 */
async function locateBinary(name: string): Promise<string | null> {
  const cmd = process.platform === "win32" ? "where.exe" : "which";
  try {
    const { stdout } = await execFileAsync(cmd, [name], {
      timeout: PROBE_TIMEOUT_MS,
      windowsHide: true,
    });
    const candidates = stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
    if (candidates.length === 0) return null;
    if (process.platform === "win32") {
      const preferred = candidates.find((p) => /\.(?:exe|cmd|bat)$/iu.test(p));
      return preferred ?? candidates[0] ?? null;
    }
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

/** 读取 CLI 版本号（仅取首行可读版本串，超时或报错静默返回 null）。 */
async function probeVersion(binaryPath: string): Promise<string | null> {
  try {
    const isWinScript = process.platform === "win32" && /\.(?:cmd|bat)$/iu.test(binaryPath);
    const { stdout, stderr } = isWinScript
      ? await execFileAsync("cmd.exe", ["/d", "/s", "/c", `"${binaryPath}" --version`], {
          timeout: PROBE_TIMEOUT_MS,
          windowsHide: true,
        })
      : await execFileAsync(binaryPath, ["--version"], {
          timeout: PROBE_TIMEOUT_MS,
          windowsHide: true,
        });
    const combined = `${stdout}\n${stderr}`.trim();
    const firstLine = combined.split(/\r?\n/u).map((l) => l.trim()).find(Boolean) ?? "";
    return firstLine ? firstLine.slice(0, 64) : null;
  } catch {
    return null;
  }
}

/** 只读判定系统默认登录凭证是否存在（不读取或解析任何敏感 token）。 */
function detectSystemLogin(agentId: string): boolean {
  const home = homedir();
  switch (agentId) {
    case "codex":
      return existsSync(join(home, ".codex", "auth.json")) || existsSync(join(home, ".codex", "config.toml"));
    case "claude":
      return existsSync(join(home, ".claude", ".credentials.json"))
        || existsSync(join(home, ".claude.json"))
        || existsSync(join(home, ".claude", "settings.json"));
    case "agy":
      return existsSync(join(home, ".gemini", "antigravity"))
        || existsSync(join(home, ".config", "antigravity"));
    case "grok":
      return existsSync(join(home, ".grok", "auth.json"));
    case "cursor-agent":
      return existsSync(join(home, ".cursor"));
    default:
      return false;
  }
}

export async function detectSingleCliAgent(def: CliAgentDefinition): Promise<CliAgentDetection> {
  const names = [def.binary, ...(def.aliases ?? [])];
  let binaryPath: string | null = null;
  for (const name of names) {
    binaryPath = await locateBinary(name);
    if (binaryPath) break;
  }
  const version = binaryPath ? await probeVersion(binaryPath) : null;
  return {
    installed: Boolean(binaryPath),
    binaryPath,
    version,
    systemLoginDetected: detectSystemLogin(def.id),
    checkedAt: Date.now(),
  };
}

export async function detectAllCliAgents(): Promise<Record<string, CliAgentDetection>> {
  const entries = await Promise.all(
    CLI_AGENT_CATALOG.map(async (def) => [def.id, await detectSingleCliAgent(def)] as const),
  );
  return Object.fromEntries(entries);
}
