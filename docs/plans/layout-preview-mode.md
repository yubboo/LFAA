# 「预览区在左 / 聊天区在左」布局切换方案

- 状态：已实施（步骤 1–3 完成：偏好 / 服务 / 设置项、两列落位、拖拽宽度与折叠语义、图标轨靠左）
- 日期：2026-11-26
- 涉及包：`@lfaa/ui/layout`、`@lfaa/client/ui-chat`（少量）、`@lfaa/client/ui-chat` 的设置页
- 关联：DEV-000539（左二项目工作区）

## 1. 目标

1. 设置中心新增「页面排版」一项，两个取值：
   - **聊天区在左**（默认，即现状）：中间是 AI 会话，右侧是预览区（文件预览 / 编辑器标签 / 终端 / 子智能体 / 浏览器）。
   - **预览区在左**：中间是预览区（代码与文件为主），右侧是 AI 会话；左一、左二（图标栏 + 项目工作区/会话列表）不变。
2. 两种模式共用同一套数据与状态：会话、打开的编辑标签、终端、子智能体都不因切换而重建或丢失。
3. 窄屏（`< 1024px`）与平板抽屉一律回退「聊天区在左」，不出现第二套移动端布局。

## 2. 现状与约束

- 中心列 `ShellWorkspace`：渲染 `snapshot.views.find(id === activeView).render()`，顶部是 `WorkspaceBar`（标题、左右栏开关、标题动作、工作区动作）。
- 右栏 `ShellRightColumn → ContextPanel`：渲染聊天插件注册的 `agent-capabilities` 面板（`chrome: "workbench"`，内含标签栏、舞台、最右图标轨与辅助栏）。
- 四栏轨道由 `WorkbenchShell` 的 CSS 变量控制（`--left-pane-track` / `--center-pane-track` / `--right-pane-track`），宽度、拖拽、折叠、最大化都挂在轨道上。
- 聊天与预览目前分属「视图」和「上下文面板」两套注册通道，Shell 只负责摆位。

## 3. 方案

### 3.1 偏好

- 新增 `lfaa:layout-mode`，取值 `chat-center`（默认）/ `preview-center`，读写放在 `ui-preferences`，刷新后保持。
- 设置中心「页面排版」一行使用分段控件（两项 + 说明文案），遵循「一项设置一行、控件右对齐」的设置规范。

### 3.2 轨道与内容对调

轨道顺序（左一 → 左二 → 中 → 右）不变，只改每一列渲染什么：

| 模式 | 中间列 | 右侧列 |
|---|---|---|
| `chat-center` | 视图（会话 / 资料库 / 设置页等） + `WorkspaceBar` | 上下文面板（工作台） |
| `preview-center` | 工作台（编辑器标签、预览、终端、子智能体、浏览器） + 工作台顶栏 | 会话 + 精简顶栏（标题、模型/权限动作、折叠） |

- 内容不搬家、不复制：会话仍由 `views` 里的 `workspace` 视图渲染，预览仍由 `ContextPanel` 渲染，只把两个「槽」按模式互换。
- 中间列在 `preview-center` 下使用编辑器最小宽度（沿用 `--center-min-width`，不新增比例）；右侧会话列新增独立宽度偏好 `lfaa:chat-pane-width`，默认 420px，可拖 320–720px。

### 3.3 契约

- `@lfaa/ui/layout` 的 `WorkbenchChatProvider` 增加：
  - `renderChatPane?: (params: { compact: boolean }) => TContent`：会话正文 + 输入框（不含 Shell 顶栏）。
  - `renderPreviewPane?: (params: { compact: boolean }) => TContent`：工作台内容（标签栏 + 舞台 + 图标轨），复用现有 `RightWorkbenchPane`。
- Shell 只做摆放与顶栏拼装；聊天与预览的内部状态仍由各自包持有。
- 未提供这两个槽位的插件（资料库、插件页等）在 `preview-center` 下仍然占据中间列，右侧保持上下文面板，避免空壳。

### 3.4 顶栏与动作归属

