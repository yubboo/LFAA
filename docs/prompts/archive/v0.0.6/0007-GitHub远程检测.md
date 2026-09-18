# #7 GitHub 首次远程仓库检测与中文输出修复

## 主模块

`project-foundation`

## 问题

首次 Git 初始化成功后：

```text
git remote get-url origin
```

因为 `origin` 尚未创建而返回错误。

Windows PowerShell 在 `$ErrorActionPreference = "Stop"` 下把 Git stderr 包装成错误，导致脚本提前退出。

同时 Git 原生命令直接输出到控制台，出现大量英文。

## 根因

1. 首次状态没有 `origin` 是正常情况，脚本却直接读取 URL。
2. PowerShell 对原生命令 stderr 的处理导致预期状态升级为错误。
3. 没有统一捕获 Git stdout/stderr。

## 修复

- 先执行 `git remote` 判断是否存在 `origin`；
- 不存在则直接 `git remote add origin`；
- 存在才执行 `git remote get-url origin`；
- 新增 `Invoke-GitRaw` 捕获原始 Git 输出；
- 默认控制台只显示中文状态；
- Git 原始英文技术信息仅在失败时写入日志；
- Git 中文路径设置 `core.quotepath=false`；
- 保留用户自定义 Commit 名称流程。

## 验收

- 已经存在但没有 origin 的 `.git` 可以继续运行；
- 全新 `.git` 可以首次添加 origin；
- 控制台默认不直接打印 Git 英文帮助/错误；
- 首次和后续 Commit 均由用户自定义名称。
