# 统一回收站（Unified Recycle Bin）开发方案

> 状态：待负责人评审确认后开工（A1 跨包新功能）
> 日期：2026-11-27

## 1. 目标与范围

为 LFAA 建立**统一的软删除与 30 天回收站机制**，覆盖用户已确认的全部对象类型与双入口交互：

1. **纳入对象（四类统一管理）**：
   - `media`：资料库生成素材（图片、视频）
   - `asset`：资料库资产/产物（上传文件、文档、导出产物）
   - `canvas`：无限画布中的单张画布（保留所属项目 `originLabel` 与原始 `projectId / canvasId`）
   - `project`：项目（含项目注册记录与关联画布目录索引，不误删用户硬盘上的源代码仓库）
2. **双入口共用同一套后端数据**：
   - **资料库左二栏「回收站」分类页**（`LibraryTabKey` 新增 `"trash"`）：支持按类型筛选（全部 / 素材 / 资产 / 画布 / 项目）、关键词搜索、全选、批量恢复、批量彻底删除（二次确认）。
   - **无限画布「我的项目」顶栏回收站入口弹窗**（对齐参考图）：点击顶栏回收站图标弹出居中大弹窗，标题「回收站 · 仅显示最近 30 天内删除的内容」，卡片左上角勾选框、显示缩略图/标题/删除日期 + `剩余 N 天` + `原位置: <项目名>`，底栏左侧「全选 · 已选择 N 项」，右侧「彻底删除」与「恢复」。
3. **保留与清理策略**：
   - 软删除条目默认保留 **30 天**，超时在服务启动与列表读取时自动惰性清理（永久移除回收站载荷）。
   - 手动「彻底删除」必须经过二次确认，执行后彻底释放磁盘占用且不可恢复。

## 2. 调研与参考

- **本仓库已有实现（2026-11-27 查阅）**：
  - `packages/media/canvas/src/canvas-store.ts`：`deleteBoard` 当前直接 `rmSync(..., { recursive: true, force: true })` 硬删除，改造为移入回收站目录并写入元数据即可零损可逆。
  - `packages/media/tool-media/src/media-http.ts`：`/api/media/library` 与 `/api/media/file` 管理统一生成素材，目前无删除接口，可补充 `DELETE /api/media/library` 转入统一回收站。
  - `packages/workspace/workspace/src/project-store.ts`：`removeProject` 当前从 `projects.json` 直接移除记录，改造为将项目快照写入回收站并保留其 `id / name / path / sectionId / pinned` 元数据，恢复时原位写回 `projects.json` 且画布目录自动重新关联。
  - `packages/ui/layout/client/shell/library-tabs.ts` 与 `packages/client/ui-library/client/views/LibraryView.tsx`：资料库左二分类通过 `LibraryTabKey` 统一管理（`"all" | "media" | "artifact" | "asset" | "memory"`），新增 `"trash"` 可无缝接入现有四栏架构。
