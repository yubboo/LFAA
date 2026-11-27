# 无限画布「我的项目」入口页与左二项目自动绑定方案

- 状态：已完成（DEV-000674）
- 级别：A1（跨 `@lfaa/canvas` 与 `@lfaa/client-ui-canvas` / `@lfaa/client-ui-workspace` 新功能）
- 关联：`packages/media/canvas`、`packages/client/ui-canvas`、`packages/client/ui-workspace`、`packages/ui/layout`

## 1. 背景与目标

当前点击右栏工作台的「无限画布」后，`CanvasWorkspace` 会跳过项目选择、直接为当前激活项目加载或创建默认画布并进入编辑器。负责人希望：

1. **每次打开「无限画布」标签页先进入「我的项目」页**（参考 updream 项目大厅）；
2. **仅展示画布项目**：只列出已有画布数据或从画布页新建的项目，不把普通纯代码项目混入列表；
3. **两种创建方式结合**：
   - 网格首卡「`+ 新建项目`」：一键快速创建「未命名项目」（在默认工作区下自动创建独立子目录、初始化默认画布），**自动收录进左二会话项目菜单栏**并直接进入该项目的无限画布；
   - 顶栏「`+ 新建`」按钮：打开左二栏同款创建项目弹窗（支持自定义项目名与目录选择），创建后同样初始化默认画布、收录进左二栏并直接进入画布；
4. **自动绑定与往返**：点击任意项目卡片时同步切换左二栏激活项目并进入对应画布；画布编辑器左上角提供「返回项目」按钮随时回到「我的项目」页。

## 2. 调研与参考

- **本仓库已有实现（2026-11-27 查阅）**：
  - `packages/client/ui-canvas/client/canvas/Canvas-Workspace.tsx`：已订阅 `workbench`（读取 `projects` / `activeProjectId` / `rightPanelMaximized`）并已支持通过 `wbSnap.projectProvider.renderCreateDialog` 打开左二栏同款创建项目弹窗。
  - `packages/media/canvas/src/canvas-store.ts`：画布按 `sha256(projectId)` 分目录持久化在 `~/.lfaa/canvas/<hash>/<canvasId>/board.json` 与 `assets/`。由于目录名是单向哈希，前端将左二栏已知的 `projectIds` 传入新汇总接口，Host 侧按哈希精确探测对应目录即可，**无需改动磁盘目录结构、完全兼容历史画布**。
  - `packages/workspace/workspace/src/http-handler.ts` 与 `packages/client/ui-workspace/client/store/local-project-store.ts`：已有 `/api/workspace/projects/resolve-path` 与 `POST /api/workspace/projects`（支持在默认工作区自动分配不重名目录并落盘项目，同时更新左二栏项目存储）。
- **外部参考（2026-11-27 查阅）**：
  - 负责人提供的 updream「我的项目」参考图：顶部标题 + 卡片缩放滑块 + 搜索 + 排序 + 网格/列表切换 + `+ 新建`；主体首卡为 `+ 新建项目` 虚线卡，其余为 16:10 封面卡片（缩略图 + 项目名 + 相对编辑时间）。
  - W3C APG Grid / Toolbar 与双主题语义令牌规范（`@lfaa/ui-theme/client/tokens.css`）：零写死色值，窄栏通过容器查询自适应。
- **候选方案与取舍**：
  - A. 给项目实体新增 `kind: "canvas"` 字段：会侵入 `@lfaa/workspace` 持久化模型与所有项目消费方，且历史已有画布的项目无法自动识别，否。
  - B. Host 侧 `@lfaa/canvas` 新增 `POST /api/canvas/projects/summaries` 按 `projectIds` 探测真实画布目录，返回有画布的项目摘要（画布数、最近更新时间、封面资产 URL）（采用）：不改项目模型、天然兼容历史画布，且项目新建后立即初始化默认画布即可 100% 稳定出现在列表。
- **结论**：复用现有 `@lfaa/workspace` 项目创建与 `@lfaa/canvas` 持久化，扩展最小契约并新增前端大厅组件，无新增第三方依赖。

## 3. 详细设计

### 3.1 后端与契约扩展（`@lfaa/canvas`）

- `packages/media/canvas/contract/index.ts` 新增：
  ```ts
  export interface CanvasProjectSummary {
    projectId: string;
    boardCount: number;
    latestCanvasId: string;
    latestTitle: string;
    updatedAt: number;
    coverAssetId?: string;
  }
  ```
- `packages/media/canvas/src/canvas-store.ts` 新增 `summarizeProject(projectId)`：
  - 读取该项目目录下所有有效 `board.json`，结合文件 `mtimeMs` 计算 `updatedAt`；
  - 若存在图片资产，返回最近更新画布的 `coverAssetId` 供卡片渲染缩略图；
  - 无画布时返回 `null`。
