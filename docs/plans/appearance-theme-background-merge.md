# 外观页「主题风格」与「背景图片」合并方案

状态：**已实施**（2026-11-26，DEV-000595 / DEV-000600）。负责人确认：主题就是背景，只留一个功能，不再有独立的背景入口；预览改为悬停浮层，不再常驻页面顶部。

> 现场问题：预设分区里「主题风格」5 张卡与「背景图片」18 张卡是两面同形卡片墙。
> 两者都在决定界面底色：选了图片，主题卡里的底色就看不见；「纯色」卡又和主题底色是同一件事。
> 负责人要求把两者合成一套：主题就是背景，背景就是主题。

## 1. 目标

1. 预设分区只剩一组选择器：**主题卡墙**。一张卡就是一套完整外观（配色 + 底图或纯色），点一次同时应用。
2. 保留全部内容：5 套纯色主题、16 张内置背景、个人图上传与删除。
3. 悬停任意卡只在光标旁浮出实时预览，点击才写配置；不常驻预览舞台，避免上下滚动。
4. 不再出现「背景」分组、作用位置分段或第二条背景选择轴。

### 非目标

- 不再支持「樱花粉 + 服务机房」这类配色与背景的自由混搭；每个背景主题固定一套配色。
- 不改高级设置分区里的强调色、背景/前景色值、字号、字体与动效。
- 不改 Host 的 `/api/backgrounds` 上传、列表、删除接口。

## 2. 交互

1. 页面顶部只有分区选项卡，没有常驻预览舞台。
2. 明暗模式（3 张卡，只比较明暗，不铺背景）。
3. **主题**卡墙：第一行 5 套纯色主题，之后每张内置背景一张主题卡，个人图排在最后；标题右侧是「上传」。
4. 悬停/聚焦任意卡：在光标旁浮出实时预览（`ThemePreview` 迷你工作台 + 主题名 + 「点击应用」），系统箭头换成「预览」胶囊；点击才落盘。
5. 浮层跟随只写 transform（rAF 合帧），不触发 React 重渲染；滚动/滚轮/按下立即收起，卡片之间移动延迟 70ms 收起避免闪烁，靠边自动翻转。
6. 点击主题卡：`applyThemeLook` 一次写入配色、背景，并把工作区与设置中心同步成同一张图。
7. 个人图：上传后成为一张主题卡（液态玻璃配色），删除需要第二次点击；删除正在使用的图时回退到 LFAA 纯色主题。

### 卡面与命名

- 纯色主题卡：迷你工作台画在主题底色上，名称沿用 `THEME_PRESETS` 的中英文名。
- 背景主题卡：同一枚迷你工作台铺在该背景图上，名称用背景图名称（樱花水岸等）。
- 个人图主题卡：名称用文件名去扩展名。

### 配色映射

内置图在 `manifest.json` 的 `labels.<id>.preset` 里声明它作为主题时使用的配色；没登记或非法时回退 `liquidGlass`。当前映射按画面气氛分组：樱花系 → `sakura`，日落/海岸/麦田 → `liquidGlass`，夜景/机房 → `midnightInk`，书房 → `classic`，草地/森林/湖畔 → `softMist`。

## 3. 数据与契约

- 契约字段不变：`AppearanceConfig.preset` 与 `AppearanceConfig.backgrounds[target]`。
- `ThemeLookTile` = 主题卡的取样 + `preset` + `background`；由 `theme-looks.ts` 从预设、内置图与个人图拍平。
- `AppearanceStore.applyThemeLook(presetId, background)` 一次提交配色与两个目标的背景；`applyPreset` / `setBackground` 随旧入口一起删除。
- 存储键不变：`lfaa:appearance-tab`、`lfaa:appearance-config-v1`；`lfaa:appearance-bg-target` 不再写入。

## 4. 文件级改动

