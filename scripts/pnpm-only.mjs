/**
 * Copyright (c) 2026 二鱼.
 * Part of the LFAA project.
 *
 * 文件：pnpm-only.mjs
 * 作用：阻止 npm / yarn / bun 等包管理器安装 LFAA workspace 依赖。
 * 负责：在 preinstall 阶段验证实际包管理器。
 * 不负责：安装 pnpm 或管理系统级 Node.js。
 */

const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("[LFAA] 本项目只允许使用 pnpm 管理 Node.js 依赖。");
  console.error("[LFAA] 请使用：pnpm install");
  process.exit(1);
}
