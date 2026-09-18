# Workspace Sync Logs

本目录用于保存 **LFAA 稳定工作区同步日志**。

运行：

```text
LFAA-Sync.bat
```

后，日志生成到：

```text
docs/logs/runtime/workspace-sync/
```

例如：

```text
sync-20260917-235500-v0.0.4.log
```

## 说明

`README.md` 属于项目文档，会进入版本控制。

实际运行生成的：

```text
*.log
```

属于本机开发留痕：

- 不参与版本包与稳定工作区的镜像差异判断；
- 不会因为新版本同步被删除；
- 默认不会提交到 GitHub；
- 可由开发者手工保留、审查或归档。

同步日志记录：

- 时间；
- LFAA 版本；
- 来源版本目录；
- 目标稳定工作区；
- ADD；
- MOD；
- DEL；
- 最终同步状态。