- **行业标准与公开参考（2026-11-27 查阅）**：
  - [FreeDesktop.org Trash Specification 1.0](https://specifications.freedesktop.org/trash-spec/trashspec-latest.html)：经典 `files/`（原文件/目录载荷）+ `info/<id>.trashinfo`（原路径、删除时间、类型元数据）两段式落盘结构，天然支持原子移动、跨类型恢复与冲突重命名。
  - 负责人提供的参考设计图：卡片式回收站弹窗、左上角多选框、底部全选统计与恢复按钮、30 天剩余天数与「原位置」标注。
- **候选方案与取舍**：
  - **方案 A（采用）：在 `packages/host/web-server`（或独立轻量存储模块 `trash-store.ts`）提供统一 `TrashStore` + `/api/trash/*` REST 接口**，所有软删除对象落盘到 `<dataDir>/trash/items/<trashId>/`（`meta.json` + `payload/`）。
    - 优点：不新增冗余散包、不破坏 `dependency-rules.json` 依赖方向；资料库前端（`ui-library`）与画布前端（`ui-canvas`）共用同一套 `/api/trash` 契约与共享组件，零重复造轮子；单测完全独立可测。
  - **方案 B（否决）：每个业务包各自建一套回收站目录与接口**。
    - 缺点：资料库无法统一展示跨模块删除记录，30 天清理与批量恢复逻辑要写四遍，维护成本高。

## 3. 架构与接口设计

### 3.1 磁盘存储结构（`<dataDir>/trash/`）

```text
<dataDir>/trash/
└── items/
    └── <trashId>/
        ├── meta.json        # TrashItemMeta（类型、标题、原位置、删除时间、过期时间、缩略图相对路径、恢复所需上下文）
        └── payload/         # 可选：被移入的画布目录 / 素材文件 / 资产文件
```

`TrashItemMeta` 契约：

```ts
export type TrashItemKind = "media" | "asset" | "canvas" | "project";

export interface TrashItem {
  id: string;
  kind: TrashItemKind;
  title: string;
  deletedAt: number;
  expiresAt: number;         // deletedAt + 30 * 86400_000
  remainingDays: number;     // 向上取整 1..30
  originLabel?: string;      // 如「原位置：未命名项目」或「资料库 · 图像」
  previewUrl?: string;       // `/api/trash/<id>/preview`（有封面/图片时）
  sizeBytes?: number;
  origin: Record<string, unknown>; // 恢复所需的原始路径/projectId/canvasId/projectRecord
}
```

### 3.2 HTTP 接口契约

| 方法 | 路径 | 职责 |
|---|---|---|
| `GET` | `/api/trash?kind=all\|media\|asset\|canvas\|project` | 列出未过期回收站条目（自动触发过期清理），按 `deletedAt` 倒序 |
| `GET` | `/api/trash/:id/preview` | 返回回收站内图片/画布封面的预览图 |
| `POST` | `/api/trash/restore` | 批量恢复 `{ ids: string[] }`，返回 `{ restored: string[], failed: { id, reason }[] }` |
| `POST` | `/api/trash/purge` | 批量彻底删除 `{ ids: string[] }`（永久释放磁盘），返回 `{ purged: string[] }` |
| `DELETE` | `/api/trash/empty` | 清空全部（或指定 `kind`）回收站 |
| 现有删除改造 | `DELETE /api/canvas/projects/:id/boards/:canvasId` | 默认软删除进入回收站（支持 `?permanent=1` 跳过） |
| 现有删除改造 | `DELETE /api/workspace/projects/:id` | 默认软删除进入回收站（保留用户磁盘代码仓库，仅软删项目注册与画布归属） |
| 新增删除入口 | `DELETE /api/media/library`（`{ path }`） | 将资料库生成图片/视频软删除移入回收站 |
| 现有删除改造 | 资料库资产删除接口 | 软删除移入回收站 |

### 3.3 恢复冲突处理

- **画布恢复**：若原 `projectId` 仍在，直接迁回原项目画布目录；若原项目也在回收站中，先提示或自动一并恢复原项目，保证恢复后立即可见。
- **项目恢复**：将项目快照写回 `workspace` 注册表，同名冲突自动加 ` (恢复)` 后缀，左二栏实时刷新。
- **素材/资产恢复**：移回原目录路径；若目标路径已存在同名文件，自动生成不冲突文件名。

### 3.4 前端双入口交互

1. **资料库左二栏「回收站」页**（`packages/client/ui-library`）：
   - `LibraryTabKey` 扩展 `"trash"`，左二栏底部新增「回收站」分组项（带角标数量）。
   - 主区域采用无外框极简网格卡片 + 左上角勾选框 + 分类筛选胶囊（全部 / 素材 / 资产 / 画布 / 项目）+ 底部批量操作条（全选 / 彻底删除 / 恢复）。
   - 同时在资料库素材网格与资产检视器补齐「移至回收站」删除按钮。
2. **无限画布「我的项目」回收站弹窗**（`packages/client/ui-canvas`）：
   - 「我的项目」顶栏工具条增加回收站图标按钮（有回收项时显示微标），点击打开参考图风格的居中弹窗。
   - 默认展示 `canvas` 与 `project` 类型的回收记录（可一键切换查看全部），完全复用同一套 `/api/trash` 接口，恢复项目或画布后即时刷新「我的项目」与左二栏。

## 4. 分阶段实施与验证计划

1. **阶段 1（后端统一回收站底座 + 单测）**：实现 `TrashStore`、30 天自动过期清理、`/api/trash/*` 路由，并接通画布删除、项目删除、生成素材删除与资料库资产删除的软删除与恢复闭环；补齐后端单元测试（软删、恢复、过期清理、彻底删除）。
2. **阶段 2（双入口前端 UI + 双主题适配）**：接入资料库「回收站」分类页、素材/资产删除按钮，以及无限画布「我的项目」顶栏回收站弹窗（对齐参考图与 `@lfaa/ui-theme` 双主题变量）。
3. **阶段 3（全量门禁与真机浏览器验收）**：重启本地 `pnpm lfaa web`（5173），执行 `pnpm build:lib`、`pnpm build:web`、`pnpm lint`、`pnpm check` 与内置浏览器深/浅双主题端到端实测（删除画布/项目/素材 → 进入回收站可见 → 勾选恢复回到原位 → 彻底删除二次确认）。

## 5. 风险与边界

- **用户代码仓库安全**：删除项目进入回收站或彻底删除项目时，**绝不删除用户本地硬盘上的源代码目录**，仅管理 LFAA 内的项目注册信息与画布资产，避免误删用户代码。
- **磁盘空间**：30 天自动清理 + 手动彻底删除可防止大视频/图片长期占用磁盘。
