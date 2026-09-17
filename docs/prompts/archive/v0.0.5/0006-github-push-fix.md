# #6 GitHub 一键推送修复

## 主模块

`project-foundation`

## 问题

首次运行：

```text
LFAA-GitHub.bat
```

到：

```text
git init
```

时 Git 只显示帮助页，没有真正执行 `init`。

## 根因

PowerShell helper 使用：

```text
param([string[]]$Args)
```

`$Args` 与 PowerShell 自动变量冲突，导致 Git 子命令没有正确传递。

## 任务目标

- 修复 Git 命令参数传递；
- 按同步脚本标准显示 Git 文件变化；
- Commit 名称由用户自定义；
- 首次 Commit 不写死 `first commit`；
- Commit/Push 分别确认；
- 保留 `.git`；
- 不使用 force push；
- 生成 GitHub Push 本机日志。

## 禁止修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。

## 验收

首次运行能够执行：

```text
git init
git branch -M main
git remote add origin ...
git add -A
git commit -m "<用户输入>"
git push -u origin main
```

后续运行复用原 `.git`。