- `packages/media/canvas/src/canvas-service.ts` 与 Web 路由新增：
  - `POST /api/canvas/projects/summaries`：接收 `{ projectIds: string[] }`，返回 `{ items: CanvasProjectSummary[] }`（仅包含至少有 1 块画布的项目）。

### 3.2 左二栏项目同步与一键快建（`@lfaa/ui-layout` + `@lfaa/client-ui-workspace`）

- 在 `WorkbenchProjectProvider`（`packages/ui/layout/contract/index.ts`）新增可选方法：
  - `quickCreateProject?: (name?: string) => Promise<{ id: string; name: string }>`
- 在 `packages/client/ui-workspace/client/index.tsx` 实现 `quickCreateProject`：
  - 调用 `store.resolveProjectPath(baseName)` 在默认工作区自动解析不重名目录；
  - 调用 `store.createProject({ name, trusted: true, confirmedDefaultPath })` 创建项目并自动刷新左二会话项目菜单栏状态；
  - 返回新建的 `{ id, name }`，供画布大厅立即初始化默认画布、激活项目并进入编辑器。

### 3.3 「我的项目」大厅页（`@lfaa/client-ui-canvas`）

新增独立模块（遵守 250/400 行小文件规范与单向目录规则）：

- `packages/client/ui-canvas/client/projects/Canvas-Projects-Hub.tsx`
- `packages/client/ui-canvas/client/projects/Canvas-Projects-Hub.module.css`
- `packages/client/ui-canvas/client/projects/project-hub-helpers.ts`（排序、搜索过滤、相对时间格式化）
- `packages/client/ui-canvas/client/projects/project-hub-helpers.test.ts`

页面结构与交互：

1. **顶栏**：
   - 左侧：「我的项目」标题；
   - 右侧控件组：
     - 缩放滑块（`-` 滑块 `+`，网格视图调节卡片宽度 `12rem`–`22rem`，记住本地偏好）；
     - 搜索（点击放大镜展开或输入关键字，按项目名实时筛选）；
     - 排序切换（最近编辑 / 名称）；
     - 视图切换分段（网格 / 列表）；
     - 「`+ 新建`」主按钮（打开左二栏同款创建项目弹窗）。
2. **主体内容**：
   - **网格模式**：
     - 首卡固定为虚线边框「`+ 新建项目`」卡片（点击调用 `quickCreateProject("未命名项目")` → 自动建默认画布 → 左二栏收录并激活 → 直接进入画布编辑器）；
     - 项目卡片：16:10 封面区（有 `coverAssetId` 时加载鉴权缩略图，无图时显示低对比图标占位）+ 项目名 + 相对更新时间（如「编辑于 刚刚 / 2 小时前」）。
   - **列表模式**：
     - 顶部快捷「`+ 新建项目`」行 + 紧凑项目列表行（小缩略图 + 名称 + 画布数 + 更新时间）。
   - 底部轻提示：「没有更多项目了」（无匹配搜索结果时给出一句话空态）。
3. **状态切换与返回**：
   - `CanvasWorkspace` 新增 `mode: "hub" | "editor"` 状态，默认 `"hub"`；
   - 选择已有项目或新建项目后：调用 `workbench.setActiveProject(projectId)`，确保项目已有至少 1 块画布，切到 `"editor"`；
   - `CanvasTopBar` 左上角新增独立的「返回项目」按钮（点击切回 `"hub"` 并刷新摘要列表）。

## 4. 风险与边界

- **无 `quickCreateProject` 时的兜底**：若 `projectProvider` 未提供 `quickCreateProject`，首卡回退为打开 `renderCreateDialog` 弹窗，不报错。
- **并发防重复点击**：一键快建过程中禁用首卡并显示「创建中…」，避免连续点击建出重复「未命名项目」。
- **双主题与窄栏**：全部消费 `@lfaa/ui-theme` 语义变量（零硬编码色值），支持右栏半屏与最大化两种宽度。

## 5. 验证计划

1. 后端单测：`packages/media/canvas/tests/` 新增 `listProjectSummaries` 用例（只返回有画布项目、含画布数/更新时间/封面）。
2. 前端单测：`project-hub-helpers.test.ts` 覆盖排序、搜索过滤与相对时间格式化。
3. 构建与门禁：`pnpm build:lib`、`pnpm build:web`、`pnpm lint`、`pnpm check`、`pnpm verify:web`。
4. 后端重启与内置浏览器双主题实测：重启本地 5173 服务，实测「打开无限画布 → 我的项目大厅 → 首卡一键快建 → 左二栏同步收录 & 进入画布 → 返回项目 → 顶栏 `+ 新建` 弹窗创建 → 缩放/搜索/排序/网格列表切换 → 浅色与深色主题」，确认控制台 0 报错。
