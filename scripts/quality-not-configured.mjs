/**
 * Copyright (c) 2026 二鱼.
 * Part of the LFAA project.
 *
 * 文件：quality-not-configured.mjs
 * 作用：阻止尚未接入真实工具链的质量命令产生假成功。
 * 负责：用非零退出码明确说明当前缺少的真实检查。
 * 不负责：替代未来的 TypeScript、测试或构建工具链。
 */

const gate = process.argv[2] ?? "quality gate";

console.error(`[LFAA] ${gate} 尚未接入真实工具链，本次检查不通过。`);
console.error("请先在当前模块 Plan 中锁定依赖并实现真实命令；禁止用占位输出冒充成功。");
process.exit(1);
