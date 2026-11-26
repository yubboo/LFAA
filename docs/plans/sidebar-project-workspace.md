# 左二栏「项目工作区」切换方案

- 状态：待评审
- 日期：2026-11-26
- 涉及包：`@lfaa/ui/layout`、`@lfaa/client/ui-chat`
- 关联：DEV-000537 / DEV-000538（左二栏盒层收口、工具栏拆胶囊）

## 1. 目标

1. 左二工具栏的 `+`（与下方「新聊天」重复）改为「项目工作区」入口。
2. 相邻的 `▤`（原「收起左二栏」）改为「会话列表」入口；两个按钮互斥切换左二内容，来回点即可换回。
3. 把右侧「工作区文件」那棵树移进左二，作为「项目工作区」的内容；右栏不再保留文件树入口。**组件与图标全部复用，不新画，不改既有图标。**
4. 点文件的行为不变：中间工作台打开，右栏出编辑标签。

## 2. 现状与约束

- 树组件 `RightFileTreePane` 属于 `ui-chat`，直接依赖 `ChatClientStore`、`/api/projects/:id/inspect`、树展开状态持久化与「当前打开文件」联动；`ui-layout` 不能反向 import `ui-chat`。
- 左二内容由 `WorkbenchDomainConfig` 决定：`workspace` 域固定渲染 `NavigationGroups`，其余域走 `DomainSidebarMenu` / `SettingsMenu`。
- 右栏「工作区文件」= `RightWorkbenchPane` 的一个 stage + `RightUtilityRail` 里的 `filesTree` 图标条目。
- 收起左二的入口在中间栏 `WorkspaceBar` 已有 `PanelToggleButton`（`onToggleLeft`），header 的 `▤` 不是唯一入口。
- 左二默认宽度 208px，支持拖到 25%；本次不为窄栏做特例。

## 3. 方案

### 3.1 契约（`@lfaa/ui/layout/contract`）

- `WorkbenchChatProvider` 增加可选槽位：`renderProjectWorkspace?: (params: { projectId: string | null; compact: boolean }) => TContent`。
- 不新增 region、不改四栏轨道、不动 `workspace` 域的四栏属性。

### 3.2 左二模式（`ui-layout`）

- 新增 `sidebarMode: "chats" | "project"`，由 `WorkbenchShell` 持有，沿用 `ui-preferences` 的偏好存储（键 `lfaa:sidebar-mode`），刷新后保持。
- `NavigationSidebar` 在 `workspace` 域下按模式分支：`chats` 渲染 `NavigationGroups`；`project` 渲染 `chatProvider.renderProjectWorkspace(...)`；没有 provider 时显示中性空态，不伪造假树。
- 切口位置在「内容区」内部，`aside` 的 grid（3.5rem 头部 + 1fr 内容）与滚动归属不变。

### 3.3 工具栏

- `+` → 「项目工作区」：复用 `project` 图标，`aria-pressed` 跟随模式，选中用现有 `headerButtonActive`。
- `▤` → 「会话列表」：图标保持 `sidebarLeft` 不变，`aria-pressed` 与前者互斥。
- 两个按钮仍在左侧动作组内，尺寸 2rem、间距沿用现有规则；不新增胶囊或卡片。

### 3.4 右栏

- 移除 `RightUtilityRail` 的 `filesTree` 条目与 `RightWorkbenchPane` 的「工作区文件」tab / stage；其余 stage（变更、终端、子智能体、侧边提问、上下文、审查、扩展）保持原样。
- 文件打开链路不动：仍走 `openWorkspaceFile`，中间工作台打开、右栏出编辑标签、树内高亮跟随。

## 4. 本方案不做

- 不实现「预览区在左 / 聊天区在左」的布局偏好与新手引导，那是后续独立任务；本方案只保证文件打开链路可被后续设置接管。
- 不重画图标、不改主题变量、不改四栏轨道、不动会话列表本身的排序与折叠逻辑。

## 5. 预计文件清单

| 操作 | 路径 | 目的 |
|---|---|---|
| 修改 | `packages/ui/layout/contract/index.ts` | 增加 `renderProjectWorkspace` 槽位 |
| 修改 | `packages/ui/layout/client/navigation/NavigationSidebar.tsx` | 两个按钮与模式分支 |
| 修改 | `packages/ui/layout/client/navigation/NavigationSidebar.module.css` | 复用选中态，必要时补一行 |
| 修改 | `packages/ui/layout/client/shell/WorkbenchShell.tsx` | 持有并传入 `sidebarMode` |
| 修改 | `packages/ui/layout/client/shell/ui-preferences.ts` | 增加 `lfaa:sidebar-mode` 读写 |
| 修改 | `packages/ui/layout/client/locales.ts` | 两个按钮中英文案 |
| 修改 | `packages/client/ui-chat/client/index.tsx` | 实现 `renderProjectWorkspace` |
| 新增 | `packages/client/ui-chat/client/workbench/ProjectWorkspacePane.tsx` | 左二树容器（复用 `RightFileTreePane`） |
| 修改 | `packages/client/ui-chat/client/workbench/RightUtilityRail.tsx` | 移除 `filesTree` 条目 |
| 修改 | `packages/client/ui-chat/client/workbench/RightWorkbenchPane.tsx` | 移除文件树 stage |

## 6. 验收标准

- 点「项目工作区」：左二切成文件树，按钮高亮；点「会话列表」：切回会话列表，高亮互斥；来回点不丢当前会话。
- 树：根目录、展开/收起、缩进指引线、语义图标、懒加载、点文件在中间打开、右栏出编辑标签、当前文件高亮都保持。
- 右栏不再出现「工作区文件」入口；收起左二仍可从中间栏按钮完成。
- 刷新后停在上次模式；切换左二高亮的项目后，树跟随切换根目录。
- 深色 / 浅色、1440 / 1280 / 平板抽屉实测；`pnpm check`、`lint`、`typecheck`、`test`、`build:web`、`verify:web` 全部通过。

## 7. 风险与回退

- 左二 208px 下长路径会挤压：允许拖宽解决，不加窄栏特例。
- 移除 `▤` 的「收起」语义：收起入口仍在中间栏，按钮 tooltip 会写明「会话列表」，避免误解。
- 右栏移除文件树后，若默认 stage 指向它，需要回退到剩余 stage 中的第一个。
- 回退：两个按钮与模式分支、右栏入口都是独立改动，可按包回滚，不影响已完成的 DEV-000537 / 000538。