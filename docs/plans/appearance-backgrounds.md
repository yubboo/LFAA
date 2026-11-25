# 外观背景图片功能开发方案（已实施）

状态：**已实施**（2026-11-25，DEV-000533）。
负责人已确认：

1. 图片放 `packages/ui/theme/client/assets/backgrounds/`（主题包自带，不另开包）；
2. 入口放在外观页「预设」分区里、主题风格之下，属于内置风格的一部分；
3. 作用位置先做「全局工作区 + 设置中心」两处；
4. 背景铺满整个四栏壳层；
5. 新图片必须能被自动发现——负责人以后发新图，Agent 直接加进去就能用，不要每次改组件代码。

> 高清原图负责人稍后补；先按现有 16 张定名，后续同名替换即可（Vite 会换哈希，不需要清缓存）。

## 1. 目标与非目标

### 目标

1. 外观页「预设」分区新增「背景图片」分组：纯色（跟随主题）、内置图片、个人上传三档，点击即生效、实时可见。
2. 背景作用于整个四栏壳层（左右栏、顶栏、中间区都浮在图片上），设置中心打开时切到「设置中心」自己的背景。
3. 内置图片**自动发现**：把图片放进资产目录就出现在图墙，中文名可选；新增图片不需要改组件、不需要改注册表代码。
4. 个人图片**免构建生效**：把图片放进本机数据目录（或从设置页上传），刷新后即出现在图墙，可删除。
5. 深浅两套主题正文对比度 ≥ 4.5:1；720px 窄屏可用；切换背景不闪白、不打断当前会话。

### 非目标（本轮不做）

- 登录页背景：LFAA 没有登录页。
- 每个项目、每个导航页各一张背景：数据结构预留 `BackgroundTarget`，本轮只落两处。
- 背景模糊/透明度/位置/缩放方式微调：「纯色 / 图片」两档先跑通，参数后置。
- 视频背景、在线图库、任意外部 URL、自动抓图。
- 换图后自动从网络下载：图片由负责人提供或本地上传。

## 2. 已确认决策

| # | 决策 | 结论 |
| --- | --- | --- |
| D1 | 资源位置 | `packages/ui/theme/client/assets/backgrounds/`，跟随外观包走 Vite 资源管线 |
| D2 | 界面入口 | 「预设」分区 → 主题风格下方新增「背景图片」分组（不新增 tab、不新增设置页） |
| D3 | 作用位置 | 全局工作区、设置中心（两个 target） |
| D4 | 铺放范围 | 整个四栏壳层，面板浮在图上 |
| D5 | 新增图片 | 构建期 glob 自动发现 + 运行时扫描个人目录；文件名兜底当标题，中文名写进可选清单 |

## 3. 资源目录与自动发现

### 3.1 两个来源

| 来源 | 位置 | 生效方式 | 谁能加 |
| --- | --- | --- | --- |
| 内置图片 | `packages/ui/theme/client/assets/backgrounds/` | 构建期 `import.meta.glob` 收进 bundle；dev 下新增文件触发 HMR | 负责人 + Agent（随代码提交） |
| 个人图片 | `~/.lfaa/backgrounds/`（Host 扫描） | 运行期列表接口返回；刷新/重开设置即出现 | 负责人上传，或 Agent 直接拷文件 |

### 3.2 目录与清单

```text
packages/ui/theme/client/assets/backgrounds/
├─ manifest.json                     # 可选：中文名 + 展示顺序；只有英文名时整个文件可以不存在
├─ index.ts                          # 自动发现 + 清单合并，导出 BUILTIN_BACKGROUNDS
├─ cherry-blossom-waterfront.webp    # 樱花水岸
├─ minecraft-world.webp              # 方块日落
├─ service-room.webp                 # 服务机房
├─ steamcmd-world.webp               # 城堡之夜
├─ writing-desk.webp                 # 写作桌面
├─ writing-yunjian.webp              # 云涧书苑
├─ cherry-blossom-shore.webp         # 樱花海岸
├─ cherry-blossom-village.webp       # 樱花村庄
├─ flower-meadow-castle.webp         # 花野城堡
├─ forest-bridge-evening.webp        # 林间桥影
├─ golden-wheat-field.webp           # 金色麦田
├─ lakeside-pagoda-morning.webp      # 湖畔晨光
├─ ocean-cliff-sunset.webp           # 海崖日落
├─ rainy-grassland.webp              # 雨后草原
├─ snowy-cabin-interior.webp         # 雪夜木屋
└─ tropical-coast-day.webp           # 热带海岸
```