- 标题动作（模型、权限、会话模式）跟随**会话**：`preview-center` 下渲染在右侧会话顶栏。
- 工作区动作（如代码审查、扩展入口）跟随**工作台**：`preview-center` 下渲染在中间工作台顶栏。
- 左右栏开关保持同一语义：左 = 左二栏，右 = 按模式指向「会话/工作台」那一列。

### 3.5 交互与焦点

- `Ctrl+K` 搜索、`Ctrl+Alt+U` 活动、`Ctrl+Shift+M` 最大化右栏：最大化语义改为「最大化当前模式下的次列」（`chat-center` 最大化工作台，`preview-center` 最大化会话）。
- 焦点顺序按视觉顺序（左一 → 左二 → 中间 → 右侧），切换模式后不抢焦点。
- 文件打开链路不变：左二文件树点文件 → 中间工作台打开（`preview-center` 下正好是中间），右栏不再插一层。

## 4. 本方案不做

- 新手引导本身（负责人另做）；方案只保证设置项可被引导读取与设置。
- 每个项目单独记忆布局、布局跟随会话。
- 手机端第二套布局（一律回退 `chat-center`）。
- 预览区支持多标签独立分栏（保持现有标签栏行为）。

## 5. 预计文件清单

| 操作 | 路径 | 目的 |
|---|---|---|
| 修改 | `packages/ui/layout/client/shell/ui-preferences.ts` | `lfaa:layout-mode` 与 `lfaa:chat-pane-width` 读写 |
| 修改 | `packages/ui/layout/client/shell/WorkbenchShell.tsx` | 模式分支、两列内容对调、宽度语义 |
| 修改 | `packages/ui/layout/client/shell/ShellWorkspace.tsx` / `ShellRightColumn.tsx` | 抽出可复用「槽」，按模式渲染视图或面板 |
| 修改 | `packages/ui/layout/client/shell/WorkspaceBar.tsx` | 精简顶栏：标题动作/工作区动作按归属渲染 |
| 修改 | `packages/ui/layout/contract/index.ts` | `renderChatPane` / `renderPreviewPane` |
| 修改 | `packages/ui/layout/client/locales.ts` | 「页面排版」「预览区在左」「聊天区在左」文案 |
| 修改 | `packages/client/ui-chat/client/index.tsx` | 注册两个槽位 |
| 修改 | `packages/client/ui-chat/client/settings/GeneralSettingsGeneralGroup.tsx` | 设置项（分段控件） |
| 新增 | `packages/ui/layout/tests/layout-mode.test.tsx` | 两种模式的渲染与窄屏回退 |
| 修改 | 现有 `settings-*` / `workspace-bar-toggle` 测试 | 适配新顶栏与默认模式 |

## 6. 验收标准

- 设置中心切换两种模式：中间与右侧内容互换，会话、打开的文件标签、终端与子智能体状态不丢。
- 拖拽宽度、折叠、最大化在两个模式下都正常；切换模式后宽度偏好各自记住。
- 窄屏与平板抽屉仍然只有「聊天区在左」，不出现空列或双会话。
- 深色 / 浅色、1440 / 1280 / 平板 / 手机逐档实测；`pnpm check`、`lint`、`typecheck`、`test`、`build:web`、`verify:web` 全绿。

## 7. 风险与实施顺序

- **最大风险**：右栏从「工作台」变「会话」后，`ContextPanel` 的 `chrome`/`utility` 契约需要参数化，涉及聊天工作台内部标签与图标轨；建议分三步提交：
  1. 契约 + 偏好 + 设置项（无视觉变化，先让开关存在且可持久化）；
  2. `preview-center` 的静态摆位（先不接拖拽宽度语义，用默认宽度）；
  3. 拖拽、折叠、最大化与快捷键语义补齐。
- 顶栏动作归属如果搞错，会出现「模型选择挂在工作台上」这类错位，验收时逐项确认。
- 回退：偏好默认值即现状，关掉 `preview-center` 就回到当前行为；三步提交可分别回滚。