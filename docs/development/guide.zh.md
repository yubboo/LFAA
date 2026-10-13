# 开发流程

[English](guide.md) · [文档目录](../README.zh.md)

修改前读取根 [AGENTS](../../AGENTS.md)、[开发规范](../../开发规范.md)、[架构](../系统总体架构.md)、[当前计划](../开发计划.md)、[任务合同](../PROMPTS.md) 与目标包 README。先登记运行入口、设置、数据/权限 Owner、允许修改范围和验收条件，再编码。

```sh
pnpm run check:workspace
pnpm run typecheck
```

`check:workspace` 检查实际包入口、内部依赖及环、类型路径、包清单、当前产品版本、日志编号、构建输出边界与当前文档链接。包变更后运行 `pnpm run sync:workspace`，提交前重新执行只读检查；同步命令不修复业务或发布数据。

长期 CLI 回归在 `apps/cli` 执行：

```sh
node --import tsx --import ./register-package-loader.mjs --test tests/*.test.mjs
```

只选择与改动直接相关的回归；共享 Session/Settings/存储修改需覆盖下游。Electron 的纯 Node 测试位于 `apps/desktop-electron/tests`。构建产物只能位于根 `dist/`；隔离 Host 构建为 `node scripts/build-harness.mjs host-staging`。

CI 工作流运行工程检查、类型检查及直接相关的长期回归。CI 配置存在不等于远端已执行；本地构建成功不证明浏览器、桌面、真实 Provider 或设备验收。当前没有 `workspace-preflight` 命令，不能把新的检查冒充该门禁。

不要删除真实数据、备份、旧发行包或已要求保留的上游占位目录。不要以修复为由重启在用服务、重写 Git 历史或发布候选版本。
