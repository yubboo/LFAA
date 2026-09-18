# Source Update Logs

本目录用于保存：

```text
LFAA-Update.bat
```

一键拉取远程最新源码时生成的本机日志。

运行日志示例：

```text
update-20260918-120000.log
update-error-20260918-120100.log
```

## 记录内容

- 远程 origin；
- 当前分支；
- 更新前 Commit；
- 更新后 Commit；
- 远程新增 / 修改 / 删除 / 重命名文件；
- 最终结果。

## Git 与同步规则

实际生成的：

```text
*.log
```

属于本机开发运行记录：

- 默认不提交 GitHub；
- 不参与版本包与稳定工作区镜像差异判断；
- 不会因新版本同步而删除；
- 本 README 正常进入版本控制。
