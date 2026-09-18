/**
 * 文件：quality-not-configured.mjs
 * 作用：尚未实现真实 build/typecheck/test 时明确失败，防止质量命令“假成功”。
 * 负责：输出未配置原因并返回非零退出码。
 * 不负责：真正执行编译、测试或 lint。
 * 状态归属：无运行时状态。
 * 对外接口：package.json 的 build/typecheck/test 占位失败入口。
 * 关联文件：package.json、docs/standards/QUALITY_GATES.md。
 * 修改注意事项：一旦某质量项有真实实现，应替换对应命令，而不是让本脚本返回成功。
 */
const gate = process.argv[2] ?? "quality gate";

console.error(`[LFAA] ${gate} 尚未接入真实工具链，本次检查不通过。`);
console.error("请先在当前模块 Plan 中锁定依赖并实现真实命令；禁止用占位输出冒充成功。");
process.exit(1);
