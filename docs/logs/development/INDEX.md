# 开发日志索引

> **开发前先查本索引。**
> 当前方案先看 `active/`，需要比较前后变化再看 `archive/`。

## 编号说明

- 真实历史从 **#1** 开始；
- 没有真实 `#0`，不伪造；
- #1 - #20 都必须能在本索引找到；
- 同一主任务的后续修正使用 `#NN.x`。

## 当前有效记录

| 主编号 | 名称 | 最新变更 | 状态 | 关键词 | 当前日志 |
|---|---|---|---|---|---|
| #2 | 配置系统 | #2.1 | active | 配置、Schema、模型、账号、权限、UI | `active/0002-配置系统.md` |
| #10 | GitHub 推送确认交互 | #10.1 | active | Git、GitHub、Commit、Push、确认、交互 | `active/0010-GitHub推送确认.md` |
| #19 | 一键准备与依赖检测 | #19.3 | active | Setup、Node、pnpm、Rust、Cargo、Web、Desktop、构建 | `active/0019-一键准备与依赖检测.md` |
| #20 | 开发日志与文档规范 | #20.2 | active | 日志、文档、中文、命名、目录、索引 | `active/0020-开发日志与文档规范.md` |
| #21 | Web 工作台 UI | #21.1 | active | Web、Vite、React、三栏、水墨、热插拔、工作区 | `active/0021-Web工作台UI.md` |

## 历史已交付记录

| 主编号 | 名称 | 记录版本 | 状态 | 关键词 | 历史日志 |
|---|---|---|---|---|---|
| #1 | 项目初始化与架构骨架 | #1.0 | delivered | 项目、架构、骨架、治理 | `archive/0001-项目初始化与架构骨架.md` |
| #3 | 导入路径与别名优化 | #3.0 | delivered | 导入、Alias、路径、边界 | `archive/0003-导入路径与别名优化.md` |
| #4 | 工作区同步与推送 | #4.0 | delivered | 同步、GitHub、工作区、推送 | `archive/0004-工作区同步与推送.md` |
| #5 | 同步日志目录 | #5.0 | delivered | 同步、日志、目录 | `archive/0005-同步日志目录.md` |
| #6 | GitHub推送修复 | #6.0 | delivered | GitHub、推送、Commit、脚本 | `archive/0006-GitHub推送修复.md` |
| #7 | GitHub远程检测 | #7.0 | delivered | GitHub、origin、中文、错误 | `archive/0007-GitHub远程检测.md` |
| #8 | Git远程配置 | #8.0 | delivered | Git、origin、远程、配置 | `archive/0008-Git远程配置.md` |
| #9 | 终端结束提示 | #9.0 | delivered | 终端、提示、关闭、脚本 | `archive/0009-终端结束提示.md` |
| #11 | 源码更新工具 | #11.0 | delivered | Git、更新、拉取、源码 | `archive/0011-源码更新工具.md` |
| #12 | 脚本菜单与强制更新 | #12.0 | delivered | 脚本、菜单、强制拉取、备份 | `archive/0012-脚本菜单与强制更新.md` |
| #13 | 更新路径无关 | #13.0 | delivered | Git、路径、盘符、更新 | `archive/0013-更新路径无关.md` |
| #14 | 同步菜单顺序 | #14.0 | delivered | 同步、菜单、交互 | `archive/0014-同步菜单顺序.md` |
| #15 | 更新差异修复 | #15.0 | delivered | Update、diff、拉取、Git | `archive/0015-更新差异修复.md` |
| #16 | 项目治理加固 | #16.0 | delivered | 治理、归属、资源、安全、质量 | `archive/0016-项目治理加固.md` |
| #17 | pnpm一致性 | #17.0 | delivered | pnpm、包管理、工具链 | `archive/0017-pnpm一致性.md` |
| #18 | Setup缺少Cargo修复 | #18.0 | delivered | Setup、Cargo、Rust、依赖 | `archive/0018-Setup缺少Cargo修复.md` |

## #20 历史变更

| 版本 | 状态 | 日志 |
|---|---|---|
| #20.0 | superseded | `archive/0020-00-开发日志初始分层.md` |
| #20.1 | superseded | `archive/0020-01-历史编号迁移.md` |
| #20.2 | active | `active/0020-开发日志与文档规范.md` |

## 搜索方法

例如：

```text
Cargo
```

可直接定位 #18。

```text
插件
```

可定位项目资源和治理相关记录。

查到旧日志后，先看其中的：

```text
已由：
当前查看：
```

再跳到当前日志，避免按旧方案开发。


## #10 历史变更

| 版本 | 状态 | 日志 |
|---|---|---|
| #10.0 | delivered | `archive/0010-Commit确认优化.md` |
| #10.1 | active | `active/0010-GitHub推送确认.md` |


## #19 历史变更

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | superseded | `archive/0019-02-本地依赖与lockfile.md` |
| #19.3 | active | `active/0019-一键准备与依赖检测.md` |


## #2 历史变更

| 版本 | 状态 | 日志 |
|---|---|---|
| #2.0 | superseded | `archive/0002-00-配置系统初始合同.md` |
| #2.1 | active | `active/0002-配置系统.md` |


## #21 历史变更

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | active | `active/0021-Web工作台UI.md` |
