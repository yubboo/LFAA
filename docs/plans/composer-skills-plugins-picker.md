# 输入栏「技能 / 插件」内联搜索面板与「+」菜单分组优化方案

- 状态：待负责人评审
- 涉及包：`packages/client/ui-chat`（纯前端交互与上下文装配，不改 Host 侧 API 契约）
- 关联规范：`AGENTS.md §0 / §2.2 / §2.6 / §4`、`docs/standards/floating-cards.md`

## 1. 调研与参考

- **本仓库已有实现**：
  - 技能目录：`GET /api/skills?includeDisabled=false` 已在 `packages/client/ui-chat/client/composer/useComposerTriggers.ts` 接入，返回 `{ id, name, description, source }`；
  - 插件目录：`GET /api/plugins` 已在 `packages/client/ui-chat/client/composer/Session-Mode.tsx` 接入并有模块级缓存；
  - 上下文标签（Chip）与注入：`packages/client/ui-chat/client/composer/composer-context.ts` 的 `ComposerAttachment` 与 `buildContextualMessage` 已支持 `mode` / `file` / `folder` / `session` 等上下文块；
  - 输入栏工具条：`packages/client/ui-chat/client/composer/ChatComposer.tsx` 与 `ComposerAddMenu.tsx` 负责 `+` 菜单与底栏控件。
- **外部与产品参考（查阅 2026-11-28）**：
  - 负责人提供的 5 张参考截图（Codex `+` 分组菜单、输入卡片内联「技能 / 插件」搜索面板、输入关键字蓝色高亮匹配、选中后顶部强调色能力标签）；
  - WAI-ARIA Combobox / Listbox 键盘导航规范（`ArrowUp` / `ArrowDown` / `Enter` / `Escape` 与 `aria-activedescendant`）：<https://www.w3.org/WAI/ARIA/apg/patterns/combobox/>
- **方案取舍**：
  - 不另起一套脱离输入框的浮层搜索框，而是**直接复用主输入框本身**进入搜索态（保存原草稿，退出时无损恢复），并在 `composerCard` 内部顶部展开一体化结果面板（与参考图完全一致）；
  - 复用 `ComposerAttachment` 体系新增 `kind: "skill" | "plugin"`，发送时由 `buildContextualMessage` 自动注入能力上下文，避免额外维护第二套附件状态。

## 2. 核心设计

### 2.1 输入栏底栏新增「技能」「插件」入口与内联搜索联动

1. **底栏按钮**（位于 `ChatComposer` 底栏 `controls` 中、`PermissionModePicker` 之后，仅工作模式展示）：
   - **`技能`**（堆叠菱形图标 + 文字 + 轻量右箭头/展开态高亮）
   - **`插件`**（节点连接图标 + 文字 + 轻量右箭头/展开态高亮）
   - 窄宽度下通过容器查询自动收起文字、保留图标 + `HoverTip`，保证底栏永远单行不换行。
2. **「输入框一起变」搜索联动**：
   - 点击 **`技能`** 或 **`插件`** 时，输入栏进入 `capabilitySearchMode: "skill" | "plugin" | null`：
     - 自动暂存当前 `draft` 到 `savedDraftRef`（不丢失用户已经打好的话），并将输入框切为搜索态（占位符变为 `搜索技能…` / `搜索插件…`，外层 `composerCard` 呈现轻微强调色描边反馈）；
     - 在 `composerCard` 内部、输入框上方无缝展开一体化结果区（最大高度 `16rem` 内部滚动），与输入卡片共用同一圆角外壳与细分隔线：
       - **技能面板分组**：
         - `常用`（最近在输入栏使用过的技能/快捷功能，持久化到 `localStorage`，最多 3 条）
         - `快捷功能`（`技能管理` 跳转设置/技能页、`计划` 开启计划模式、`目标` 开启持续目标模式、`打开画布` 直接打开右侧无限画布）
         - `技能 (N)`（来自 `/api/skills?includeDisabled=false` 的真实启用技能列表）
       - **插件面板分组**：
         - `常用`（最近使用过的插件，最多 3 条）
         - `插件 (N)`（来自 `/api/plugins` 的真实已装插件列表，显示名称、简介与启用状态）
     - 输入任意文字时实时过滤列表，并在标题与简介中用强调色（`--color-accent`）高亮命中的关键词片段；
     - 键盘支持：`↑` / `↓` 切换高亮项，`Enter` 执行/选中，`Esc` 或点击外部退出搜索态并自动恢复暂存的原草稿。
