# AI Work 最近会话时间窗与主题图标（2026-11-12）

<a id="lfaa-ai-work-recent-session-window-icons-20261112"></a>

## 用户目标与验收范围

- 左侧 AI Work“最近”仅列出最近连续三天内实际更新的未置顶、未归档会话；不再把陈旧会话长期留在最近区。项目及置顶分区维持既有历史访问入口。
- 最近网站和最近聊天复用一个纯函数：按调用者提供的时间戳、当前时间及可传入天数筛选，默认三天；时间窗长度集中定义，未来调用者可直接传参。
- 会话行图标尺寸和占位统一，按当前 App 作用域及短标题摘要识别主题。Minecraft/MC 会话用方块图标，手机/移动端会话用手机图标；浏览器、写作、终端、视频等已识别主题使用共享图标集合，无法识别时使用通用聊天图标。
- 运行入口：`/work` 左侧会话栏与右侧新标签页“最近”网站区。会话目录由认证 Connection/Session Owner 提供；浏览器记录由 Browser Owner 提供；本轮只调整 Client 展示过滤与图标，不改服务端历史、认证、持久化或执行权限。

## Owner、设置与边界

- `packages/util/values` 持有无状态的通用滚动时间窗函数及默认天数；函数不依赖 React、浏览器或领域类型，也不保存数据。
- `packages/client/ui-workspace` 是左侧会话栏和右侧新标签页的共同装配 Owner。会话按 Session Owner 的 `updatedAt` 筛选；网站按 Browser Owner 的 `visitedAt` 筛选。两个视图调用同一时间窗函数，保留各自来源顺序。
- 会话图标分类由 `packages/client/ui-workspace` 单点维护；只读 `AiSession.appId`、`title` 和 `projectTitle`，不读取会话正文、不增加请求、不触发模型推断。主题规则属于展示映射，不作能力、权限或业务判断。
- `packages/client/ui-primitives/src/WorkbenchIcon.tsx` 持有共享 SVG 图标形状；左侧样式由 `ui-workspace/src/css/secondary-navigation.css` 唯一维护。图标沿 Appearance 共享文字颜色令牌，未新增 CSS 变量。
- 没有新增设置中心字段。三天是共享函数默认值，调用方可显式传入其他天数；外观继续使用现有 Appearance 颜色与字体映射。`browserUse.recordRecentSites` 原值及 Browser Owner 行为不变。

## 必需 UI Skills 记录

- Taste Skill / app screens：保留现有密集工作台结构；使用同一组 14px 线性图标、统一 16px 图标槽和中性色，不加图标底板或新装饰。
- Impeccable：收紧图标槽和文本盒子的父子边界，检查同一行及相邻会话列表保持原行为。
- Audit Skills：当前目标为 TypeScript/TSX/CSS，不在此 Skill 声明的专项语言覆盖内；按代码调用链人工复核输入来源、账户边界及无新增数据读取。
- UI Motion：本次无动效需求；只添加单个最早到期计时器，并在依赖变化/卸载时清理。
- UI/UX Pro Max：覆盖真实容器中的侧栏桌面和手机/窄分栏，确认项目/置顶入口、菜单和长标题可用。
- Baseline UI：统一图标尺寸、图标与标题间距、列表文字省略和现有主题对比度。
- `frontend-design` 只适用于新界面或较大视觉重设计；本次沿用现有 App 工作界面，不启用额外可选技能。

## 性能与验收条件

1. 通用时间窗覆盖默认三天、调用参数覆盖、自定义时间长度、精确到期边界、无效/未来时间戳、来源顺序与最早到期时间。
2. 最近会话列表以 `updatedAt` 和默认三天筛选；计数跟随可见会话；没有符合条件的记录时整个“最近”分区隐藏。桌面正常滚动、点击、置顶、项目分组继续工作。
3. 网站最近区继续以 `visitedAt` 显示默认三天数据，右侧推荐与其他新标签页区域不变；两处使用相同函数而不是重复时间算法。
4. Minecraft、MC、手机/移动端和至少一个普通回退主题返回预期图标；图标 SVG 14×14px，固定 16×16px 布局槽，不改变会话文字可用宽度契约以外的列布局。
5. 单次函数遍历 O(n) 有界会话/网站摘要；各视图只在最早一条到期时安排一个 timeout，effect 重跑和卸载清理；不新增轮询、订阅、API 请求、持久化或无界缓存。
6. 运行直接回归、`ui-primitives` / `ui-workspace` 构建、Client 类型检查和正式 Web 构建；随后启动当前 checkout 的正式 Web，在 ChatGPT 内置浏览器 `/work` 检查桌面视口与 390px 窄视口的实际 Recent 列表、图标、点击和相邻分区。实页数据仅观察，不修改用户会话、项目、设置或最近网站。
7. 构建/回归与真实页面证据分别记录；无符合数据、真实 Provider 或帧时间未测时如实标注。

## 实施记录

- 实现：新增 `packages/util/values/src/recent-window.ts`，定义共享 3 天默认值及可传天数的无状态筛选函数；左侧未置顶/未归档会话按 Session Owner 的 `updatedAt` 过滤，右侧网站仍按 Browser Owner 的 `visitedAt` 过滤，两处共用同一函数和最早到期 timeout。新增集中式标题主题图标映射，Minecraft/MC 使用 `cube`，手机/移动端使用 `mobile`，并回退到 App 语境或通用聊天图标；所有会话行固定 16×16px 图标槽、14×14px SVG。未新增设置字段、请求、持久化或会话内容读取。
- 回归：`pnpm.cmd --filter @yubboo/lfaa test -- tests/client-workspace-browser-recent-window.test.mjs tests/client-workspace-session-icons.test.mjs tests/client-workspace-right-launcher-layout.test.mjs` 通过，10/10。覆盖 3 天边界、无效/未来时间戳、自定义天数、来源顺序、到期计算、两处共用函数、图标主题和统一尺寸。
- 构建：`pnpm.cmd --filter lfaa-util-values run build`、`pnpm.cmd --filter lfaa-client-ui-primitives run build`、`pnpm.cmd --filter lfaa-client-ui-workspace run build`、`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd run build:web` 均通过；产物写入根 `dist/`。`node scripts/runtime-build-state.mjs web` 返回 `[]`；正式服务由当前 checkout 执行 `pnpm.cmd lfaa web` 启动，`http://127.0.0.1:3000/api/health` 返回 200，本机 Daemon 已启动。
- 内置浏览器验收阻碍：`http://127.0.0.1:3000/work` 的新标签与原有标签刷新后均显示登录页，浏览器没有有效登录态。没有使用默认账号/密码或修改认证数据。桌面视口约 1270×713 只能确认登录页与服务正常；实际工作台列表/图标、会话点击、相邻分区及 390px 窄视口均未验收，不能标记为通过。布局与工作量回归已做静态/构建检查；帧时间未测。
- 设置与性能：未新增设置中心配置；沿用 `browserUse.recordRecentSites` 决定是否展示网站最近区，并沿用 Appearance 文字/强调色令牌。筛选每次 O(n) 遍历现有有界列表，每个区域最多一个到期计时器，effect 清理会撤销计时器；未新增轮询、订阅、API 请求或缓存。
