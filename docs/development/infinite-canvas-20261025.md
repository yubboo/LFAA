# 无限画布 MVP（2026-10-25）

日期：2026-10-25

> 目标：在 LFAA 中交付一个可用的无限画布工作区（节点编排、拖拽、连线、素材节点与引用、工程导入导出、账户隔离持久化）。参考产品为 MagineCanvas-Learn（AGPL-3.0），本轮只学习交互与产品结构，未复制其源码、资源或数据格式。

## 1. 交付范围

- 新顶层路由 `/canvas`，登录后从左侧“应用”菜单的“无限画布”进入；不新增 ApplicationId，因此没有 SQLite App 作用域迁移，也不影响既有 App 授权与 Session 归属。
- 新数据 Owner `lfaa-canvas` 与认证 API `/canvas/*`；项目与素材按账户隔离，存放在当前 `LFAA_DATA_DIR` 的 `users/<账户 SHA-256>/projects/canvas/<项目 UUID>/`。
- 画布界面：项目列表/新建/打开/删除；React Flow 无限画布（缩放、拖拽、Shift 框选、Ctrl 多选、连线、Delete 删除）；文本/备注/图片/视频四类节点；素材面板上传、缩略图、插入、引用检查、删除；保存与 Ctrl+S、并发冲突提示、导入/导出 JSON。
- 装配：Web Bundle 加载 `lfaa-canvas` 与 `lfaa-api-canvas-controller`；Workbench 懒加载 `CanvasWorkspace`；导航项“无限画布”。

## 2. 明确未实现（下一阶段）

本轮**不包含**真实 AI 生成节点、即梦 CLI、本地语音、全景生成、画质增强、AI 助手、时间线/一键成片。界面上没有这些按钮，也没有假成功状态；服务端不提供对应路由。

## 3. Owner、数据与边界

| 项 | 事实 | 证据 |
|---|---|---|
| 数据 Owner | `packages/canvas/canvas`（`lfaa-canvas`），Cordis 服务名 `lfaaCanvas` | `packages/canvas/canvas/src/index.ts` |
| 项目格式 | `lfaa-canvas-project` / `formatVersion 1`；节点、连线、视口、素材清单 | 同上 |
| 存储 | `users/<hash>/projects/canvas/<projectId>/project.json` + `assets/<assetId>` | 同上 |
| 账户隔离 | `resolveUserDataPaths(LFAA_DATA_DIR, userId)`；未认证请求 401 | Owner + `requireAuthentication` |
| 并发 | `expectedUpdatedAt` 不匹配返回 409，不覆盖他人写入 | Owner `CanvasConflictError` |
| 边界 | 100 项目/账户、200 节点、400 连线、100 素材；文本 20k；坐标 ±100000；宽高 120–800；图片 16MiB、视频 64MiB、项目素材 512MiB | `CANVAS_LIMITS` |
| 素材安全 | 文件头与 MIME（PNG/JPEG/WebP/MP4/WebM）匹配；Range 读取；删除前检查节点引用；路径逐级拒绝符号链接 | Owner + controller |
| 迁移 | 设置中心数据根迁移的受管路径/清单已包含 `projects/canvas`；ZIP 备份/导入 allowlist 已加入 canvas | `packages/settings/settings/src/content-storage-migration.ts`、`scripts/*business-content-archive.ps1` |

## 4. API

全部需要登录：

- `GET /canvas/projects`、`POST /canvas/projects`、`GET/PUT/DELETE /canvas/projects/:projectId`
- `POST /canvas/projects/:projectId/assets`（raw 图片/视频字节，query `expectedUpdatedAt`、`name`）
- `GET /canvas/projects/:projectId/assets/:assetId`（Range，`private, no-store`）、`DELETE` 素材

控制器 `packages/api/canvas-controller` 只做协议适配、Joi 校验和错误映射，不持有画布文件。

## 5. 界面与工程导入导出

- Workbench 顶层模块路由 `/canvas`，模块外壳隐藏全局顶栏；画布自带工具栏、项目栏、素材面板和状态区。
- 响应式：≥1024px 三栏；<1024px 素材面板改为抽屉；<640px 项目栏改为下拉；短屏可滚动；全部使用 CSS Grid/Flex 和现有主题变量，新增变量带中文注释。
- 导出：JSON 含 `format/formatVersion/title/viewport/nodes/edges/assets[{...,data(base64)}]`；总量超过 64MiB 时拒绝并提示。
- 导入：先校验格式、数量、坐标、宽高、素材 MIME/文件头与连线引用，再新建项目逐素材上传；中途失败删除临时项目，不留下半成品。
- 保存：同一时刻只允许一个保存请求；409 显示“已在他处更新，请重新加载”；未保存离开页面由 `beforeunload` 拦截。

