/**
 * 文件：pnpm-only.mjs
 * 作用：阻止错误包管理器或错误 pnpm 版本安装 LFAA workspace 依赖。
 * 负责：preinstall 阶段读取根 package.json，并强制实际 pnpm 与 packageManager / engines.pnpm 精确一致。
 * 不负责：安装依赖、自动准备 pnpm、业务构建。
 * 状态归属：包管理器版本事实只来自根 package.json。
 * 对外接口：package.json preinstall。
 * 关联文件：package.json、pnpm-workspace.yaml、scripts/release-environment-check.mjs、scripts/windows/lfaa-setup.ps1。
 * 修改注意事项：禁止在本文件另写 pnpm 固定版本常量；版本必须由 package.json 单一事实源驱动。
 */
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageManager = String(packageJson.packageManager ?? "");
const expectedVersion = /^pnpm@([^+\s]+)(?:\+.*)?$/.exec(packageManager)?.[1] ?? "";
const engineVersion = String(packageJson.engines?.pnpm ?? "").trim();
const userAgent = process.env.npm_config_user_agent ?? "";
const pnpmVersion = /^pnpm\/([^\s]+)/.exec(userAgent)?.[1] ?? "";

if (!pnpmVersion) {
  console.error("[LFAA] 本项目只允许使用 pnpm 管理 Node.js 依赖。");
  console.error(`[LFAA] 项目要求：${packageManager || "pnpm@<missing>"}`);
  process.exit(1);
}
if (!expectedVersion || engineVersion !== expectedVersion) {
  console.error("[LFAA] packageManager 与 engines.pnpm 的版本声明不一致，禁止安装。");
  process.exit(1);
}
if (pnpmVersion !== expectedVersion) {
  console.error(`[LFAA] pnpm 版本不匹配：当前 ${pnpmVersion}，项目要求 ${expectedVersion}。`);
  console.error(`[LFAA] 请通过 LFAA-Setup.bat 或 Corepack 准备 pnpm@${expectedVersion}。`);
  process.exit(1);
}
