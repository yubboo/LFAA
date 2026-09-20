/**
 * 文件：comment-check.mjs
 * 作用：防止关键实现文件再次缺少“人能看懂”的中文文件头和 CSS 区域注释。
 * 负责：检查结构化字段、中文内容、关键 CSS 分区、项目地图和一级目录 README。
 * 不负责：判断注释内容是否绝对正确、TypeScript 编译、CSS 视觉测试。
 * 状态归属：无运行时状态；每次执行直接读取当前工作树。
 * 对外接口：`node scripts/comment-check.mjs`，成功返回 0，失败返回 1。
 * 关联文件：DEVELOPMENT.md、docs/项目结构与代码地图.md、scripts/governance-check.mjs、package.json。
 * 修改注意事项：新增关键实现文件时必须把它加入本检查或定义清晰的自动发现规则。
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const fail = (message) => {
  console.error(`LFAA comment/readability check failed: ${message}`);
  process.exit(1);
};

const hasChinese = (text) => /[\u3400-\u9fff]/u.test(text);

// 这些文件已经承载真实交互 / 系统桥接 / 用户脚本逻辑，因此必须使用完整文件头。
const keyFiles = [
  "packages/app-shell/src/AgentWorkbench.tsx",
  "packages/app-shell/src/WorkbenchIcon.tsx",
  "packages/app-shell/src/workbench.types.ts",
  "packages/app-shell/src/agent-workbench.css",
  "packages/ui/src/workbench/ResizableWorkbench.tsx",
  "packages/ui/src/workbench/workbench-layout.config.ts",
  "packages/ui/src/workbench/workbench-layout.types.ts",
  "packages/ui/src/workbench/workbench.css",
  "apps/web/src/main.tsx",
  "apps/web/src/App.tsx",
  "apps/web/src/terminal/view/LocalTerminal.tsx",
  "apps/web/src/contracts/vite-custom-events.d.ts",
  "apps/web/src/terminal/styles/LocalTerminal.module.css",
  "apps/web/vite.config.ts",
  "apps/web/dev/bridges/resources/resource-bridge.ts",
  "apps/web/dev/bridges/terminal/terminal-bridge.ts",
  "packages/workspace/src/work/logic/work-canvas-layout.ts",
  "packages/workspace/src/work/logic/useWorkCanvasController.ts",
  "packages/workspace/src/shared/logic/useWorkspaceSessionController.ts",
  "packages/workspace/src/chat/view/ChatWorkspace.tsx",
  "packages/workspace/src/work/view/WorkWorkspace.tsx",
  "scripts/governance-check.mjs",
  "scripts/import-path-check.mjs",
  "scripts/runtime-import-resolution-check.mjs",
  "scripts/folder-boundary-check.mjs",
  "scripts/dev-log-check.mjs",
  "scripts/docs-check.mjs",
  "scripts/check-node-pty.mjs",
  "scripts/node-dependency-health-check.mjs",
  "scripts/pnpm-only.mjs",
  "scripts/quality-not-configured.mjs",
  "scripts/release-name.mjs",
  "scripts/windows/lfaa-sync.ps1",
  "scripts/windows/lfaa-github.ps1",
  "scripts/windows/lfaa-setup.ps1",
  "scripts/windows/lfaa-update.ps1",
  "scripts/comment-check.mjs",
  "scripts/windows-script-encoding-check.mjs",
  "scripts/release-consistency-check.mjs",
  "scripts/prompt-lifecycle-check.mjs",
  "scripts/ui-contract-check.mjs",
  "scripts/config-schema-check.mjs",
  "scripts/release-environment-check.mjs",
  "scripts/release-rust-check.mjs",
  "scripts/release-gates-check.mjs",
  "test/dependency-setup.test.mjs",
  "test/node-dependency-health.test.mjs",
  "packages/config-system/src/config-schema.ts",
  "packages/config-system/src/config-validator.ts",
  "packages/config-system/src/index.ts",
  "packages/config-system/src/settings/ai/core/provider.types.ts",
  "packages/config-system/src/settings/ai/core/provider-registry.ts",
  "packages/config-system/src/settings/ai/core/account-service.ts",
  "packages/config-system/src/settings/ai/core/account.types.ts",
  "packages/config-system/src/settings/ai/core/host-ports.ts",
  "packages/config-system/src/settings/ai/core/model-settings.ts",
  "packages/config-system/src/settings/ai/transports/openai-compatible.ts",
  "crates/secret-store/src/lib.rs",
  "crates/secret-store/src/bin/lfaa-secret-broker.rs",
  "packages/ui/src/features/settings/ai/AiSettingsPage.tsx",
  "packages/ui/src/features/settings/ai/AiSettingsPanel.tsx",
  "apps/web/src/host-clients/ai-settings-client.ts",
  "apps/web/dev/bridges/ai/ai-config-bridge.ts",
  "apps/web/dev/bridges/ai/account-state-repository.ts",
  "apps/web/dev/bridges/ai/node-http-json.ts",
  "apps/web/dev/bridges/ai/rust-secret-store.ts",
  "packages/ui/src/features/settings/ai/ai-settings.types.ts",
];

const requiredFields = [
  "文件：",
  "作用：",
  "负责：",
  "不负责：",
  "状态归属：",
  "对外接口：",
  "关联文件：",
  "修改注意事项：",
];

for (const relative of keyFiles) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) fail(`missing key implementation file: ${relative}`);
  const text = fs.readFileSync(absolute, "utf8");
  const head = text.slice(0, Math.min(text.length, 5000));

  if (!hasChinese(head)) fail(`${relative} header must contain Chinese explanations`);
  for (const field of requiredFields) {
    if (!head.includes(field)) fail(`${relative} missing structured header field "${field}"`);
  }
}

const cssRequirements = new Map([
  ["packages/app-shell/src/agent-workbench.css", ["盒子结构：", "===== 1.", "===== 6.", "===== 10."]],
  ["packages/ui/src/workbench/workbench.css", ["Grid：", "===== 1.", "===== 5.", "===== 6."]],
  ["apps/web/src/terminal/styles/LocalTerminal.module.css", ["===== 1.", "===== 2.", "===== 3."]],
]);

for (const [relative, markers] of cssRequirements) {
  const text = fs.readFileSync(path.join(root, relative), "utf8");
  for (const marker of markers) {
    if (!text.includes(marker)) fail(`${relative} missing CSS structure marker "${marker}"`);
  }
}

// 人类目录导航必须常驻，避免用户只能靠猜文件夹名。
for (const relative of [
  "docs/项目结构与代码地图.md",
  "apps/README.md",
  "packages/README.md",
  "crates/README.md",
  "scripts/README.md",
  "packages/app-shell/src/README.md",
  "packages/ui/src/workbench/README.md",
  "apps/web/src/README.md",
  "apps/web/dev/bridges/ai/README.md",
  "packages/ui/src/features/README.md",
  "packages/ui/src/features/settings/ai/README.md",
  "packages/config-system/src/settings/ai/README.md",
  "packages/config-system/src/settings/ai/providers/README.md",
]) {
  if (!fs.existsSync(path.join(root, relative))) fail(`missing readability guide: ${relative}`);
}

console.log("LFAA comment/readability check passed.");
