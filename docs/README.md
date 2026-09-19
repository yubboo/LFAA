# LFAA 文档中心

> v0.0.50 起采用“按职责分文件、按编号在文件内递增”的长期文档模型。
> 不再为每个任务、每个版本制造新的 Markdown 文件。
> v0.0.50 已把旧体系的 251 个 docs Markdown 收敛为 9 个长期 Markdown；历史内容迁入对应时间线。

## 现在只需要认识这些文档

| 文档 | 作用 | 更新方式 |
|---|---|---|
| `../DEVELOPMENT.md` | 唯一开发规范 / AI 执行合同 | 当前事实覆盖更新 |
| `../ARCHITECTURE.md` | 当前架构 | 当前事实覆盖更新 |
| `../PROJECT_PLAN.md` | 当前总计划 | 当前事实覆盖更新 |
| `../CHANGELOG.md` | 所有版本变更时间线 | 只在顶部追加 |
| `项目结构与代码地图.md` | 人类目录 / 源码导航 | 当前事实覆盖更新 |
| `PROMPTS.md` | 所有开发 Prompt | 按 #编号追加 |
| `DEVELOPMENT_LOG.md` | 所有开发日志 | 按 #编号追加 |
| `MODULES.md` | 模块职责、Plan、Progress | 当前状态 + 历史段落 |
| `UI.md` | 当前 UI / 响应式 / 交互规范 | 当前事实覆盖更新 |
| `TESTING.md` | 测试策略与验收矩阵 | 当前事实覆盖更新 |
| `RELEASES.md` | 所有正式版本发布记录 | 按版本追加 |
| `RUNTIME.md` | Sync / GitHub / Update / Setup / Runtime Log | 当前事实覆盖更新 |

## 新任务怎么记录

不要创建新 Markdown。直接：

```text
docs/PROMPTS.md          → 新增 #NN.x Prompt
docs/DEVELOPMENT_LOG.md  → 新增 / 更新 #NN.x 开发记录
CHANGELOG.md              → 新增 vX.Y.Z
docs/RELEASES.md         → 新增 vX.Y.Z Release
```

## 当前 / 历史怎么区分

不再通过 `active/`、`archive/` 移动文件；由条目状态区分：

`active / implementing / testing / pending-user-acceptance / delivered / superseded / cancelled`。

这样文件数量保持稳定，历史仍可直接 `Ctrl+F` 搜索编号、版本或功能名称。

## Runtime Log

实际运行生成的 `.log` 仍位于：

```text
docs/logs/runtime/workspace-sync/
docs/logs/runtime/github-push/
docs/logs/runtime/source-update/
```

这些是本机运行数据目录，不再放 Markdown README。


> 当前候选版本：v0.0.86（#21.20，pending-user-acceptance）；Composer Runtime Control / Popover 闪烁修复等待 Windows 浏览器实机验收，v0.0.84 Provider Host 网络修复与 #2.16 ChatGPT/Codex 登录继续保留各自实机验收。
