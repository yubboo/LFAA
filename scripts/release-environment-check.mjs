/**
 * 文件：release-environment-check.mjs
 * 作用：验证正式发布所需的 Node / pnpm / lockfile 环境与项目声明完全一致。
 * 负责：Node 24.x、packageManager 锁定 pnpm 版本、pnpm 实际版本、pnpm-lock.yaml 存在性。
 * 不负责：安装 Node/pnpm、安装依赖、运行 build/test、修改 lockfile。
 * 状态归属：工具链事实来自当前进程与根 package.json；产品版本不在本文件维护。
 * 对外接口：`node scripts/release-environment-check.mjs`，并导出 validateReleaseEnvironment 供单元测试。
 * 关联文件：package.json、pnpm-lock.yaml、scripts/pnpm-only.mjs、scripts/windows/lfaa-setup.ps1。
 * 修改注意事项：环境门禁只能从 package.json 读取版本要求，不允许在多个文件另造版本常量。
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd();

function parseRequiredPnpm(packageJson) {
  const packageManager = String(packageJson.packageManager ?? "");
  const match = /^pnpm@([^+\s]+)(?:\+.*)?$/.exec(packageManager);
  if (!match) throw new Error(`packageManager 必须锁定为 pnpm@<version>，当前：${packageManager || "<empty>"}`);

  const enginePnpm = String(packageJson.engines?.pnpm ?? "").trim();
  if (enginePnpm !== match[1]) {
    throw new Error(`engines.pnpm (${enginePnpm || "<empty>"}) 与 packageManager (${match[1]}) 不一致`);
  }
  return match[1];
}

function parsePnpmFromUserAgent(userAgent) {
  const match = /^pnpm\/([^\s]+)/.exec(String(userAgent ?? ""));
  return match?.[1] ?? "";
}

export function validateReleaseEnvironment({
  nodeVersion,
  pnpmVersion,
  packageJson,
  lockfileExists,
}) {
  const requiredPnpm = parseRequiredPnpm(packageJson);
  const nodeMajor = Number.parseInt(String(nodeVersion).split(".")[0] ?? "", 10);
  if (nodeMajor !== 24) {
    throw new Error(`Node.js 必须为 24.x，当前：${nodeVersion || "未检测到"}`);
  }

  const engineNode = String(packageJson.engines?.node ?? "").trim();
  if (!engineNode.includes("24") || !engineNode.includes("<25")) {
    throw new Error(`engines.node 必须锁定 Node 24.x，当前：${engineNode || "<empty>"}`);
  }

  if (pnpmVersion !== requiredPnpm) {
    throw new Error(`pnpm 必须为 ${requiredPnpm}，当前：${pnpmVersion || "未检测到"}`);
  }

  if (!lockfileExists) {
    throw new Error("缺少 pnpm-lock.yaml，正式发布禁止无锁安装");
  }

  return { nodeVersion, pnpmVersion, requiredPnpm };
}

function readActualPnpmVersion() {
  const fromUserAgent = parsePnpmFromUserAgent(process.env.npm_config_user_agent);
  if (fromUserAgent) return fromUserAgent;

  for (const [command, args] of [["pnpm", ["--version"]], ["corepack", ["pnpm", "--version"]]]) {
    const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
    if (result.status === 0) {
      const value = String(result.stdout ?? "").trim();
      if (value) return value;
    }
  }
  return "";
}

function runCli() {
  const packageFile = path.join(root, "package.json");
  if (!fs.existsSync(packageFile)) throw new Error("当前目录不是有效 LFAA 项目根：缺少 package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  const result = validateReleaseEnvironment({
    nodeVersion: process.versions.node,
    pnpmVersion: readActualPnpmVersion(),
    packageJson,
    lockfileExists: fs.existsSync(path.join(root, "pnpm-lock.yaml")),
  });
  console.log(`[LFAA] 发布环境检查通过：Node ${result.nodeVersion} / pnpm ${result.pnpmVersion}`);
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  try {
    runCli();
  } catch (error) {
    console.error(`[LFAA] 发布环境检查失败：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