自动发现写法（路径以实际文件为准）：

```ts
// 把图片丢进 backgrounds/ 就会被收进图墙；没有登记中文名时用文件名兜底。
const files = import.meta.glob("./backgrounds/*.{webp,png,jpg,jpeg,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
```

`manifest.json` 只做两件事，缺了也能跑：

```json
{
  "order": ["cherry-blossom-waterfront", "minecraft-world", "service-room"],
  "labels": {
    "cherry-blossom-waterfront": { "zh": "樱花水岸", "en": "Cherry Blossom Waterfront" }
  }
}
```

- 排序：`order` 里出现的按顺序排前面；没登记的按文件名排后面，新图不会被漏掉。
- 名称：`labels` 优先；没有登记就把 `cherry-blossom-shore` 转成 `Cherry Blossom Shore`，中文环境显示同一串英文兜底，不会出现空标题。
- 复制文件同名替换 = 换图，不新增条目；删文件 = 图墙自动少一张。配置里存的是 `id`，不是哈希 URL，重新构建不会失效。

### 3.3 命名与规格

- 文件名：小写英文 kebab-case，只用 `a-z0-9-`，不含空格与中文；扩展名走 `webp`（推荐）、`png`、`jpg`、`jpeg`、`avif`。
- 尺寸：横图建议 ≥ 1600×900，保持 16:9；`tropical-coast-day` 是竖图，保留原始比例。
- 体积：入库前统一转 WebP（质量 82 左右），单张目标 ≤ 400KB；16 张合计控制在 3MB 内。
- 转换由 Agent 在收图时完成；图墙只认目录里的成品，不在运行时解码大 PNG。

### 3.4 Agent 添加流程（重点）

负责人会直接对小鱼说「把这张图加进背景」，所以两条路径都必须能被 Agent 独立完成，且**按当前项目环境自行判断**：

| 场景 | Agent 的落点 | 生效方式 |
| --- | --- | --- |
| 当前工作区就是 LFAA 源码仓库（存在 `packages/ui/theme/client/assets/backgrounds/`），且负责人希望随版本内置 | 内置目录 + `manifest.json` 登记 | 改完跑构建/检查 |
| 其它项目、没有 LFAA 源码，或只给本机自己用 | `~/.lfaa/backgrounds/` 个人目录 | 刷新设置即生效，不重建 |

判断顺序（写进 Agent 提示词与 README，避免靠猜）：

1. 先看当前工作目录有没有 `packages/ui/theme/client/assets/backgrounds/`；有且负责人要「内置/跟版本走」→ 内置目录。
2. 没有源码、或负责人说「只给我自己用/临时换」→ 个人目录。
3. 两条都允许直接放 `png/jpg/webp`；内置目录优先转 WebP 控制体积，个人目录允许原样放入。

内置路径的操作步骤（不改组件代码）：

1. 转 WebP、保持 16:9、按内容起 kebab-case 文件名，放进 `assets/backgrounds/`。
2. 需要中文名时在 `manifest.json` 的 `labels` 里加一行；不加以文件名兜底。
3. 跑 `pnpm typecheck` 与 `pnpm ui:shot --only=settings-appearance`，确认图墙多了一张、点击生效。

个人路径的操作步骤（不改代码、不重建）：

1. 把图片命名为 `my-wallpaper.webp`（或 png/jpg）放进 `~/.lfaa/backgrounds/`；
2. 重新打开设置中心，图墙「我的图片」即出现，可直接选、可删。

这些流程会同时写进 `packages/ui/theme/README.md` / `README.zh.md`、`assets/backgrounds/index.ts` 顶部注释，以及 Agent 系统提示词（见 8.6），保证小鱼在 LFAA 项目内外都能找到正确落点。

