# 仓库脚本

此目录只放仓库级维护与启动辅助脚本。

- `lfaa.ps1`：Windows 菜单，供根目录 `lfaa.bat` 调用；选择 `0` 退出菜单时会保留当前终端窗口（双击独立启动时停留在工作区命令行，已有终端内启动则返回原提示符）。
- `ensure-dependencies.mjs`：核对 pnpm workspace、lockfile 与已安装依赖（兼容仓库目录或盘符迁移，并忽略仓库与 pnpm 副本间 CRLF/LF 换行差异）；有差异时优先离线复用本地缓存（`--offline`），仅在本地缺少新依赖时才回退 `--prefer-offline` 增量下载缺失包，并拒绝自动确认清空 `node_modules`。换行兼容回归测试：`node --test scripts/ensure-dependencies.test.mjs`。
- `build.mjs`、`check-workspace.mjs`：待确定包与应用结构后再建立，避免把其它仓库专用规则带入本项目。

菜单选项 `1` 使用 `pnpm install --prefer-offline` 复用本地已下载缓存并补齐缺失依赖；选项 `2` 预检通过后执行 `pnpm lfaa web`，由 `apps/cli` 启动 Web 开发服务器；选项 `4` 一键初始化/关联 `https://github.com/yubboo/LFAA.git` 并推送当前工作区到 `main` 分支，选项 `5` 执行强制推送（`git push --force`），两者提交前均会提示上次 commit 信息、支持输入自定义 commit 信息并在提交与推送前自动拦截大文件（>5MB）、依赖构建产物及敏感凭据/明文密钥；选项 `6` 从 `origin/main` 拉取最新源码到本地（拉取前显示远程最新 commit 信息并支持 `[Y/n]` 回车默认确认），同时安全处理未提交改动与历史分叉。
