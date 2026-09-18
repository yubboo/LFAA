# #5 同步日志目录优化

## 主模块

`project-foundation`

## 任务目标

将 LFAA-Sync 运行生成的同步日志从隐藏目录：

```text
.lfaa-local/sync-logs/
```

迁移到：

```text
docs/logs/workspace-sync/
```

使开发留痕更直观、可发现、按 docs 分类管理。

## 约束

- `*.log` 不参与版本镜像差异判断；
- `*.log` 不被新版本同步删除；
- `*.log` 默认不推送 GitHub；
- `README.md` 正常进入版本控制；
- 不修改 config-system 业务。

## 验收

- PowerShell 生成日志到新目录；
- 同步后校验不会因旧日志失败；
- `.gitignore` 忽略运行日志；
- 文档/Progress/Changelog 同步更新。