### 3.5 个人图片目录

- 目录：`~/.lfaa/backgrounds/`（与 `~/.lfaa/notification-sounds` 同级，复用同一套本机数据约定）。
- 允许直接放文件（不带元数据）：Host 扫描目录时按文件名生成 `id` 与标题，自动出现在「我的图片」。
- 上传接口额外写 `<uuid>.meta.json` 记录原始文件名、MIME、大小、时间；直接放文件则以文件本身为准。
- 同名文件冲突时以「后写入的为准」，不覆盖历史 UUID 文件；删除走接口或删文件后刷新。

## 4. 数据契约

`packages/ui/theme/contract/index.ts`：

```ts
export type BackgroundTarget = "workspace" | "settings";

export type BackgroundChoice =
  | { kind: "default" }                 // 跟随主题背景色（纯色）
  | { kind: "builtin"; id: string }     // 内置图（assets/backgrounds）
  | { kind: "custom"; id: string };     // 个人图（~/.lfaa/backgrounds）

export interface AppearanceConfig {
  // …现有字段不动
  backgrounds: Record<BackgroundTarget, BackgroundChoice>;
}
```

- 默认值：两个 target 都是 `{ kind: "default" }`；老配置缺字段时 `sanitizeAppearanceConfig` 补默认，无需手写迁移。
- 校验：`kind` 非法、`id` 为空或含路径分隔符时回落到 `default`；内置 id 不在当前清单里时同样回落，避免图片删掉后留一个坏引用。
- `BACKGROUND_TARGETS` 常量同时提供给下拉与测试（`workspace` / `settings` 的顺序与文案）。

## 5. 渲染与主题适配

- `AppearanceStore.syncDocument()` 输出两个变量与两个状态属性：

```text
--app-bg-workspace: url("/assets/cherry-blossom-waterfront-xxxx.webp") | none
--app-bg-settings:  url("/api/backgrounds/<id>/file") | none
data-app-bg-workspace="image" | "none"
data-app-bg-settings="image" | "none"
```

- 壳层（`packages/ui/layout`）：
  - `.shell` 增加 `background-size: cover` / `background-position: center` / `background-color: var(--color-shell)`，图片通过变量挂上。
  - 设置中心打开时由对话框在 `<html>` 上打 `data-settings-open="true"`（关闭/卸载清理），CSS 据此把壳层背景切到 `--app-bg-settings`。
  - 图片生效时叠一层主题遮罩（浅色提亮、深色压暗），并适度提高 `--color-panel` / `--color-rail` 不透明度，保证面板正文对比度；具体数值在实现时按深浅两套截图实测确定。
  - 面板保持现有玻璃模糊；`html[data-glass="false"]` 下退回纯不透明面板，不叠加模糊。
- 设置中心自己的背景只在打开期间生效，关闭立即回到工作区背景。
- 无图片（`default`）时壳层与现在完全一致：不加遮罩、不改面板透明度、不加载任何图片请求。

## 6. Host 接口

