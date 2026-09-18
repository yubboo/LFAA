/**
 * 文件：pnpm-only.mjs
 * 作用：阻止使用 npm/yarn/bun 安装 LFAA workspace 依赖。
 * 负责：preinstall 阶段识别包管理器来源并强制 pnpm。
 * 不负责：安装依赖、固定 pnpm 版本、业务构建。
 * 状态归属：无运行时状态。
 * 对外接口：package.json preinstall。
 * 关联文件：package.json、pnpm-workspace.yaml、docs/standards/QUALITY_GATES.md。
 * 修改注意事项：LFAA 包管理器策略变化必须先更新 DEVELOPMENT/QUALITY_GATES。
 */
const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("[LFAA] 本项目只允许使用 pnpm 管理 Node.js 依赖。");
  console.error("[LFAA] 请使用：pnpm install");
  process.exit(1);
}
