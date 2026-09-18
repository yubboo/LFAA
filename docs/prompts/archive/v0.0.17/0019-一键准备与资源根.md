# #19 一键准备与项目资源根收敛

## 主模块

`project-foundation`

## 目标

1. 将 Setup 菜单 1 升级为真正的一键准备入口；
2. 消除根 `/skills`、`/plugins` 与 `.lfaa/*` 双重事实源；
3. 固定 `.lfaa` 热插拔资源模型。

## Setup

- pnpm install 始终可重复运行并复用已下载依赖；
- 缺少 Cargo 时通过 winget 尝试安装 Rustlang.Rustup；
- 不在没有受控 Cargo.lock 时偷偷生成本机锁文件；
- 项目尚无外部 Rust crate 时明确无需 fetch。

## Resource Root

唯一项目资源根：

```text
.lfaa/
```

删除：

```text
/skills
/plugins
```

## Hot Plug

后续 File Watcher 监听 `.lfaa/skills|experts|plugins|extensions|mcp`，经校验后发布新的 Registry Generation。运行中的 Run 固定使用原 generation。
