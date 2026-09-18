# #18 Setup 菜单缺少 Cargo 时错误终止修复

## 主模块

`project-foundation`

## 问题

用户运行：

```text
LFAA-Setup.bat
→ 1 全部依赖
```

pnpm workspace 依赖已经成功安装，但机器未安装 Cargo 时，脚本随后抛出：

```text
未检测到 Cargo。
```

导致菜单 1 被标记为失败。

## 根因

菜单 1 将 Node/pnpm 与 Rust/Cargo 两套工具链错误地当成一个不可分割的前置条件。

## 修复

- 菜单 1 先做 Node/Rust 工具链预检；
- Node 可用则安装 Node 依赖；
- Cargo 可用则安装 Rust 依赖；
- 缺少某一工具链时安全跳过并明确提示；
- 已成功完成的依赖安装结果保留；
- 两类工具链都不存在时才失败；
- 菜单 4 和菜单 10 仍严格要求 Cargo。

## 不修改

- Config System 业务；
- Agent Runtime；
- Rust Broker。
