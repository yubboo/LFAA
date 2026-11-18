# 仓库脚本

此目录只放仓库级维护与启动辅助脚本。

- `lfaa.ps1`：Windows 菜单，供根目录 `lfaa.bat` 调用。
- `ensure-dependencies.mjs`：核对 pnpm workspace、lockfile 与已安装依赖（兼容仓库目录或盘符迁移）；有差异时优先离线复用本地缓存（`--offline`），仅在本地缺少新依赖时才回退 `--prefer-offline` 增量下载缺失包，并拒绝自动确认清空 `node_modules`。
- `build.mjs`、`check-workspace.mjs`：待确定包与应用结构后再建立，避免把其它仓库专用规则带入本项目。

菜单选项 `1` 使用 `pnpm install --prefer-offline` 复用本地已下载缓存并补齐缺失依赖；选项 `2` 预检通过后执行 `pnpm lfaa web`，由 `apps/cli` 启动 Web 开发服务器；选项 `4` 一键初始化/关联 `https://github.com/yubboo/LFAA.git` 并推送当前工作区到 `main` 分支，选项 `5` 执行强制推送（`git push --force`），两者提交前均会提示上次 commit 信息并支持输入本次自定义 commit 信息。
