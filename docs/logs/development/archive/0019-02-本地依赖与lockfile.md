# #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.2
- **状态：** superseded
- **关键词：** Setup、Node、pnpm、Rust、Cargo、依赖、lockfile
- **已由：** #19.3 替代
- **当前查看：** `docs/logs/development/active/0019-一键准备与依赖检测.md`

## 当前结论

本地 `LFAA-Setup.bat → 1` 使用标准：

```text
pnpm install
```

原因：开发工作区允许新增依赖后同步 `pnpm-lock.yaml`。

严格的可复现质量/CI 环境仍必须使用：

```text
pnpm install --frozen-lockfile
```

## 最新变更

### #19.2 本地开发允许同步 lockfile

- UI 正式进入 React/Vite 开发后，package 声明会变化；
- Setup 作为本地开发准备工具，不再强制 frozen lock；
- 已有依赖继续复用；
- 新依赖自动下载；
- `pnpm-lock.yaml` 会按 package 声明同步；
- 依赖统计只读取 `pnpm-workspace.yaml` 声明的 workspace package，不递归扫描 `node_modules`；
- CI/正式质量门禁仍要求 frozen lock。

## 影响范围

- `scripts/windows/lfaa-setup.ps1`
- `docs/standards/QUALITY_GATES.md`
- #21 Web UI 依赖首次安装

## 验证结果

- Setup 命令已切换到 `pnpm install`；
- workspace 统计已排除 `node_modules` 递归误扫；
- root 质量命令没有伪装为已通过；
- 真实 Vite build 等待 Node 24 + pnpm 依赖环境验证。

## 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | active | `active/0019-一键准备与依赖检测.md` |
