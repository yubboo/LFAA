# 仓库脚本

此目录只放仓库级维护与启动辅助脚本。

- `lfaa.ps1`：Windows 菜单，供根目录 `lfaa.bat` 调用；选择 `0` 退出菜单时会保留当前终端窗口（双击独立启动时停留在工作区命令行，已有终端内启动则返回原提示符）。
- `ensure-dependencies.mjs`：核对 pnpm workspace、lockfile 与已安装依赖（兼容仓库目录或盘符迁移，并忽略仓库与 pnpm 副本间 CRLF/LF 换行差异）；有差异时优先离线复用本地缓存（`--offline`），仅在本地缺少新依赖时才回退 `--prefer-offline` 增量下载缺失包，并拒绝自动确认清空 `node_modules`。换行兼容回归测试：`node --test scripts/ensure-dependencies.test.mjs`。
- `sync-tsconfig.mjs`：按 DSH 模型生成 `tsconfig.base.json`（含 `@lfaa/*` paths 门面）、`tsconfig.json`（兼容壳）、`tsconfig.host.json`（聚合工程）与 27 个包的 `tsconfig.json`。新增或删除包后重跑。
- `sync-manifests.mjs`：写入各包 `main` / `types` / `exports` / `files` / `publishConfig` / `repository`，并移除 `private`。出口形状固定为 `types → lib/types/index.d.ts`、`default → lib/index.js`、`"./src/*": "./src/*"`。
- `build.mjs`：完整构建。清空各包 `lib` → `tsc -b tsconfig.host.json` 产出 `lib/types` → `tsdown` 打包出 `lib/index.js` → 校验产物 → 构建 Web 产物。对应 `pnpm build`；分段可用 `pnpm build:lib` / `pnpm build:bundle` / `pnpm build:web`。
- `check-workspace.mjs`：仓库边界检查（只扫 `packages/`；`vendor/` 为上游源码，不套用本仓规范）。校验包名 kebab-case 与 `exports` 存在、禁止 `@lfaa/*/src|client/*` 深层导入、Host 侧禁止 React/DOM/样式、Client 侧禁止 Node 内建模块、依赖必须声明且无循环依赖、插件包必须有默认导出（`plugin-default-export`）、`apps/` 只能导入 client 子路径与 boot 包（`app-host-import`）、每个包必须有 README 双语三件套（`readme-pair`）、包必须落在已登记分组（`package-group`）、源码目录不得残留构建产物（`stray-emit`），并把缺少中文首行注释记为警告。有错误时退出码 1。支持 `--root <dir>` 指向任意目录，便于用临时夹具验证规则本身。
- `sync-readmes.mjs`：按 DSH 结构为每个包生成 `README.md`（英文）与 `README.zh.md`（中文）；英文摘要登记在脚本的 `META` 中，中文摘要取自 `package.json` 的 `description`。新增包必须先在 `META` 登记。
- `verify-translation-pairing.mjs`：双语配对校验。按英文标题分段计算中英段落哈希并写入 `README.i18n.yaml`；`--write` 生成记录，不带参数则校验，漂移时报错。
- `test.mjs`：统一测试入口。枚举 `packages/**/tests/*.test.ts(x)` 后交给 Node 测试运行器（`node:test` + `tsx`）；`tsx` 读取 tsconfig 的 `paths` 门面，因此测试直接跑源码而不是 `lib`。支持 `--filter <子串>` 与 `--reporter <名称>`。

## 目录职责

- `packages/`：本仓自研插件包，遵循全部命名与注释规范。
- `vendor/`：内嵌的上游运行时源码，放宽编译选项、单独构建，见 `vendor/README.md`。
- `patches/`：第三方依赖补丁（pnpm patch），见 `patches/README.md`。

## 构建与解析模型

```
tsc -b tsconfig.host.json   →  每包 lib/types/*.js + *.d.ts
tsdown                      →  每包 lib/index.js（公开入口）
exports                     →  types: lib/types/index.d.ts，default: lib/index.js
tsconfig paths 门面          →  开发/测试/编辑器解析到 src
```

- 源码直读：`tsx` 与编辑器经 `paths` 读 `src`，因此开发与测试零构建延迟。
- 运行时：裸 Node 与插件走 `lib`，因此新克隆仓库需先执行 `pnpm build`（或 `pnpm build:lib && pnpm build:bundle`）。
- `lib/` 已被 `.gitignore` 忽略。
- 浏览器侧 `./client` 仍指向源码，等待 `client-modules` 立项后改为产物。

菜单选项 `1` 使用 `pnpm install --prefer-offline` 复用本地已下载缓存并补齐缺失依赖；选项 `2` 预检通过后执行 `pnpm lfaa web`，由 `apps/cli` 启动 Web 开发服务器；选项 `4` 一键初始化/关联 `https://github.com/yubboo/LFAA.git` 并推送当前工作区到 `main` 分支，选项 `5` 执行强制推送（`git push --force`），两者提交前均会提示上次 commit 信息、支持输入自定义 commit 信息并在提交与推送前自动拦截大文件（>5MB）、依赖构建产物及敏感凭据/明文密钥；选项 `6` 从 `origin/main` 拉取最新源码到本地（拉取前显示远程最新 commit 信息并支持 `[Y/n]` 回车默认确认），同时安全处理未提交改动与历史分叉。