3. **选中回显与发送注入**：
   - 选中**快捷功能**（如「打开画布」「技能管理」「计划」「目标」）：直接触发对应动作（计划/目标挂上对应的模式 Chip，打开画布/技能管理直接跳转），关闭搜索态并恢复草稿。
   - 选中**技能**或**插件**：
     - 写入本地「常用」记录；
     - 在输入卡片顶部附件行以强调色能力标签回显（如 `<IconStack2 /> xiaoyu-xiaoban-img ×` / `<IconPlug /> xxx ×`，重复选择自动去重）；
     - 清空搜索词、关闭搜索态、恢复原草稿并聚焦输入框继续打字；
     - 发送消息时，`buildContextualMessage` 自动为每个选中的 `skill` / `plugin` 注入 `[调用技能：name]` / `[调用插件：name]` 上下文块给 Agent。

### 2.2 「+」菜单分组优化（对齐参考图二）

重整 `ComposerAddMenu.tsx` 为清晰分组结构（遵守 `docs/standards/floating-cards.md` 与双主题令牌）：
- **添加**：
  - `文件和文件夹`（合并或保留「文件」「文件夹」，并保留「图片/素材库」入口）
  - `@ 提及`、`操作 /`
  - `目标`（挂载持续目标模式标签）
  - `计划模式`（挂载计划模式标签）
  - `打开画布`（打开右侧无限画布）
- **插件**（下方独立分组，展示已安装的真实插件前 5 项，带图标与简短说明，点击直接挂载插件标签；底部提供「查看全部插件…」一键切到内联插件搜索面板）。

## 3. 模块拆分与文件清单

严格控制单文件行数上限（`*.tsx ≤ 400`、`*.ts ≤ 500`、`*.module.css ≤ 400`）：

| 操作 | 文件路径 | 职责 |
|---|---|---|
| 新增 | `packages/client/ui-chat/client/composer/composer-capabilities.ts` | 技能/插件拉取缓存、常用记录持久化、关键词匹配拆分高亮、分组过滤纯逻辑 |
| 新增 | `packages/client/ui-chat/client/composer/ComposerCapabilityPanel.tsx` | 输入卡片内部一体化搜索结果面板（分组标题、关键词高亮、键盘滚动跟随） |
| 新增 | `packages/client/ui-chat/client/composer/ComposerCapabilityPanel.module.css` | 内联面板、强调色高亮与底部触发按钮样式（纯主题语义变量） |
| 修改 | `packages/client/ui-chat/client/composer/composer-context.ts` | `ComposerAttachment` 扩展 `kind: "skill" \| "plugin"` 与 `buildContextualMessage` 注入 |
| 修改 | `packages/client/ui-chat/client/composer/ComposerAttachmentChip.tsx` | 渲染带强调色图标的 `skill` / `plugin` 能力标签 |
| 修改 | `packages/client/ui-chat/client/composer/ComposerAddMenu.tsx` & `.module.css` | 重整为「添加 + 快捷能力 + 插件」分组菜单 |
| 修改 | `packages/client/ui-chat/client/composer/ChatComposer.tsx` & `ComposerInputRow.tsx` | 接入底栏「技能 / 插件」入口、草稿暂存/恢复与搜索态联动 |
| 新增 | `packages/client/ui-chat/tests/composer-capabilities.test.ts` | 分组过滤、关键词高亮拆分、常用记录与上下文注入单测 |

## 4. 验证计划

1. 单元测试：`pnpm test:pkg packages/client/ui-chat`（覆盖新增 `composer-capabilities.test.ts` 与既有测试）。
2. 构建与护栏：`pnpm build:web`、`pnpm check`（0 错误）、`pnpm lint`（0 问题）、`pnpm verify:web`。
3. 浏览器双主题实测（`http://127.0.0.1:5173/`）：
   - 点击底栏「技能」/「插件」→ 输入框变 `搜索…`、上方长出一体化面板、打字实时过滤并高亮命中词；
   - 键盘 `↑/↓/Enter` 选中技能 → 顶部回显蓝色强调标签、原草稿无损恢复、点 `×` 可移除；
   - 点击「+」菜单验证「添加 + 快捷能力 + 插件」分组；
   - 窄屏与深/浅双主题对比度检查，控制台 0 报错。
