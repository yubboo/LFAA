# GitHub Push Logs

本目录用于保存 LFAA 一键 GitHub 推送的本机运行日志。

运行：

```text
LFAA-GitHub.bat
```

成功或部分失败时，可生成：

```text
push-YYYYMMDD-HHMMSS-vX.Y.Z.log
```

日志记录：

- 执行时间；
- LFAA 版本；
- 仓库；
- 分支；
- Commit 名称；
- 本次 Git 变化；
- 推送结果。

## Git 策略

实际生成的：

```text
*.log
```

属于本机开发留痕：

- 默认不提交 GitHub；
- 不参与版本快照和稳定工作区镜像差异判断；
- 不会因版本同步被删除；
- `README.md` 本身正常进入版本控制。