## 6. 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 数据 Owner 回归 | `cd apps/cli && node --import tsx --import ./register-package-loader.mjs --import ./tests/isolated-test-environment.mjs --test tests/canvas-owner.test.mjs` | 1 pass / 0 fail（账户隔离、CRUD、409、边界、素材 MIME/引用/Range、符号链接、磁盘 JSON） |
| 新包构建 | `pnpm --filter lfaa-canvas run build`、`pnpm --filter lfaa-api-canvas-controller run build`、`pnpm --filter lfaa-client-ui-workspace run build` | exit 0，产物在根 `dist/packages/` |
| 工作区 Gate | `pnpm run sync:workspace`、`pnpm run check:workspace` | 217 个包通过 |
| 类型检查 | `pnpm run typecheck` | exit 0 |
| Web 构建 | `pnpm run build:web` | exit 0；`dist/apps/web/assets/CanvasWorkspace-*.js/.css` 已生成 |
| 全量构建 | `pnpm run build` | exit 0（harness、Web、Control Plane、CLI 全部构建；不代替实页验收） |

## 7. 未验收与风险

- 未做真实浏览器实页验收：本轮会话没有浏览器控制工具；`/canvas` 的路由、拖拽/连线、响应式视口、导入导出下载需要在内置浏览器或 Electron 窗口逐项验收。构建通过不代表页面丝滑。
- 未做真实 Electron 桌面窗口验收；`/canvas` 复用共享 Web 页，桌面端应可用但未实机确认。
- 未做 API 认证冒烟（401/CRUD 上传下载）；Owner 回归覆盖数据层，控制器装配需在 Web Profile 启动后验证。
- 未实测大文件（64MiB 视频、512MiB 项目配额）与长画布帧时间。
- 未做 i18n（界面中文）；未做 AI 生成节点、即梦 CLI、本地语音、全景/增强（见第 2 节）。
- 参考项目 MagineCanvas-Learn 为 AGPL-3.0；本轮没有复制其源码/资源/格式，只参考节点画布的产品交互。

## 8. 设置中心与权限

- 未新增设置项；沿用外观主题、字体、字号、对比度、减少动态效果等现有令牌。
- 数据访问只使用登录账户边界，未新增权限模式或第二套审批；上传/保存/删除是普通认证 API，不伪造业务授权。

## 9. 文件清单

新增：

- `packages/canvas/canvas/{package.json,README.md,src/index.ts}`
- `packages/api/canvas-controller/{package.json,README.md,src/index.ts}`
- `packages/client/ui-workspace/src/{CanvasWorkspace.tsx,CanvasNodeCards.tsx,CanvasAssetPanel.tsx,CanvasProjectTransfer.ts,canvas-workspace.css}`
- `apps/cli/tests/canvas-owner.test.mjs`
- `docs/development/infinite-canvas-20261025.md`

修改：

- `packages/client/ui-workspace/src/client/index.ts`：注册 CanvasWorkspace 客户端模块。
- `packages/client/connection/src/api.ts`：无限画布客户端类型与请求函数。
- `packages/client/ui-layout/src/Workbench.tsx`：`/canvas` 路由、懒加载、模块外壳与导航项。
- `packages/client/ui-sidebar/src/GlobalNavigationRail.tsx`：画布页渲染全局导航轨与“无限画布”入口。
- `packages/util/values/src/application-id.ts`：应用导航 ID 增加 `canvas`（不增加 ApplicationId）。
- `packages/bundle/web-app/cordis.patch.yml`：装配 `lfaa-canvas` 与 `lfaa-api-canvas-controller`。
- `packages/settings/settings/src/content-storage-migration.ts`：数据根迁移纳入 canvas 项目。
- `scripts/package-responsibilities.mjs`：两个新包职责注解。
- `scripts/create-business-content-archive.ps1`、`scripts/extract-business-content-archive.ps1`：ZIP allowlist 加入 canvas。
- 生成物：`tsconfig.client.json`、`tsconfig.host.json`、`docs/harness-packages.{json,md}`、`pnpm-lock.yaml`（工作区同步/安装）。

## 10. 下一步

1. 在内置浏览器验收 `/canvas`（桌面/窄屏/短屏）并修复真实布局与交互问题。
2. 在 Web Profile 启动后验证 8 条 API（401/创建/保存/上传/下载/Range/删除）。
3. 生成节点：复用/抽象现有媒体生成 Owner（图像/视频），再接全景与画质增强；即梦 CLI 与本地语音单独评估许可和运行边界。
4. 工程包导出格式版本化与跨版本迁移；画布节点类型注册表与端口类型（当前只有自由连线，不执行 DAG）。
5. 大画布性能：缩略图缓存、节点虚拟化、帧时间与内存基线。
