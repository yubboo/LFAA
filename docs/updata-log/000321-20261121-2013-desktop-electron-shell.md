# 桌面端（Electron 薄壳）与 Windows 安装包

- 日期：2026-11-21 20:13 +0800
- 类型：新功能

## 新增

LFAA 现在可以直接以桌面应用运行，并生成可分发的 Windows 安装包；浏览器入口保持不变。

- 菜单新增 **3. 启动桌面端** 与 **7. 构建桌面端安装包**。
- `pnpm desktop` 打开独立窗口：四栏工作台、输入框、聊天与媒体能力与 Web 完全一致。
- `pnpm build:desktop` 产出 `LFAA-0.1.0-setup.exe`（约 130MB，仅当前用户安装，免管理员）。
- 桌面端与 Web 共用 `~/.lfaa` 数据（项目、会话、记忆、媒体）；Electron 自身的 localStorage/缓存位于 `%APPDATA%\LFAA`。

## 行为说明

- 本机服务只监听 `127.0.0.1` 的随机端口，每次启动生成一次性接口令牌；窗口只加载该本机地址。
- 单实例：再次启动只聚焦已有窗口；关闭窗口即退出（首版无托盘）。
- 编辑菜单保留撤销/剪切/复制/粘贴/全选，输入框快捷键正常。
- Web 与桌面端同时运行会共享数据目录，建议同一时间只用一个入口。

## 验收

- 真实打开桌面窗口：标题「LFAA 工作区」，四栏布局无横向溢出；深色与浅色主题都正常；通过 CDP 采集，页面异常 0、`console.error` 0、失败请求 0。
- 生产宿主：页面注入令牌；`/api` 无令牌 401、带令牌 200，未知接口返回 JSON 404，页面路由回退 HTML。
- 自包含：把免安装目录复制到仓库外运行，窗口与接口仍正常；再次双击只保留 1 个窗口。
- 门禁：`check` 0 错误（5 条既有警告）、`lint` 404 文件 0 问题、README 配对 53 包、`typecheck`（含 `apps/desktop`）、`test` 391 项、`build`、`probe:loader` 13/13 全部通过。

## 限制

- 安装包未签名，部分机器可能提示 SmartScreen「未知发布者」；正式分发前需要证书。
- 安装向导在本机受限终端中未完成无人值守验证，需在普通桌面双击确认（已产出并通过免安装目录验证同一份产物）。
- 首版关闭 asar、无托盘/深链/自动更新。

## 文件

- `apps/desktop/`（`src/main.ts`、`src/window.ts`、`src/menu.ts`、`src/paths.ts`、`tsconfig.json`、`tsdown.config.ts`、`electron-builder.yml`、`build/icon.ico`、`README.md`、`package.json`）
- `apps/README.md`
- `packages/host/web-server/src/`（`index.ts`、`runtime.ts`、`handlers.ts`、`handlers-chat.ts`、`dev-server.ts`、`static-server.ts`、`static-files.ts`、`detect-root.ts`）
- `packages/host/web-server/tests/static-server.test.ts`
- `packages/host/web-server/README.md`、`README.zh.md`、`README.i18n.yaml`、`package.json`
- `packages/api/gateway/src/index.ts`
- `scripts/build-desktop.mjs`、`scripts/desktop.mjs`、`scripts/make-desktop-icon.mjs`、`scripts/lfaa.ps1`
- `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.gitignore`
- `docs/architecture/desktop.md`、`docs/architecture/overview.md`
- `docs/dev-log/000201-000400.md`、`docs/updata-log/000321-20261121-2013-desktop-electron-shell.md`

Git 未提交或推送；工作区原有未提交改动均保留。

> 目录调整（DEV-000322）：桌面端的启动/打包脚本、打包配置与图标已迁入 `apps/desktop/scripts/`、`apps/desktop/electron-builder.config.mjs`、`apps/desktop/resources/`，产物在 `apps/desktop/.desktop-build/`；命令与功能不变，上面「文件」一节的旧路径为交付当时的记录。