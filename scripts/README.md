# 仓库脚本

此目录只放仓库级维护与启动辅助脚本。

- `lfaa.ps1`：Windows 菜单，供根目录 `lfaa.bat` 调用；选择 `0` 退出菜单时会保留当前终端窗口（双击独立启动时停留在工作区命令行，已有终端内启动则返回原提示符）。推送（`4`/`5`）前显示「当前 HEAD」并列出待推送提交；本地已与 `origin/main` 同步时直接提示，不做空推送。远程地址固定为 GitHub 的规范名 `https://github.com/yubboo/LFAA.git`（仓库名大写），运行时会把 `origin` 同步改写成该地址，避免每次推送收到 `repository moved` 提示。
- `ensure-dependencies.mjs`：核对 pnpm workspace、lockfile 与已安装依赖（兼容仓库目录或盘符迁移，并忽略仓库与 pnpm 副本间 CRLF/LF 换行差异）；有差异时优先离线复用本地缓存（`--offline`），仅在本地缺少新依赖时才回退 `--prefer-offline` 增量下载缺失包，并拒绝自动确认清空 `node_modules`。换行兼容回归测试：`node --test scripts/ensure-dependencies.test.mjs`。
- `sync-tsconfig.mjs`：按 DSH 模型生成 `tsconfig.base.json`（含 `@lfaa/*` paths 门面）、`tsconfig.json`（兼容壳）、`tsconfig.host.json`（聚合工程）与 27 个包的 `tsconfig.json`。新增或删除包后重跑。
- `sync-manifests.mjs`：写入各包 `main` / `types` / `exports` / `files` / `publishConfig` / `repository`，并移除 `private`。出口形状固定为 `types → lib/types/index.d.ts`、`default → lib/index.js`、`"./src/*": "./src/*"`。
- `build.mjs`：完整构建。清空各包 `lib` → `tsc -b tsconfig.host.json` 产出 `lib/types` → `tsdown` 打包出 `lib/index.js` → 校验产物 → 构建 Web 产物。对应 `pnpm build`；分段可用 `pnpm build:lib` / `pnpm build:bundle` / `pnpm build:web`。
- `check-workspace.mjs`：仓库边界检查（只扫 `packages/` 与 `apps/`；`vendor/` 为上游源码，不套用本仓规范）。校验包名 kebab-case 与 `exports` 存在、禁止 `@lfaa/*/src|client/*` 深层导入、Host 侧禁止 React/DOM/样式、Client 侧禁止 Node 内建模块、**Client 侧禁止用相对路径导入 `src/`（`client-host-relative`）**、依赖必须声明且无循环依赖、插件包必须有默认导出（`plugin-default-export`）、**插件声明的 `inject` 必须覆盖它访问的 `ctx.*` 服务（`plugin-inject`：漏一个就会在服务就绪前构建插件，Host 启动直接抛错）**、`apps/` 只能导入 client 子路径与 boot 包（`app-host-import`）、每个包必须有 README 双语三件套（`readme-pair`）、包必须落在已登记分组（`package-group`）、源码目录不得残留构建产物（`stray-emit`）、**文件规模硬上限（`file-size`：`tsx` 400 / `ts` 500 / `module.css` 400 行）**、**client 样式禁止写死颜色（`css-theme-literal`）**，并把缺少中文首行注释记为警告。有错误时退出码 1。
- `check-allowlist.json`：上一条规则的棘轮豁免清单，按规则名登记「已存在且已知」的违规文件，只允许减少不允许增加；某条目不再违规时会以 `allowlist-stale` 警告提示删除，写了未登记的规则名会直接报错。拆分/修复后请同轮删除对应条目。
- `check-logs.mjs`：日志编号体检。扫描 `docs/dev-log/` 卷内的 `# DEV-000001` 标题编号与 `docs/updata-log/` 文件名编号，同一类日志内不得重号（同一轮两类日志共用编号是允许的）。历史并行会话造成的重号登记在 `log-number-baseline.json`，只减不增：整理好一组就删一条，新增重号直接判错；基线条目不再是重号时给 `stale` 提示。已并入 `pnpm check` 与提交前门禁。
- `check-workspace.mjs` 开关：`--root <dir>` 指向任意目录，便于用临时夹具验证规则本身；`--verbose` 展开「处于拆分提示区间」的逐文件明细（默认只汇总成一条警告）；`--no-allowlist` 忽略全部豁免、按「如果现在没有豁免」报告，用于盘点存量债务。
- `css-theme-literal` 判定细节：只扫 `client/**` 样式；阴影/滤镜/玻璃材质（`box-shadow`、`filter`、`--*shadow/sheen/glow*`）与 α ≤ 0.2 的半透明背景/边框属于表面质感，自动放行；`var(--x, #固定色)` 形式回退无论出现在哪一行都算违规。允许写具体色值的只有变量定义层、代码高亮调色板与主题预览样张，登记在 `check-allowlist.json`（当前 5 个文件），只减不增。
- `lint-workspace.mjs`：仓库级 Lint（AST 规则，复用仓库已有的 TypeScript 编译器 API，无需额外依赖或联网）。扫描各包 `src|client|contract` 与 `apps/*/src`，规则：未使用导入、显式 `any`、调试用 `console.log`（`warn`/`error` 允许）、`debugger`、宽松相等（`== null` 放行）、空 `catch`（带注释说明的放行）、`@ts-ignore`/`@ts-nocheck`、无说明的 `@ts-expect-error`。命中即退出码 1；支持 `--root <dir>` 跑临时夹具。对应 `pnpm lint`。
- `lint-allowlist.json`：Lint 的棘轮豁免清单（schema 同 `check-allowlist.json`）。当前为空，表示规则已零违规：以后出现命中应先修代码，而不是登记豁免。
- `check-workspace.test.mjs` / `lint-workspace.test.mjs`：两套规则的回归测试，用 `--root` 临时夹具验证「能拦住 / 豁免生效 / 过期提示 / 未知规则报错」，不往仓库写违规样本。
- `sync-readmes.mjs`：按 DSH 结构为每个包生成 `README.md`（英文）与 `README.zh.md`（中文）；英文摘要登记在脚本的 `META` 中，中文摘要取自 `package.json` 的 `description`。新增包必须先在 `META` 登记。**生成时保留各包手写的 `Dev Note` / `开发说明` 段落**（旧版会覆盖成 `None.`/`无。`，属数据丢失缺陷，已修复）；导出表按 `package.json` 的 `exports` 生成，含 `./contract`。
- `verify-translation-pairing.mjs`：双语配对校验。按英文标题分段计算中英段落哈希并写入 `README.i18n.yaml`；`--write` 生成记录，不带参数则校验，漂移时报错。
- `probe-loader.mjs`：Loader 按包名装载探针。以 `packages/bundle/web/package.json` 为解析基准（该包声明了全部可安装插件包；`apps/web` 只有前端入口依赖，作基准会导致 `@lfaa/tools` 解析失败）。覆盖装载/卸载/重装/并存/二创全链路，需先 `pnpm build`。对应 `pnpm probe:loader`。
- `verify-web.mts`：生产构建产物的浏览器验收。用单进程启动 `@lfaa/web-server` 静态宿主（随机端口），再以本机 Edge/Chrome 无头打开页面，依次检查壳层、资料库（含「图像」分类的媒体网格）、代码审查、设置中心（常规/Git/代码审查）、浅色主题与 390px 窄屏；出现控制台错误或步骤失败即退出码 1，截图与报告写到系统临时目录 `lfaa-verify/`。Web 产物缺失时自动执行 `pnpm build:web`，也可加 `--build` 强制重建；未检测到浏览器时跳过并以 0 退出（CI 可安全调用）。对应 `pnpm verify:web`。
- `install-hooks.mjs`：把当前克隆的 `core.hooksPath` 指向 `.githooks`，启用提交前门禁（空白检查 + `node scripts/check-workspace.mjs` + `node scripts/check-logs.mjs`，约 1-2 秒）。只改本地配置，不影响全局；撤销用 `git config --local --unset core.hooksPath`。对应 `pnpm hooks:install`。
- `test.mjs`：统一测试入口。枚举 `packages/**/tests/*.test.ts(x)` 与 `scripts/**/*.test.mjs` 后交给 Node 测试运行器（`node:test` + `tsx`）；`tsx` 读取 tsconfig 的 `paths` 门面，因此包测试直接跑源码而不是 `lib`。支持 `--filter <子串>` 与 `--reporter <名称>`。

## 目录职责

- `packages/`：本仓自研插件包，遵循全部命名与注释规范。
- `vendor/`：内嵌的上游运行时源码，放宽编译选项、单独构建，见 `vendor/README.md`。
- `patches/`：第三方依赖补丁（pnpm patch），见 `patches/README.md`。
- `.githooks/`：仓库级提交钩子，由 `pnpm hooks:install` 启用（空白检查 + `check` + `lint`）。
- `.github/workflows/`：CI。在 `windows-latest` 上按 `install --frozen-lockfile → check → lint → readme:pair → typecheck → test → build → probe:loader` 顺序跑完整门禁（仓库有 Windows 专有实现与测试，暂不套用 Linux runner）。

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