| 文件 | 改动 |
|---|---|
| `packages/ui/theme/client/components/theme-looks.ts`（新增） | 主题卡墙取样：纯色 + 内置背景 + 个人图，选中态按「配色 + 背景」双条件 |
| `packages/ui/theme/client/components/ThemeHoverPreview.tsx`（新增） | 悬停浮层、预览卡与「预览」光标、rAF 跟随 |
| `packages/ui/theme/client/components/ThemeHoverPreview.module.css`（新增） | 浮层、光标胶囊、预览卡样式 |
| `packages/ui/theme/client/components/hover-preview-position.ts`（新增） | 贴边翻转纯函数 |
| `packages/ui/theme/tests/theme-hover.test.ts`（新增） | 右下边缘翻转断言 |
| `packages/ui/theme/client/components/use-theme-backgrounds.ts`（新增） | 个人图加载、上传、二次确认删除与回退 |
| `packages/ui/theme/client/components/AppearanceSettings.tsx` | 一面主题卡墙、上传动作、单张卡应用整套外观；移除常驻舞台，悬停状态与延迟收起 |
| `packages/ui/theme/client/components/ThemeGallery.tsx` | 卡面支持个人图删除按钮；onPreview 带锚点、cursorHidden 隐藏系统指针 |
| `packages/ui/theme/client/components/ThemeGallery.module.css` | 卡壳、删除按钮样式 |
| `packages/ui/theme/client/components/ThemePreview.tsx` | 取样支持 `image`，卡面与舞台共用 |
| `packages/ui/theme/client/components/ThemePreview.module.css` | 背景图层、薄纱与图片态面板透明度 |
| `packages/ui/theme/client/components/theme-tiles.ts` | 明暗模式卡保持纯配色取样 |
| `packages/ui/theme/client/assets/backgrounds/manifest.json` | 每张内置图补 `preset` 配色映射 |
| `packages/ui/theme/client/assets/backgrounds/index.ts` | `BuiltinBackground` 增加 `preset`，非法值回退液态玻璃 |
| `packages/ui/theme/client/appearance-store.ts` | 新增 `applyThemeLook`，删除 `applyPreset` / `setBackground` |
| `packages/ui/theme/client/components/AppearanceThemeDetail.tsx` | 高级里的预设下拉改为应用纯色主题 |
| `packages/ui/theme/client/locales.ts` | 删除背景分组/作用位置等死键；新增「预览」「点击应用」 |
| `packages/ui/primitives/client/settings/SettingsControls.tsx` | `SettingGroup` 支持标题行动作（上传） |
| `packages/ui/primitives/client/settings/SettingsSurface.module.css` | 标题行动作样式 |
| `packages/ui/theme/tests/theme-looks.test.ts`（新增） | 卡墙顺序、图片取样、双条件选中态 |
| `scripts/ui-shot-tasks.ts` | 背景任务改为主题墙与图片主题 |

## 5. 验收

1. 预设分区只有「明暗模式」与「主题」两组，页面里搜不到「背景」分组或作用位置分段。
2. 主题墙含 5 套纯色 + 16 张内置背景主题；点一张图，配色与背景一起变，工作区与设置中心同步。
3. 页面没有常驻预览舞台；悬停任意卡在光标旁浮出实时预览与「预览」光标，滚动/按下即收起；点击才写配置，F5 保持。
4. 个人图上传后成为主题卡，二次确认删除，删图回退纯色主题。
5. 深/浅两套主题、1440 / 1024 / 720 / 390 宽无溢出；浮层跟随不掉帧、控制台 0 报错。
6. `pnpm lint` / `check` / `test` / `build` / `verify:web` 通过，`ui:shot` 外观任务出图。

## 6. 风险、回滚与历史

- 风险：主题墙从 5 张变 21 张，页面更长；已按 5 列排布，仍需要一屏滚动——悬停浮层保证不用滚回顶部看预览。
- 风险：配色与背景不再自由混搭；高级设置仍可微调强调色与底色，但不会生成新的卡。
- 回滚：恢复独立的背景图墙与 `applyPreset` / `setBackground`，主题卡退回纯配色；契约与存储不变。
- 历史：第一版把背景铺进主题卡缩略图（负责人指出「这些地方也变成实时预览」）；第二版把背景收成同组缩略图轨（负责人指出「还是分开的，主题就是背景」）；第三版合并成一面主题墙；第四版移除常驻舞台、改为悬停浮层与「预览」光标（DEV-000600）。