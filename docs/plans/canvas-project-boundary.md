# 无限画布项目边界、分类文件夹、默认工作区隔离与双向同步开发方案

> 状态：待负责人审阅（2026-11-28）
> 关联模块：`@lfaa/workspace`、`@lfaa/media/canvas`（`@lfaa/canvas`）、`@lfaa/client-ui-canvas`、`@lfaa/client-ui-workspace`、`@lfaa/ui-layout`、`@lfaa/settings`

## 1. 背景与核心目标

无限画布未来承载 **AI 短剧 / 视觉多模态创作**（生图、生视频、结合小说/剧本、专属短剧 Agent），与写代码的 **代码 Agent / 代码项目** 属于同一套底层 Agent 底座下的两个独立领域。当前画布大厅直接读取左二全部项目，导致：

- 代码项目（如 `lfaa`）会出现在画布大厅，存在误删风险；
- 缺少画布分类文件夹，大厅右上角「+ 新建」与首卡「+ 开始创作」职责重叠；
- `default-workspace` 未做代码/画布子区隔离，也不支持彻底删除整个默认工作区。

本方案确立四条硬规则：

1. **项目边界**：非画布创建的项目（`kind: "workspace"`，如 `lfaa`）绝不进入无限画布；只在无限画布通过「+ 开始创作」创建的项目（`kind: "canvas"`）才进入画布大厅，并由左二栏以画布专属图标统一收录。
2. **默认工作区样板 + 可整删**：保留「默认工作区」在画布大厅作为新手可进入体验的样板（画布侧不可删），但在左二菜单支持「删除工作区」（二次确认），确认后删除 `default-workspace` 目录并记录不再自动重建，左二与画布大厅同步消失。
3. **画布入口分工（对标 LibTV / 即梦 AI）**：「+ 开始创作」卡片 = 新建画布项目；右上角「+ 新建」按钮 = 新建画布分类文件夹。
4. **物理目录平级隔离**：所有目录统一收在设置中心「默认新建项目目录」（默认 `D:\Documents\lfaa`，随用户设置同步）。

## 2. 调研与参考

- 2026-11-28 检索仓库既有实现：
  - `packages/workspace/workspace/src/default-workspace.ts` 与 `packages/core/settings/src/general-settings.ts`：已存在 `DEFAULT_WORKSPACE_PROJECT_ID` 与「默认新建项目目录」配置（`D:\Documents\lfaa`）。
  - `packages/media/canvas/` 与 `packages/client/ui-canvas/client/projects/{Canvas-Projects-Hub.tsx,Canvas-Trash-Modal.tsx}`：画布大厅与回收站弹窗已具备基础骨架，但 `Canvas-Workspace.tsx` 仍借用左二全部项目且对空项目自动建板。
  - `packages/ui/primitives/`：已提供破坏性二次确认弹窗 `ConfirmDialog`（符合 `docs/standards/floating-cards.md §9` 与 `docs/standards/dialogs.md`）。
- 外部产品交互参考：LibTV、即梦 AI 的「+ 开始创作（建项目）」与「+ 新建（建分类文件夹）」双入口心智（仅参考交互分工，无外部源码或依赖引入）。

## 3. 物理目录与数据契约设计

### 3.1 磁盘目录结构（跟随设置中心「默认新建项目目录」）

```text
<defaultProjectsDir>/                   # 默认 D:\Documents\lfaa（用户在设置中心可改）
├── default-workspace/                  # 默认工作区整体（用户不想要时可二次确认整删）
│   ├── code/                           # 默认代码工作区（代码 Agent 读写）
│   └── canvas/                         # 默认工作区画布区（短剧/画布体验样板）
├── <canvas-project-name>/              # 平级：画布「+ 开始创作」新建的独立画布/短剧项目
└── <code-project-name>/                # 平级：左二按名称新建的代码项目
```

- **安全边界与默认回退**：
  - **未绑定项目时的系统默认兜底**：当用户未创建或未绑定任何项目直接对话时，Agent 依然默认使用设置中心「默认工作区」（`D:\Documents\lfaa\default-workspace`）管理——代码/工作对话落在 `default-workspace/code/`，默认画布样板落在 `default-workspace/canvas/`，保持与设置中心「默认工作区：未关联项目时，默认使用这个工作区」完全一致；
  - 彻底删除单个画布项目时，后端仅删除该画布项目自身目录与画布数据，绝不触碰父目录或其他平级项目；
  - 删除「默认工作区」时，仅删除 `<defaultProjectsDir>/default-workspace/`，不影响其他平级画布项目与代码项目；同时持久化 `defaultWorkspaceDismissed: true`，后续重启不再自动重建并从左二与画布大厅隐藏。若删除后用户在未绑定任何项目的情况下再次发起「工作」模式对话，由运行时按需提示绑定项目或一键恢复默认工作区（绝不直接因目录不存在报错崩溃）。

