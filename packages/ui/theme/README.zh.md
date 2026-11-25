---
description: "LFAA 液态玻璃主题系统与外观设置插件包，提供无 DOM 主题预设契约及 Cordis Client 外观视图贡献。"
kind: "package"
---

# @lfaa/ui-theme

[English](README.md) | 中文

## 摘要

LFAA 液态玻璃主题系统与外观设置插件包，提供无 DOM 主题预设契约及 Cordis Client 外观视图贡献。

本包位于 `packages/ui/theme`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./contract` | `./lib/types/contract/index.js` | 公开契约，无 Node 或 DOM 依赖 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## 开发说明

### 主题预览组件

外观页顶部的实时预览由两个可复用组件支撑，`./client` 直接导出，其他需要"选外观"的界面不必自己画一张假的界面图：

- `ThemePreview`：按 `ThemePreviewSample`（背景、前景、强调色、是否玻璃质感）渲染迷你工作台——左一图标栏、左二会话栏、中间对话列与输入条。颜色以 `--pv-*` CSS 变量注入，每个元素都对 `background-color` / `color` 做 260ms 过渡，所以切换取样是**平滑变形**，不是整块淡入淡出。传 `secondarySample` 时左右各半，用于「跟随系统」；`variant="tile"` 出的是网格里的缩略图。
- `ThemeGallery`：主题网格。悬停/聚焦只上报 `onPreview(id)`，点击才上报 `onSelect(id)`；预览状态由调用方持有，因此同一个网格可以驱动大面板、侧栏或什么都不驱动。

外观页顶部是「预设 / 高级设置」两个分区选项卡（选中项记在 `lfaa:appearance-tab`）。预设分区放明暗模式、主题风格网格与背景图片；高级设置分区放主题细项（预设与导入/复制、强调色、背景/前景、界面字体）以及字号、字体、主题与显示、动效与光标。两个分区共用顶部的实时预览：悬停预览不写真实主题，移开即回到已应用的主题。

### 背景图片（内置与个人）

外观页「预设」分区底部的「背景图片」组提供纯色（跟随主题）、内置图与个人图三档；工作区与设置中心各自保存一份选择，背景铺满整个四栏壳层。

- **内置图**放 `client/assets/backgrounds/`：同目录 `index.ts` 用 `import.meta.glob` 自动发现，新增图片不需要改组件代码；中文名与展示顺序写在 `manifest.json`（没登记时用文件名兜底，排在后面）。图片统一转 WebP、保持 16:9、单张 ≤400KB。
- **个人图**放 `~/.lfaa/backgrounds/`（或在设置页上传）：Host 扫描目录，直接放 PNG/JPG/WebP 也会出现在「我的图片」，刷新设置即生效、无需重新构建；上传与删除走 `/api/backgrounds`。
- **Agent 添加规则**：当前工作区是 LFAA 源码仓库、且负责人要「内置/跟版本走」→ 放内置目录并补 `manifest.json`；其它项目、没有源码或只给本机用 → 放个人目录。两条都允许直接放 png/jpg/webp，内置目录建议先转 WebP 控制体积。这套规则同时写在 Agent 系统提示词里。
- 配置只存 `default | builtin | custom` 与图片 id，不存 Vite 哈希 URL；个人图被删除时，正在使用它的选择回退纯色。

### 主题预设与樱花粉（Sakura）

预设集中登记在 `contract/index.ts` 的 `THEME_PRESETS`（无 DOM 依赖，Host 与 Client 共用），每套给浅色、深色两版底色与正文色，以及一枚强调色。新增预设只需两步：

1. 在 `THEME_PRESETS` 里加一条（`id` / `labelZh` / `labelEn` / `glassEnabled` / `light` / `dark`），需要新色调就同时在 `ACCENT_PRESETS` 里登记同 id 的强调色；
2. 需要专属玻璃层色调时，在 `client/tokens.css` 追加 `html[data-preset="<id>"][data-resolved-theme="light|dark"]` 两个块，只覆盖色调三元组。

主题网格、预设下拉与 `applyPreset` 都由 `THEME_PRESETS` 数据驱动，不用再改界面代码；`data-preset` 由 `appearance-store` 启动时写到根元素，配色因此对弹窗、Portal 浮层一并生效。

「樱花粉」是最新加入的第 5 套预设：浅色为晨雾樱花白（`#FFF6F8`）+ 深褐正文（`#3B2A33`，对比度 12.6:1），深色为梅红酒底（`#1D1418`）+ 浅粉正文（`#F4E6ED`，对比度 14.9:1），两套共用樱花粉强调色（`#C9558A`）。玻璃层色调以 `--tint-*` 令牌成对定义，正文与弱化文字都保持 ≥ 4.5:1，`tests/sakura-preset.test.ts` 会守住这条线。配色卡列数按预设总数自适应（5 套时桌面端 5 列，中窄屏 3 列，手机端 2 列）。