新增 `packages/host/web-server/src/handlers/handlers-backgrounds.ts`，照抄提示音接口的形态（JSON + base64，不引入 multipart 依赖）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/backgrounds` | 列出个人图片：`{ backgrounds: [{ id, name, mime, size, createdAt }] }`，直接放进去的文件也出现 |
| `POST` | `/api/backgrounds` | `{ name, mime, dataBase64 }`，仅接受 `image/png`、`image/jpeg`、`image/webp`，≤ 12MB，写 `<uuid>.<ext>` + `<uuid>.meta.json`，返回 201 |
| `GET` | `/api/backgrounds/:id/file` | 读图；`Content-Type` 用元数据/扩展名，`Cache-Control: private, max-age=86400` |
| `DELETE` | `/api/backgrounds/:id` | 删除图片与元数据 |

- 目录可用 `~/.lfaa/backgrounds`，测试用 `backgroundsDir` 覆盖；id 白名单 `^[a-z0-9-]{1,64}$` 或 UUID，拒绝穿越。
- 在 `runtime.ts` 与 `handlers.ts` 的装配点注册，与提示音处理器并列。
- 上传图片不在本仓库，不进 git；换设备不跟随（与提示音、资料库同一策略）。

## 7. 界面

位置：外观页「预设」tab，主题风格卡片下方，新增分组「背景图片」。

- 分组头：说明「选择工作区与设置中心的背景，或上传自己的图片。」
- 第一行：作用位置下拉（`ThemeSelect`）——工作区 / 设置中心。
- 图墙：
  - 第一张「纯色」卡片：用当前主题背景色 + 前景色画一个小样，选中即 `default`。
  - 内置图卡片：图片 cover、底部名称、右下角选中勾；悬停轻微提亮，点击应用到当前 target。
  - 「我的图片」卡片：紧随内置图之后；右上角删除按钮（点击后变「确认删除」，再点才删），删除当前选中图时回落到纯色。
  - 不显示来源说明长文；上传行单独一行，含「上传图片」按钮与格式/大小提示，失败显示组内状态文字。
- 选中态：同一 target 单选；切换 target 时图墙选中态跟着切，不改变另一个 target 的选择。
- 悬停预览：图墙只做卡片自身提亮；实际壳层背景在对话框外实时变化，用户能直接看到效果（设置中心 target 则在其打开时可见）。不为此改造 `ThemePreview`。
- 无障碍：卡片是 `button` + `aria-pressed`，图片 `alt` 用中文名；`focus-visible` 描边；删除按钮有独立 `aria-label`。

## 8. 文件级改动清单

### 8.1 资源与契约

| 文件 | 改动 |
| --- | --- |
| `packages/ui/theme/client/assets/backgrounds/`（新增） | 16 张 WebP + `manifest.json` |
| `packages/ui/theme/client/assets/backgrounds/index.ts`（新增） | glob 自动发现、标签兜底、排序、`getBuiltinBackground(id)` |
| `packages/ui/theme/client/assets/backgrounds/manifest.json`（新增） | 中文名与展示顺序（可选） |
| `packages/ui/theme/contract/index.ts` | `BackgroundTarget` / `BackgroundChoice`、`AppearanceConfig.backgrounds`、默认值、`BACKGROUND_TARGETS` |
| `packages/ui/theme/client/appearance-store.ts` | `setBackground()`、`resolveBackground()`、`syncDocument` 输出变量与属性、上传列表拉取辅助 |
| `packages/ui/theme/client/locales.ts` | 背景分组、位置名、纯色、我的图片、上传、删除、失败提示等中英文案 |

### 8.2 界面

| 文件 | 改动 |
| --- | --- |
| `packages/ui/theme/client/components/AppearanceSettings.tsx` | 预设分区插入 `<BackgroundSettings />`，放在主题风格组之后 |
| `packages/ui/theme/client/components/BackgroundSettings.tsx`（新增） | 目标下拉、图墙、上传、删除、状态提示 |
| `packages/ui/theme/client/components/BackgroundGallery.tsx`（新增） | 图片卡片网格（纯色/内置/个人），键盘与选中态 |
| `packages/ui/theme/client/components/BackgroundSettings.module.css`（新增） | 卡片网格、删除按钮、上传行；只用主题变量 |

### 8.3 壳层与主题

| 文件 | 改动 |
| --- | --- |
| `packages/ui/layout/client/shell/WorkbenchShell.module.css` | 壳层背景变量、遮罩、`data-settings-open` 切换、玻璃/不透明两套适配 |
| `packages/ui/layout/client/shell/SettingsDialog.tsx`（或实际对话框文件） | 打开/关闭时在 `<html>` 写 `data-settings-open`，卸载清理 |
| `packages/ui/theme/client/tokens.css` | 图片生效时的面板不透明度与遮罩令牌（深浅成对，允许写具体色值的变量层） |

### 8.4 Host

| 文件 | 改动 |
| --- | --- |
| `packages/host/web-server/src/handlers/handlers-backgrounds.ts`（新增） | 列表 / 上传 / 读图 / 删除，含目录扫描与文件名兜底 |
| `packages/host/web-server/src/handlers/handlers.ts`、`src/runtime.ts`、`src/index.ts` | 注册与导出处理器 |
| `packages/host/web-server/tests/backgrounds.test.ts`（新增） | 上传、列表、直接放文件被发现、删除、拒绝非图片/超大/穿越 |

### 8.5 文档与截图

| 文件 | 改动 |
| --- | --- |
| `packages/ui/theme/README.md` / `README.zh.md` / `README.i18n.yaml` | 背景图分组、自动发现、Agent 添加流程 |
| `scripts/ui-shot-tasks.ts` | 新增背景图墙（深/浅）、使用背景后的首页、设置中心背景、窄屏任务 |
| `docs/plans/README.md` | 方案索引 |
| dev-log / updata-log | 实施轮记录 |

### 8.6 Agent 提示词

| 文件 | 改动 |
| --- | --- |
| `packages/core/agent/src/context/agent-context.ts` | 系统提示词补一段：个人背景目录始终可用（免构建）；仅当前工作区是 LFAA 源码仓库时才提内置目录，并说明「内置/个人由任务与项目判断」。路径全部由数据根目录与 `existsSync` 探测得出，不写死盘符。 |
| `packages/core/agent/tests/agent-loop.core.test.ts` | 断言提示词包含个人背景目录说明；在 LFAA 仓库运行时包含内置目录说明。 |

## 9. 实施顺序

1. **P0 资产 + 契约 + store**：转图、目录、`assets/backgrounds/index.ts`、类型与默认值、变量输出；先让 `data-app-bg-*` 能在 DevTools 看到。
2. **P1 图墙 UI**：预设分区背景组、选择与上传（先接本机目录列表）、删除。
3. **P2 壳层渲染**：整壳背景、遮罩、面板不透明度、设置中心切换；深浅双主题调对比度。
4. **P3 Host 上传接口**：列表/上传/读图/删除 + 单测，与提示音同一套约定。
5. **P4 收口**：双语文档、截图任务、`verify:web`、日志。

## 10. 验收清单

- [ ] 16 张内置图出现在「预设 → 背景图片」，点击后整个壳层换背景，刷新后保持。
- [ ] 删掉一张图 / 新增一张图（不改代码）后图墙数量与内容自动变化；新图有文件名兜底标题。
- [ ] 直接往 `~/.lfaa/backgrounds/` 放一张图，重开设置中心即可选、可删，无需重新构建。
- [ ] 工作区与设置中心各选一张，打开设置中心时壳层切到设置中心背景，关闭回到工作区背景。
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm check` / `pnpm test` 全绿。
- [ ] `pnpm ui:shot` 新增任务全部出图：浅色/深色图墙、带背景首页、带背景设置中心、720px 窄屏。
- [ ] `pnpm verify:web` 通过，Console error 0。
- [ ] 深色与浅色下正文、弱化文字对比度 ≥ 4.5:1；面板、弹窗、下拉在图片上不糊、不脏。
- [ ] 图片无 `default` 时不发任何图片请求，壳层与现在完全一致。

## 11. 风险与回滚

- **可读性**：整壳背景最容易压掉正文对比度。兜底是提高面板不透明度、加深遮罩；仍不达标就把铺放范围退回「只铺中间区域」（D4 单点回退）。
- **体积**：16 张 WebP 约 2–3MB 进 bundle 资源目录，不增加 JS 主包体积；后续新增图需继续压到 ≤400KB。
- **类型**：`import.meta.glob` 的图片模块需要 `assets.d.ts`；若 `pnpm typecheck` 未覆盖 client，需把声明挂到实际被检查的 program 并在 dev-log 记明。
- **设置中心背景**：`data-settings-open` 的写入/清理若漏掉，会出现关闭设置后仍用设置中心背景；单测补「打开→关闭→属性移除」。
- **删除个人图片**：被删除的图若正被选中，回落到纯色并提示，不留坏引用。
- **回滚**：移除背景分组与壳层样式，契约字段保留并回默认（`default` 不产生任何视觉变化），Host 接口可独立保留。