### 3.2 项目模型扩展（`@lfaa/workspace`）

- `WorkspaceProjectSummary` 新增字段：
  - `kind?: "workspace" | "canvas"`（缺省兼容旧数据视为 `"workspace"`）；
  - `trashedAt?: number | null`（软删除时间戳：非空表示已进入回收站，默认列表不返回）；
  - `canvasFolderId?: string | null`（画布大厅分类文件夹归属，仅 `kind === "canvas"` 使用）。
- 公开 API 扩展：
  - `createProject` 支持传 `kind: "canvas"` 与 `canvasFolderId`，自动在 `<defaultProjectsDir>/<name>` 下平级建目录；
  - `trashProject(id)` / `restoreProject(id)` / `purgeProject(id)`：对 `kind === "canvas"` 项目实现「移入回收站 ↔ 还原 ↔ 彻底删除」，并广播项目列表刷新事件；
  - `deleteDefaultWorkspace()`：删除 `default-workspace` 目录 + 写入 `defaultWorkspaceDismissed` 标记 + 从项目列表移除。

### 3.3 画布分类文件夹（`@lfaa/canvas`）

- 在 `@lfaa/canvas` 持久化 `folders.json`（`{ id, name, createdAt, updatedAt }`），提供 `/api/canvas/folders` 的 `GET / POST / PATCH / DELETE`。
- 删除文件夹默认只解绑内部项目的 `canvasFolderId = null`（项目安全退回根目录，不误删项目）。

## 4. 界面与交互边界

### 4.1 左二会话菜单栏（`@lfaa/ui-layout` + `@lfaa/client-ui-workspace`）

- **统一收录 + 明确标识**：
  - `kind === "workspace"`：沿用文件夹图标；
  - `kind === "canvas"`：使用画布专属图标（或画布微标），一眼区分代码项目与画布项目；
  - 点击画布项目时同步激活该项目并切入/聚焦无限画布。
- **删除联动**：
  - 在左二删除 `kind === "canvas"` 项目 → 走软删进画布回收站（左二立即消失，画布大厅移入回收站，可还原）；
  - 在左二「默认工作区」的 `...` 菜单新增红色「删除工作区」→ 弹出 `@lfaa/ui-primitives` 的 `ConfirmDialog` 二次确认（明确展示 `D:\Documents\lfaa\default-workspace` 路径与后果），确认后删除目录并同步从左二与画布大厅移除。

### 4.2 无限画布「我的项目」大厅（`@lfaa/client-ui-canvas`）

- **可见范围**：只显示「未进回收站的 `kind === "canvas"` 项目」+「未被用户删除的 `默认工作区`（带「样板」标签，画布侧无删除入口）」；`lfaa` 等代码项目彻底不可见。
- **两个新建入口**：
  - 网格首卡「**+ 开始创作**」：创建新画布项目（在某文件夹内点击则直接归入该文件夹），同步出现在左二栏；
  - 右上角「**+ 新建**」（文案明确为「新建文件夹」或带文件夹图标）：新建画布分类文件夹，支持点击进入文件夹（顶部面包屑返回「我的项目」）、重命名、卡片菜单「移动到文件夹 / 移出文件夹」、删除文件夹。
- **回收站双向同步**：
  - 大厅删除画布项目 → 移入回收站 + 左二同步消失；
  - 回收站「还原」→ 大厅与左二同步恢复；
  - 回收站「彻底删除」→ 清理画布数据与回收站记录。

## 5. 分阶段实施计划

1. **阶段 1（契约与后端）**：`@lfaa/workspace` 补齐 `kind`、`trashedAt`、`canvasFolderId`、`defaultWorkspaceDismissed`、`code/` + `canvas/` 子目录隔离及 `deleteDefaultWorkspace` / 回收站 API；`@lfaa/canvas` 补齐 `/api/canvas/folders` CRUD 与路径安全校验，补齐单测。
2. **阶段 2（左二栏标识与删除联动）**：`@lfaa/ui-layout` 为 `kind === "canvas"` 项目渲染画布专属图标；`@lfaa/client-ui-workspace` 接入画布项目软删进回收站，以及「默认工作区 → 删除工作区」的 `ConfirmDialog` 二次确认流。
3. **阶段 3（画布大厅文件夹与双向同步）**：`@lfaa/client-ui-canvas` 过滤掉代码项目、保留「默认工作区（样板，不可删）」、将「+ 开始创作」定为唯一新建项目入口、将右上角「+ 新建」改为新建分类文件夹并接通文件夹浏览/移动/删除与回收站双向同步。
4. **阶段 4（全链路验收）**：补齐单测、`pnpm check` / `pnpm lint` / `pnpm build:web` / `pnpm verify:web`，并在内置浏览器实测深/浅双主题下的新建项目、建文件夹、左二与画布双向删除/还原及默认工作区二次确认删除全流程。
