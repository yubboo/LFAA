# Minecraft 玩家开服与运维工作区重设计

<a id="lfaa-minecraft-player-launchpad-ui-20261030"></a>

## 用户目标与可观察结果

- 用户要求为 Minecraft App 重新选择整体视觉风格，面向玩家提供简洁、优雅、操作便捷的服务器开服与日常运维面板；用户特别明确“一键开服”与持续运维都重要。
- 第一次进入时，玩家能快速找到真实开服向导；已有服务端时，能从总览看懂其真实状态并触达现有启停、管理、任务与控制台入口。
- “一键开服”指清楚直接地进入现有创建/部署能力，已有服务端则提供现有权限与状态检查下的启动入口。不能省掉必要的节点/参数选择、Minecraft EULA 确认或既有授权校验。
- 屏幕表达真实事实：总览轨道连接实例登记的实际 Daemon 节点，仅表示节点归属；不得暗示公网联通、资源性能、TPS、玩家在线数或未采样指标。

## 运行入口、Owner 与边界

- 用户可见入口：LFAA App 模式中的 Minecraft **手动开服/运维工作区**，菜单路由包括 `/games/minecraft/overview`、`/games/minecraft/deployment`、`/games/minecraft/instances`、`/games/minecraft/nodes`、`/games/minecraft/tasks`；实例子路由涵盖总览、配置、备份与日志/控制台。工作流画布在 Minecraft 包内。
- 页面 Owner：`packages/client/ui-minecraft`；由共享 `ApplicationWorkspace` 动态装配 `MinecraftWorkspace` 与 `MinecraftWorkflowCanvas`。共享应用壳、三模式导航与全局 Appearance 令牌不属于本轮 Owner。
- 唯一领域事实继续来自现有 Minecraft API/领域服务与目标 Daemon；认证/角色使用现有认证及 Permission Owner，界面保留 `hasAdminAccess(role)`、节点在线、实例状态、执行能力及操作前置条件。
- Java 环境及联机菜单仍进入各自已有 Owner 管理的共享应用；不复制或重写游戏运行环境和公网联机。
- 页面数据、操作和错误恢复均沿用现有 API、事件、缓存与 polling 生命周期。无新订阅、定时器、假账户、示例服务器、模拟成功或隐藏授权。

## 设置中心盘点

- 设置与默认值权威源：`packages/util/values/src/settings-contract.ts`；按账户持久化及规范化由 `packages/settings/settings/src/service.ts` 通过 `user_settings` 保存，参数校验由同包 `validation.ts` 管理。只用默认值描述缺失账户设置，不覆盖用户保存值。
- 常规：`general.cardMotionEffect` 默认 `fluid`；由 Workbench 设置到 `.workbench-shell[data-card-motion-effect]`，共享 `ui-theme` 只对已注册 `lfaa-card-motion` 元素应用效果。本轮不新增卡片编排。
- 外观：主题默认 `system`，强调色默认 `#3457d5`；Minecraft 背景槽默认 `none`；界面/代码字号默认 `14/12px`；字体默认为 `system`；对比度默认 `60`；遮罩/模糊默认 `65%/14px`；减少动态效果默认为 `system`。Minecraft 区域覆盖为空时继承全局遮罩与模糊；已设置区域值优先。
- Workbench Owner 把主题、强调色、字体、字号、对比度、Minecraft 背景资源、区域透明度/遮罩和模糊映射成共享 token/壳属性；CSS 必须受 `.minecraft-workspace` 范围约束并消费这些 token，不加固定色板、不覆盖账户壁纸。
- Minecraft Runtime：Paper、4096 MB、Java 端口 25565、Bedrock 端口 19132、native 执行方式，准备/停止/下载/安装超时分别为 120/30/1800/900 秒。部署向导继续从传入设置读默认值，保存默认值只更新仍采用旧默认的未提交输入；本轮不加控制项或改设置。

## 选定方向与 UI Skills 决策

- 用户明确授权助手自行选择风格并实施。第一版 `framed-sheet` / `世界轨道图谱` 已在真实页面显示，用户反馈“好土啊”；该版未通过视觉验收。方向审核记录 `assigned`（`seed:bb9054b70f26baf3`）及 code-first 选择只作为第一版历史。
- 根据玩家社区使用方式，重新从 Taste App Screen `community` 风格组抽选，选择 **`true-black-flat`**（seed `1725674016`）：平面层级用邻近表面色阶表达，降低外围框线与重复面板带来的后台模板感。
- 本风格样例为深色；实现只采用其层级与平面处理，实际颜色、明暗主题和字体继续使用 LFAA Appearance 令牌，不强制深色、不覆盖用户强调色或主操作颜色。
- 新签名元素为 **真实开服路径**：空服务器总览展示现有三步向导（服务端/运行设备/配置与 EULA），第二步显示当前真实部署准备状态；已有服务端继续展示真实注册节点到实例的归属线路。第一屏标题行为玩家提供直接开服按钮，不加虚构世界地图、在线玩家数或性能数据。
- Impeccable `PRODUCT.md` 与目标流程记录用户画像；`frontend-design` 为用户明确选择并用于形成玩家主流程。Taste App Screen 规则用于避免装饰性欢迎横幅和默认卡片模板。Baseline UI 的层级、留白与可读性建议使用在现有 Ant Design/CSS 技术栈内。
- UI/UX Pro Max 检索只返回通用极简/信任与转化建议，与领域开服工作区不匹配；采用其中无障碍/响应式检查，不套用落地页 Hero/CTA 模板。UI Motion 不因设计方向自行添加动效；既有偏好映射保持。Audit Skills 声明仅覆盖 Java/.NET/PHP，不把它报告为 TypeScript/CSS 安全扫描；仍按本地代码审阅认证、授权、验证、账户/节点隔离和数据边界。
- 不新增 UI 依赖。组件/样式只由 `ui-minecraft` Owner 维护；新 CSS 自定义属性旁必须有中文注释，解释区域、色调/透明度或效果强度。

## 分批改动与验收条件

1. **总览与开服入口：** 总览标题行提供开服入口；空服务器展示现有部署三步路径与真实节点就绪状态；已有服务器靠前展示状态、真实节点归属和可用操作；用三项真实运营摘要与运行设备/近期任务继续日常运维；保留空数据、加载、离线、只读、失败和未确认状态。
2. **日常实例运维：** 重做节点列表/详情、实例列表/详情、配置/备份与控制台视觉；现有搜索、筛选、启停、确认、日志、输入发送与错误反馈不变。浏览器验收仅观察，不发送命令或触发操作。
3. **开服部署：** 重做部署向导与部署记录层级；保留真实核心/版本目录、节点条件、运行配置、EULA 核对及最终提交合同；验收只进入向导第一步，不提交部署。
4. **任务及工作流：** 重做任务列表、任务详情及包内工作流编辑视图的视觉层级；不执行工作流或写入配置；保留现有真实执行/删除/保存授权及结果反馈合同。
- 每批结束立即运行该批直接相关的 Minecraft UI 包构建、Client 类型检查及可用的直接回归，然后用 ChatGPT 内置浏览器打开当前工作区正式服务，对本批当前源码进行实页检查；完成该批验收前不开始依赖它的下一批。
- 内置浏览器至少检查一处正常桌面视口、窄分栏/手机容器及短屏；记录真实路由、宽高、真实显示状态、滚动/溢出、关键非破坏性交互和截图证据。视口能力不可用、认证/控制端不通等限制须记录事实并保留未验状态。
- 开发中持续使用共享主题/设置映射，不改变账户偏好。用 Taste `lint`/`inspect` 与 Impeccable detector 做最终静态界面审阅；按适用边界运行包构建/类型回归/Web 构建，输出只进入根 `dist/`。
- 性能边界：复用现有 Snapshot Cache、Socket、受限轮询、日志上限；无新增订阅、重复查询、无变化刷新或 JS 动画。记录浏览器交互和任何长任务/帧时间证据，未测写明。
- 安全边界：UI 仅调用既有真实控制端入口；不能以 CSS/客户端条件替代后端授权与输入校验；不实测或改变真实账户/偏好、服务器、Daemon 或任务数据。

## 实施与逐批验证记录

- 第一版总览曾在独立服务上显示；用户指出视觉“好土”。第一版按失败结果处理，未进入下一批；第二版改为真实开服路径、三项运营状态和两个开放式运维区，并通过批次 1 的浏览器验收。
- **批次 1 已完成：** `MinecraftWorkspace.tsx` 提供 `开始开服` 主入口、真实空实例三步路径、三项运维摘要及运行设备/近期任务区；`MinecraftWorkspace.css` 改为共享 Appearance 令牌下的平面层级，并按容器宽度重排标题/开服路径。`DESIGN.md`、包 README 与本合同记录方向/Owner。
- 批次 1 源码回归：`pnpm --filter lfaa-client-ui-minecraft run build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter @yubboo/lfaa test -- tests/minecraft-overview-fast-path.test.mjs`、Taste `lint.mjs --app` 和 `git diff --check` 均通过；定向测试 2/2。Web `pnpm run build:web` 成功，`node scripts/runtime-build-state.mjs web` 返回 `[]`。概览请求在测试环境 8ms 返回、外部 HTTPS 请求 0 次；未测帧时间。
- 批次 1 内置浏览器实页：正式本地 Web 当前源码、隔离临时账户和数据目录；路由 `/games/minecraft`。1440×900、820×520、390×844 均无页面横向溢出；820 窄短容器中标题操作和开服路径改为纵向，390 手机视口中首屏可见 `开始开服`，更长内容通过工作区纵向滚动到达。点击主入口抵达 `/games/minecraft/deployment` 的现有向导，看到真实的“无在线多核心执行节点”状态；没有点下一步、同意 EULA 或提交部署。桌面/窄短/手机截图已在本轮 ChatGPT 内置浏览器验收记录中查看；没有写入真实账户、服务端、Daemon 或用户偏好。未测真实主题切换及启停操作。
- **批次 2 已完成：** `MinecraftWorkspace.tsx`、`MinecraftWorkspace.css` 与 `DaemonConnections.tsx` 将运行设备/服务器列表、状态摘要、监控范围和运维卡片改为当前平面层级；“新建服务器”位于服务器列表标题操作区。设备连接、权限边界和实例启停/归档/确认合同未变。
- 批次 2 源码回归：Minecraft UI 包构建、Client 类型检查、`minecraft-overview-fast-path.test.mjs`（2/2）、Taste lint 与 `git diff --check` 均通过；Web 构建成功，`runtime-build-state web` 返回 `[]`。摘要快路径 8ms、外部 HTTPS 请求 0；未测帧时间。
- 批次 2 内置浏览器实页：`/games/minecraft/nodes` 与 `/games/minecraft/instances` 分别在 1440×900、820×520、390×844 验收，页面宽度未溢出；在 820×520 下列表摘要换为两列，在 390×844 下标题按钮换行且纵向可滚动。临时账户真实状态为 0 个节点、0 个实例，验收了真实空状态与导航按钮，没有生成连接文件或运行服务器动作。详情、控制台、配置、备份需要真实实例，标记为未实测。截图在本轮内置浏览器验收记录中查看，未落盘为独立图片。
- **批次 3 已完成：** `MinecraftDeploymentPanel.tsx` 与 `MinecraftWorkspace.css` 将核心选择、三步部署路径、参数摘要与许可边界改为平面层级；窄屏告警恢复完整文字宽度，加载目录时不再展示误导的 `0 类`，步骤短标签仍有完整可访问名称。EULA 仍须明确勾选，节点、设置与提交前置条件保持原样。
- 批次 3 源码回归：Minecraft UI 包构建、Client 类型检查、`git diff --check` 通过；Web 构建成功且 `runtime-build-state web` 返回 `[]`。仓库没有独立向导 UI 自动化用例。
- 批次 3 内置浏览器实页：`/games/minecraft/deployment` 在 1440×900、820×520 与 390×844 均无横向溢出。实际目录显示 5 种类型、17 个核心，Paper 返回 68 个真实版本并限量展示前 24 个。只做了非破坏性的选型/下一步交互；实例步骤真实显示设置默认端口 25565、内存 4096 MB，并因没有在线可部署节点而禁用继续。未进入许可提交步骤、未勾选 EULA、未创建部署。桌面/短屏/手机截图在本轮内置浏览器验收记录中查看，未保存成独立图片。
- 第一版视觉结果失败并已废弃；第二版已完成四个批次。以下记录了任务/工作流批次的最终实页和回归证据。
- **批次 4 已完成：** `MinecraftWorkspace.tsx`、`MinecraftWorkspace.css` 把任务统计与记录改为平面分隔布局；手机任务统计明确为 2×2。`MinecraftWorkflowCanvas.tsx`、`MinecraftWorkflowCanvas.css` 修正工作流标题/说明，空状态只保留工作流选择和新建入口，不显示无效的引擎、节点选择器或空白工具栏。任务、工作流保存/执行和权限合同未改变。
- 批次 4 源码验证：`pnpm --filter lfaa-client-ui-minecraft run build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter @yubboo/lfaa test -- tests/minecraft-task-workspace.test.mjs`（9/9）、Taste `lint.mjs`（6 个 UI 源文件，0 FAIL / 0 WARN）、`git diff --check` 均通过。`pnpm run build:web` 成功，构建输出仅位于根 `dist/apps/web`；`node scripts/runtime-build-state.mjs web` 返回 `[]`。
- `tests/workflow-core.test.mjs` 未通过：SQLite 迁移版本断言仍期望 `PRAGMA user_version` 为 73，当前数据库 Owner 返回 76；本轮只改了 Minecraft UI，没有改该数据库实现或测试。工作流核心回归因此不构成通过证据。
- 批次 4 内置浏览器实页：`/games/minecraft/tasks` 在 820×520 与 390×844 验收；手机统计为易读的 2×2，两种视口均无横向溢出。`/games/minecraft/workflows` 在 1440×900、820×520、390×844 验收，标题、状态、选择/新建入口和空状态文案均完整可达，无横向溢出。工作流页面未创建、保存、运行或删除内容；任务页面未创建、删除或取消任务。截图在本轮 ChatGPT 内置浏览器实际页面中查看，未另存图片。
- 最终 Web 实页使用隔离预览账户与 `dist/.tmp/minecraft-ui-review/{home,data,harness}`，没有连接 Daemon 或真实节点；真实节点、实例、任务和工作流均为空。登录后的系统启动提示在该隔离账户内产生了一次 `PUT /api/settings/general`（200）；Appearance 主题/壁纸/动效、Minecraft 运行默认值和正式账户均未修改。工作流路由保持现有认证要求，因此没有使用另启、无认证的 Taste `inspect.mjs` 浏览器覆盖实页验收；IAB 已登录页面截图用于最终视觉审阅。Taste `lint.mjs` 为 0 FAIL / 0 WARN；Impeccable `detect --json` 返回 `[]`。
- 性能观察：无新增请求、订阅、定时器或观察器；所有读取继续走现有共享工作区路径。未测帧时间、长任务与真实服务器节点性能，也未测试用户主题/壁纸切换后的多主题实机差异。
- **最终文件：** `docs/PROMPTS.md`、本合同、`packages/client/ui-minecraft/README.md`、`PRODUCT.md`、`DESIGN.md`、`src/MinecraftWorkspace.tsx`、`src/MinecraftWorkspace.css`、`src/DaemonConnections.tsx`、`src/MinecraftDeploymentPanel.tsx`、`src/MinecraftWorkflowCanvas.tsx`、`src/MinecraftWorkflowCanvas.css`。

## 2026-10-30 后续修正：实例详情重复导航

- 用户指出 Minecraft 实例详情的四个入口同时出现在左侧「当前实例」和页面顶部页签。截图标注表达保留页面顶部页签、移除侧栏重复项。
- 本批入口为 App 模式 `/games/minecraft/<instanceId>/{overview,configuration,logs,backup}`。左侧应用导航由共享 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 持有；其中仅移除「当前实例」标题和四个重复链接，父级「管理 → 实例」仍标记当前区域。页面内四个顶部页签仍由 `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 持有，并继续驱动相同路由。
- 不改路由、设置、领域数据、API、认证、角色检查、操作权限或任何服务器动作；不新增订阅、轮询或动效。设置中心配置不变，Appearance 与响应式 Dock 几何仍由现有共享 Owner 控制。
- UI Skills 复核：Taste app-screen、Impeccable Operate、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI 均按当前栈读取；Pro Max `ux` 搜索确认当前页应清楚显示选中状态，故保留顶部 `aria-current="page"`。Audit Skills 不覆盖 TypeScript/CSS，不报告为专项安全扫描。
- **批次 1 计划：** 删除重复侧栏子菜单及其专属样式；更新 `ui-workspace` README 记录实例详情由页面内页签切换。验收桌面、窄分栏和短屏下侧栏仍保留父级实例入口，所有四条现有路由不变。运行受影响 UI 包构建、Client 类型检查和 Web 构建，再用内置浏览器检查当前源码路由。
- **批次 1 实施：** `ApplicationWorkspace.tsx` 不再生成「当前实例」分组及四个重复链接；`right-menu.css` 删除仅供该组使用的两个样式。父级「实例」菜单项仍对实例子路由显示选中状态。`MinecraftWorkspace.tsx`、路由与顶部页签未改；`ui-workspace/README.md` 记录左右导航职责。
- 源码与构建验证：`pnpm.cmd --dir packages/client/ui-workspace build`、`pnpm.cmd --dir packages/client/ui-minecraft build`、`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd run build:web` 均通过；Web 转换 3905 个模块，所有产物写入根 `dist/`。`node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。没有导航专用自动化用例，本批以包构建、类型检查和实页验收覆盖；未测帧时间。
- ChatGPT 内置浏览器实页：正式服务由当前 checkout 启动，路由 `/games/minecraft/instances`，使用隔离数据目录，因 3000 端口有来源无法确认的服务而使用 3001；未触碰既有监听服务。1440×900 桌面显示「管理 → 实例」为当前入口，侧栏不再出现「当前实例」组；820×520 打开窄栏后父级入口仍可见且无横向溢出；390×844 手机布局文案换行、页面内容可见，无横向溢出。截图在当前内置浏览器验收输出中查看，未保存独立图片。
- 验收限制：隔离账户没有实例，无法在真实实例详情页目视验证四个顶部页签；页面组件与路由未改且 Client/Web 构建通过，但顶部页签的当前交互状态本轮未实测。内置浏览器登录仅初始化隔离账户与一个默认工作区记录；没有设置写入、节点连接或 Minecraft 操作。服务已停止，端口 3001 已释放，`dist/.tmp/minecraft-nav-review` 临时目录已清理；真实账户、偏好和端口 3000 的服务未改动。
- 本批文件：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`（移除重复导航）、`packages/client/ui-workspace/src/css/right-menu.css`（删除随之失效的样式）、`packages/client/ui-workspace/README.md`（记录导航职责）、本合同（记录本批目标和验收边界）及 `docs/PROMPTS.md`（更新任务状态）。
- **最新源码复核：** 2026-10-30 的配置页修复纳入 `properties-read` 任务状态和页面标签，补齐此前 `taskLabel` 类型缺口。Minecraft/UI Owner 包、Client/Host 类型检查、Control Plane/Web 构建通过，`node scripts/runtime-build-state.mjs web` 返回 `[]`。正式内置浏览器使用已有实例路由 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/configuration`；1506×1244、768×900、390×650 均无横向溢出，显示真实 Daemon 离线状态且没有配置默认值。该实页不代表真实属性回读或写回已验收。

## 2026-10-30 补充：控制台只保留共享终端

- 用户明确纠正：不能将“日志面板 + 命令框”另做成第二种终端；Minecraft 实例控制台必须使用系统唯一的 Terminal Manager/xterm 表面。节点在线且实例运行时自动选中该实例唯一的受管服务端 PTY，键盘原始输入和进程输出直接走这条 PTY；不自动新建 Shell。玩家明确点击 Shell 后，才在同一管理器中创建独立的实例目录 Shell 标签。
- PTY 不可用时（实例未运行、节点离线、权限不足、节点未登记能力或连接失败），终端位置只显示明确原因并禁用输入；日志快照始终留在独立日志页，不得把日志伪装成终端输出。状态恢复后按真实状态重连/自动附着。重新选择会话时焦点落到活动 xterm；快捷命令仍写入当前活动服务端 PTY。
- 终端管理器只装配一次，服务端会话按实例唯一目标复用；手动新建 Shell 才新增会话，仍受当前节点 8 会话硬上限与 Controller/Daemon 重复目标校验保护。不增加日志轮询、Socket 订阅或单独命令框。
- 任务页四个状态计数改为同页任务筛选入口，点击另一个状态即可切换，重复点击清除筛选；计数继续由当前真实任务数组计算。筛选/导航不更改任务或实例数据。
- 设置沿用 `settings.permissions.mode`、通用终端 `settings.general.integratedShell`/`settings.general.taskFolder`、Minecraft Runtime 与现有 Appearance 字体/字号/主题/强调色/壁纸遮罩/模糊/减少动态效果；不新增设置、不更改用户偏好。控制台发送继续由 Minecraft 管理权限、认证 API、Terminal Controller 与目标 Daemon 校验。
- **补充批次 5a：** 共享终端自动选择服务端 PTY、分离日志页、显示未连接原因并恢复活动标签焦点；终端不回退显示日志快照。验收运行中在线实例恰有一条对应服务端标签且 xterm 可输入；明确创建的 Shell 保持独立且不会覆盖自动附着的服务端标签。
- **补充批次 5b：** 将任务状态统计改为有选中态的本地筛选；切换显示对应真实任务并允许清除筛选。浏览器只切换筛选，不删除、取消或执行任务。
- 真实节点仍在线且实例可用时，浏览器验收仅发送只读 `list` 检查输入、真实回显和实例对应关系；不执行启停、配置、备份或删除。若节点当前离线，则记录连接状态，只验只读回退及导航/筛选，不重启活动进程或 Daemon。

### 用户澄清：Minecraft 进程终端与日志严格分开

- 用户明确说明：整个系统使用同一种 Windows 终端界面（命令提示符/PowerShell 风格），普通 Shell 和 Minecraft 都使用系统现有共享 Terminal Manager。Minecraft 实例需要时，应在该终端里显示启动脚本/Java 服务端进程的真实输出，并把键盘输入写回该进程；单个实例不创建多个终端或重复入口。
- Minecraft 日志页继续展示日志。不得把日志快照、日志轮询内容或只读日志伪装成终端输出；没有附着真实服务端进程时，终端显示未连接/不可用原因并禁用输入，日志仍留在日志页。
- 这一澄清取代本节上一版“PTY 不可用时在终端显示日志快照”的描述。真实进程的 PTY/stdio 生命周期和会话唯一性以共享终端 Controller/Daemon Owner 为准；不得为解决 UI 假象而再启动一次实例、重启 Daemon 或另加命令接口。
- 本批验收检查单实例只存在一个受管服务端会话、启动后的真实进程输出和原生标准输入回写、日志页独立；节点不可达时只检查未连接态。只读 `list` 仅在已确认会写入同一真实服务端 stdin 时执行，且不与服务器启停等操作混用。
- **实施切片 5a：** 实例详情分开提供“终端”和“日志”页；终端不接收日志 API 数据，未连接只显示原因；Daemon 通过受限内存缓冲回放该实例 ConPTY 的原始 stdout，后续继续走同一 PTY；Dock 更新状态时不注销/重挂会话，保持终端焦点和单实例附着。
- **实施切片 5b：** 任务状态统计改为同页实际任务筛选，保留未筛任务的多选状态；筛选无任务写入。

### 2026-10-30 终端/日志与任务筛选补充实施

- **终端与日志：** `MinecraftWorkspace.tsx` 新增独立“终端”和“日志”页；原来的 `logs` 路由现在只显示日志 API 快照，原始终端面板在 `terminal` 路由。`TerminalManagerProvider.tsx` 删除日志快照回退、筛选/自动滚动日志区和日志属性，默认只附着该实例的受管 Minecraft PTY。Dock 状态更新不再注销/重挂终端，真实 PTY 活动后聚焦 xterm；快捷命令向活动 Minecraft PTY 发送后把焦点还给 xterm。
- **真实输出续接：** Daemon 只缓存受管实例 PTY 的原始 stdout，缓冲最多 128 KiB、只在进程内存保存；附着时先回放该 PTY 缓冲，再接收同一 PTY 的实时流，进程退出清除缓冲。独立日志页继续使用既有日志读取/Socket/REST 和来源筛选，不给 PTY 伪造日志内容。Minecraft 当前由 Java 进程直接在受管 ConPTY 中启动；所提供 `start.bat` 是手动启动器，当前应用流程不额外执行一份脚本或服务器。
- **任务状态筛选：** 四项真实任务计数现在是可选状态按钮；点击可筛选任务记录，再点同一状态或“清除筛选”恢复全部。过滤器仅改变当前列表。`TaskList` 的批量选择以未过滤任务集合校验与持久化，筛选状态不会静默清掉隐藏任务的已选项。
- **代码验证：** `ui-sidebar-terminal`、`ui-minecraft`、Daemon、Client 类型检查、Web 与 Control Plane 构建及 `tests/interactive-terminal.test.mjs`（7/7）通过；`runtime-build-state web/host` 均为 `[]`，构建输出只进入根 `dist/`。当前 Impeccable 检查与最后一轮 UI 检查待本批收尾运行。
- **正式内置浏览器未验收：** Web 当前 PID 30736 通过本机监督 Daemon PID 28404 托管 Minecraft Java PID 44888。完成 Web/Control Plane 构建后，从内置浏览器打开新 `/terminal` 路由时命中 LFAA 运行时保护页：“LFAA Web 或控制端构建文件在服务运行期间已更新”。按 CLI 生命周期检查，重启 Web 会调用 `supervisor.stop()` 并影响其托管 Daemon，因此本次未停服务或服务器。`/terminal`、`/logs`、任务状态筛选的桌面/窄分栏/短屏实页、键盘焦点与在运行实例上的 PTY 重连/输入回显仍待在不影响该活动实例的安全重启条件下验收；旧 PID 提供的页面不能作为新实现通过证据。

### 补充批次 5c：控制台空间布局

- 用户明确要求按参考图重新安排终端页：中间只留真实服务端终端及必要会话控制；实例状态和快捷命令放在工作台最外层右侧菜单（红框箭头所指的 App 侧栏），不放进终端组件内部。终端使用中间工作区剩余高度，底部不保留固定 720px 高度造成的空白。
- 页面标题简化为“控制台”，删掉解释性副标题，并隐藏实例页面上无关的“新建服务器”入口；嵌入模式只显示当前实例的服务端 PTY 标签，不把通用 Shell 标签或新建 Shell 操作混进服务端终端区；全局终端管理器仍负责通用 Shell。保留共享实例导航、刷新状态、共享 Terminal Manager 和真实 PTY 输入/输出。日志仍是独立日志页。
- 状态只展示当前真实节点、实例状态、服务端版本、端口和配置内存；不照搬参考图中当前没有权威采样来源的 TPS、CPU、在线人数、延迟或命令历史。主题与颜色、字体、字号、壁纸/遮罩/模糊及减少动态效果继续使用 Appearance/共享终端映射；不新增设置。
- 目标 Owner：`packages/client/ui-minecraft` 控制台页面/页面尺寸；`packages/client/ui-sidebar-terminal` 共享终端及右侧面板数据/命令动作；`packages/client/ui-workspace` 只负责把公开的 `TerminalManagerRightSidebar` 放进最外层右侧菜单。权限、命令执行、PTY/输出、实例与节点事实仍由现有 Terminal Manager、Minecraft API/领域及 Daemon 持有；本批不增加命令接口或会话。
- 验收：`/games/minecraft/instance/<id>/terminal` 常规视口中终端填满中心工作区剩余高度且无下方大块空白；右侧菜单显示真实节点、实例状态与快捷命令；终端区没有第二个运维侧栏。窄分栏下按实际右栏宽度重排、无横向溢出且命令仍可达；短屏中终端仍可操作并可滚动；继续检查日志页分离和同一实例 PTY 标签未被重复创建。必须记录当前源码正式 Web 页面、视口、截图和未测范围；不得重启可能托管活动 Minecraft 进程的服务来绕过运行时保护。

#### 用户再次校正：右侧菜单是工作台最外层栏

- 前一版把状态和快捷命令放在控制台卡片内部，用户明确指出箭头指向的是最右侧 `module-context` 应用侧栏；前一版布局视为未验收，不能描述为用户认可。
- 当前实现从共享 Terminal Manager 向 `ApplicationWorkspace` 提供 `TerminalManagerRightSidebar`，仅在 Minecraft App 使用该数据时渲染；控制台中间变为单列真实服务端 PTY。右侧工具卡数据仍由共享管理器提供；离开实例控制台后清除；Minecraft 右侧栏隐藏泛化说明卡以腾出操作空间。
- 快捷命令仍发送到当前活动 Minecraft PTY，发送后恢复 xterm 焦点；真实日志继续留在日志页。没有增加终端会话、轮询、订阅或命令 API。窄右栏通过该区域自己的容器断点把快捷命令与状态字段改为单列。
- 设置：继续读取 `settings.permissions.mode` 与共享 Appearance 主题/颜色、字体/字号、对比度、背景/遮罩/模糊及减少动态效果映射，不新增设置或改偏好。
- 本更正验证：`node --test apps/cli/tests/minecraft-task-workspace.test.mjs` 9/9 通过；`ui-minecraft`、`ui-sidebar-terminal`、`ui-workspace` 三个 Owner 包构建通过；`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json` 通过；Web Vite 构建 3907 个模块通过，输出隔离在 `dist/.tmp/minecraft-terminal-review`，未覆盖正式 Web 文件，验收后已清理。`git diff --check` 通过。
- ChatGPT 内置浏览器使用现有源码 Vite 页 `http://127.0.0.1:5173/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/terminal`：1750×1244 桌面检查确认状态/快捷命令在最外层右栏，中间终端占满剩余区，实例子页没有“新建服务器”按钮；820×520 窄短屏检查确认右栏可纵向滚动到快捷命令、页面宽度未横溢、中间控制台保持单列。临时窄视口已恢复；截图在本轮内置浏览器输出中查看，未另存文件。
- 实例真实状态为已停止，快捷命令因此正确禁用；未启动/停止实例、未向 PTY 发送命令，故本轮只验布局和真实状态呈现，不把命令执行描述为已验。正式 Web `127.0.0.1:3000` 未重启；该页面使用 5173 源码开发服务器。浏览器日志保留着较早的 Vite 动态模块加载错误，本次刷新后页面可渲染，但正式生产 Web 验收仍未完成。无新设置项或偏好写入；继续沿用 Appearance/终端映射。

### 补充批次 5d：左二独立日志入口

- 用户指出实例页签中的“日志”与实例操作挤在一起，要求将日志移到截图箭头所指的 Minecraft 左二菜单位置，使日志独立展示。
- `packages/client/ui-workspace` 只负责在 Minecraft「管理」菜单增加“日志”入口及当前路由态；`packages/client/ui-minecraft` 负责独立日志页和真实实例选择。日志内容继续通过既有 `loadMinecraftInstanceLogs` 与 Minecraft Socket/轮询 Owner 读取；不新增 API、轮询、订阅或假日志。
- 日志页可从真实运行实例优先、否则首个真实实例作为默认目标，并可切换账户可见实例；在实例详情中打开日志时保留目标实例。旧 `/instance/<id>/logs` 地址继续映射为独立日志页。实例详情的页面页签不再包含日志；从任务失败提示等现有入口导航到新的独立日志路由。
- 无实例、实例记录失效、读取中/失败均呈现实际状态；切换目标取消旧请求并清理轮询，不更改服务器、配置、日志或用户偏好。沿用现有 Appearance/主题与 `settings.permissions.mode`，不新增设置。
- **验收目标：** 左二「管理 → 日志」能独立打开中心日志页面；日志页不显示实例详情页签或终端，选择不同真实实例会读取对应实例日志；筛选/自动滚动仍可用；历史日志入口仍正常跳转。桌面、窄分栏与短屏布局无溢出，日志内容可滚动。只进行读取和本地筛选，不启停服务端或发送控制台命令。
- **实施完成：** 左二「管理 → 日志」进入独立服务端日志页，页面提供真实实例选择、来源筛选和自动滚动；旧 `/games/minecraft/instance/<id>/logs` 路由仍呈现同一独立页。实例详情页签已移除“日志”，日志页不装配服务端 PTY/终端。
- **真实页面验收：** ChatGPT 内置浏览器打开当前源码 Vite 服务 `http://127.0.0.1:5173/games/minecraft/logs`，视口 1750×1244。截图确认左二“日志”高亮，中心页加载实例 `xiaoyu-e2e-paper1122-20261026 · Paper 1.12.2` 的真实 500 条日志，日志视口填满中心区；直接访问旧 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/logs` 后，再点左二入口会回到独立 `/games/minecraft/logs` 页面。现有数据只暴露一个实例，因此没有第二个实例可用于页面切换验收。截图由内置浏览器实页捕获并目视检查，未另存到仓库。
- **响应式未实测范围：** 当前 CUA 内置浏览器接口不提供视口覆盖；为了避免拖动并持久化用户工作台分栏偏好，本批未改浏览器/工作台尺寸，因此窄分栏和短屏没有实页证据。源码保留日志页自己的窄容器筛选器横向滚动、日志文本换行以及 520px 短屏纵向滚动规则；这些只算源码检查，不算设备实测。
- **验证：** `ui-workspace`、`ui-minecraft` 构建通过；`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json` 通过；`apps/cli/tests/minecraft-task-workspace.test.mjs` 10/10 通过；`git diff --check` 通过；Impeccable detector 对三个改动 UI 文件返回 `[]`；Web 构建 3907 个模块成功，隔离构建输出位于仓库根 `dist/.tmp/minecraft-logs-review`。该临时目录仍存在；尝试清理时本机命令策略拦截了删除操作，未改用其他删除方式。
- **构建运行边界：** 第一次尝试通过 pnpm 转发 `--outDir` 时，Vite 收到结束标记后忽略后续目录参数，实际更新了根目录 `dist/apps/web` 生产构建输出。随后直接调用 Vite 已在 `dist/.tmp/minecraft-logs-review` 成功完成隔离构建。两次都未重启 Web、Control Plane 或 Minecraft 实例；本批实页仍使用 5173 源码服务器。正式 3000 Web 页面未重启验收，以免触碰当前托管 Daemon/Minecraft 的服务生命周期。

### 2026-10-30 用户反馈：Minecraft 全域视觉与响应式不合格

- 用户要求直接检查并修复 Minecraft 应用各处布局，明确指出间距、视觉效果、动画、文案和响应式均不符合预期。附件截图来自 `/games/minecraft/tasks`，1504×1655；任务正文在左、操作被推到下一条横线下方，卡片层级只有细分隔线，页面缺少清楚的分组与交互反馈。
- 前一版 `true-black-flat` 视觉只作为历史版本记录，不能视为通过。本次方向改为有层次的运维工作台：统一页面节奏与信息权重，重要状态/入口可识别，分组表面有真实层级；用户本轮确认沿用 LFAA 深色运维风格，强化层次、留白与有意义的动效。实际主题、强调色、字体、字号、对比度、壁纸/遮罩/模糊仍读取 Appearance 设置，主题切换后随设置变化。界面文案去除重复解释，保留真实能力边界、操作前置条件与 EULA。
- 动效按原因使用：卡片列表入场和可点击卡片反馈复用 `general.cardMotionEffect` 的 `.lfaa-card-motion`，减少动态效果与系统偏好继续由共享 Theme Owner 控制；不增加持续循环特效、重复动画引擎或新的动效设置。状态特效必须绑定真实节点/实例/任务状态。
- 全域范围限于 `packages/client/ui-minecraft` 的真实视图：总览、节点、部署、实例列表/详情、任务、日志、控制台页面容器、工作流及包内联机引导；终端控件本体仍归共享 Terminal Manager。Java 环境和独立联机管理继续由各自 Owner 持有，不复制其页面或规则。认证、权限、真实服务端数据和行为合同保持不变。
- 响应式必须按工作区容器宽度和高度验证，而非只按桌面窗口；覆盖桌面、平板、手机、窄分栏及短屏。卡片和操作在窄宽下重排、文字可读、页面无意外横向溢出；内容区域和终端/日志可用滚动，关键操作触达。所有 CSS 盒子只由 Minecraft 页面 Owner 管理并限定在明确父/子区域。
- 设置与权限继续采用本合同设置中心盘点：`general.cardMotionEffect`（默认 `fluid`）、`appearance.advanced.reducedMotion`（默认 `system`）、主题/强调色、字体/字号、对比度、壁纸/遮罩/模糊、Minecraft 运行时设置；不新增设置、不写用户偏好。动态仅消费现有 `.lfaa-card-motion` 与 `data-reduced-motion` 映射。
- 技能按职责取用：Taste `app-screens` 仅用于运维屏检查；Impeccable `operate` / `layout/adapt` 用于信息层级与响应式；Baseline UI 用于间距、对比和控件检查；UI Motion 只指导复用现有用户动效设置的反馈；UI/UX Pro Max 用于窄容器、触控尺寸和长内容核对。用户明确要求技能按需分工，不把不同技能的风格拼成一套。`Audit Skills` 的 Java/.NET/PHP 覆盖不适用于本次 TSX/CSS，不能宣称做了对应的安全扫描；安全仍通过审阅现有 Client/API/Permission Owner 边界确认。
- **补充批次 6a：** 修复页面根层级、状态摘要、任务记录和常用列表/卡片的间距、对齐、表面层次与交互动效；确保用户截图中的“查看详情”、取消、删除和选择操作在桌面同一行的操作列内对齐，窄容器按触控/可用宽度重排。先在 `/games/minecraft/tasks`、`/games/minecraft/overview`、`/games/minecraft/nodes`、`/games/minecraft/instances` 验收并记录截图和无写入交互。
- **补充批次 6b：** 修复部署向导、任务详情/日志、实例配置/备份/控制台容器、工作流及联机引导中实际存在的层级、留白和响应式问题；关键确认、真实输入/输出、日志与授权逻辑不变。按每个可访问路由逐页验收；真实实例所需页面只做读取和布局检查，不提交部署、不写配置、不创建备份、不启动/停止或发送终端命令。
- 每批继续按仓库边开发边验收要求运行直接相关回归/类型检查/包构建，并使用 ChatGPT 内置浏览器实页；记录实际路由、宽×高、换行/溢出/滚动、交互及截图。正式 Web 3000、源码 Vite 5173 和当前服务状态必须核实；Web PID 32588 与 Vite PID 28412 归本 checkout，其中 3000 的健康检查为 `ready`，当前 Web 指纹检查返回 `[]`，不重启可能托管活动 Daemon/Minecraft 的 3000 服务。验收使用安全的隔离账号/目录；不能隔离或验证时说明具体阻碍，不把源码断点检查或截图估测标为响应式实测。

### 补充批次 6a/6b 实施与当前实页验收

- 用户确认最终视觉方向为 LFAA 深色运维风格；技能各按职责取用。任务记录改为内容与动作分区，桌面操作列右对齐，窄屏动作留在记录卡内；任务状态摘要按容器宽度换列。总览、节点、实例和工作流使用有层次的表面、清晰留白，并复用 `general.cardMotionEffect`；日志页移除重复标题，保留真实日志条数。配置页窄容器修复桌面 `360px` flex 基准造成的垂直留白；任务详情弹窗居中，并把正文高度限制到可用视口内，短屏仍可滚动且关闭按钮可达。
- 变更由 `packages/client/ui-minecraft` Owner 承担；入口、API、状态、数据、角色与权限合同未变。没有新增设置，也没有改写账户偏好；外观和动效继续读取 Appearance / `general.cardMotionEffect` / 减少动态效果共享映射。没有新增轮询、订阅、计时器、观察器或 JS 动画。
- ChatGPT 内置浏览器使用当前源码 Vite `http://127.0.0.1:5173`，记录真实账户的实际数据：1 个在线节点、1 个运行实例、7 条已完成任务、500 条服务端日志；只浏览或切换页面，没有更改实例、任务、配置、备份、工作流或设置。
- 桌面 1440×900：`/games/minecraft/overview` 显示真实节点到实例关系、3 项实际摘要和动效设置 `fluid`；`/games/minecraft/logs` 只显示一个“服务端日志”标题，日志区实际装载 500 条并在自身滚动。两页均无横向溢出。`/games/minecraft/deployment`、`/games/minecraft/nodes`、`/games/minecraft/instances`、`/games/minecraft/tasks`、`/games/minecraft/workflows` 也已在当前浏览器查看；没有执行部署或实例操作。
- 手机 390×844：`/games/minecraft/tasks` 状态摘要为 2×2、详情/删除动作留在卡片内；`/games/minecraft/workflows`、`/games/minecraft/instances`、`/games/minecraft/nodes`、`/games/minecraft/deployment`、实例 `/overview`、`/configuration`、`/backup`、`/logs` 均无页面横向溢出，长内容纵向可达。配置页标题下的按钮/快照行已由初测约 433px 位置上移到约 423px，表单从约 766px 上移到约 508px，消除了空白区域。
- 短屏 820×520：任务页无横向溢出，第一条记录的操作按钮仍处于可滚动页面内；日志输出区域高度约 161px、500 条记录在内部滚动，页面无横向溢出。任务详情弹窗锚定到当前 `.module-center` 工作区，不覆盖左侧导航；390×520 时尺寸约 310×487、正文 350px 内部滚动、关闭操作可见且遮罩滚动高度等于视口；820×520 时弹窗约 722×487，仍在 754px 工作区内；390×844 时约 310×745 且完整落在工作区内。日志实例选择器在 390px 内容宽度内铺满可用区域。
- 只读打开一条真实已完成任务详情，确认任务状态、节点、实例、执行回报和结构化输入仍显示真实数据；没有点击删除/批量删除。世界备份按钮因实例运行而按既有状态禁用，未发起备份。控制台页内容未打开，避免对当前运行的 Minecraft PTY 建立会话；Java 环境和独立联机管理属于各自 Owner，不纳入本次视觉改动。
- Minecraft 的“Java 环境”入口会进入共用 `/games/environments`，该页在 390×844 可读、无横向溢出；没有安装、校验或卸载运行时。Minecraft `/games/minecraft/connectivity` 入口在 390×844 无横向溢出，短文案直接说明管理范围；“打开联机服务”进入独立 `/apps/connectivity/normal`。共用环境管理页及联机服务各子页面均属自己的 Owner，本轮只检查入口与手机布局，没有重写它们。
- 源码验证：`pnpm --filter lfaa-client-ui-minecraft run build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`node --test apps/cli/tests/minecraft-task-workspace.test.mjs`（10/10）、Taste lint（11 个文件，0 FAIL/0 WARN）、Impeccable detector（`[]`）、`git diff --check` 通过；包构建产物只写入根 `dist/packages/`。Taste `inspect.mjs` 使用独立临时 Chrome 用户目录，无法继承已登录内置浏览器会话；为避免把登录页当成产品页，本轮用实际已登录的 ChatGPT 内置浏览器逐页目视验收。内置浏览器实页使用当前源码开发服务，正式 Web 3000 未重启。没有测帧时间，也没有切换账户主题、壁纸或减少动态效果做多偏好对照。

### 补充批次 6c：配置属性表单实页回归

- 修复联动开发时暴露的配置页运行时引用错误：旧白名单编辑器已迁走，页面仍引用其旧变量；现在表单由真实快照条目生成，覆盖本次读取到的 34 个属性，并按已识别类型提供布尔、枚举、数值输入，其他项使用文本输入。无快照时不伪造默认值；敏感值不回显，空白不进入替换请求，输入后再清空也不会误清除旧值；只有存在有效变更且实例已停止等原有 Owner 条件成立时才允许保存。
- 真实配置路由：`/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/configuration`。ChatGPT 内置浏览器查看现有真实节点快照（34/34 个属性；快照时间 2026-10-30 11:30；1.12.2 文件没有 `simulation-distance`）。桌面 1440×900 两组表单并列、平板 768×900 组卡并列；手机 390×844 单列；390×520 短屏滚至底部后仍能触达表单操作。DOM 检查：390px 和 768px 下 `documentElement.scrollWidth === clientWidth`；390×520 操作区可见，字段列宽约 260.7px、组宽约 294px。所有字段可见且敏感输入为空白；真实实例仍在运行，因此保存正确保持禁用。
- 返回任务列表 `/games/minecraft/tasks` 后页面真实显示 7 条已完成任务，没有 `minecraftPropertyEditors` 崩溃。没有刷新或创建额外读取任务，没有编辑或保存属性、泄露敏感值、改变实例状态或用户设置。截图证据在本轮内置浏览器实页状态中；正式 Web `3000` 未重启，验收使用当前源码 Vite `5173`。
- 直接验证：`pnpm --filter lfaa-client-ui-minecraft run build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`node --test apps/cli/tests/minecraft-task-workspace.test.mjs`（11/11）、Taste lint（11 个文件，0 FAIL/0 WARN）、`git diff --check` 均通过。属性回写没有在正在运行的用户实例上操作；隔离文件/Daemon 写回回归与真实停服写回未在此批执行。新增/修改样式没有新增 CSS 变量；沿用 `general.cardMotionEffect`、减少动态效果与 Appearance 共享映射，未测帧时间。

### 补充批次 7：部署、实例、日志页面二次检查

- 用户要求再检查部署、实例、日志菜单的 UI 与响应式表现。当前页面 Owner 仍为 `packages/client/ui-minecraft`；真实部署、实例和日志数据继续由原 Minecraft API/Daemon、认证与 Permission Owner 持有。允许修改这三页呈现和日志的展示格式，不提交部署、不改实例/日志数据、不启动或停止服务端、不改账户设置。
- 设置继续使用已映射的 `general.cardMotionEffect`、`appearance.advanced.reducedMotion`、主题/强调色、字体/字号、背景/遮罩/模糊和 Minecraft Runtime 默认值；本批不新增设置，不更改用户偏好。技能仅按仓库硬规则读取六项 UI 技能；不混用额外视觉风格技能，Audit Skills 的 Java/.NET/PHP 扫描范围不覆盖本次 TSX/CSS。
- 检查基线已确认 `/games/minecraft/instances` 桌面单卡宽度约 267px，长实例名被挤成三行；日志行含被控制符替换出的 `�`。部署页重复表述核心/版本/EULA，选中核心说明重复出现在卡片与摘要区。Vite 5173 由当前 checkout 的 `apps/web/node_modules/.bin/vite` 进程运行；保留正式 Web/Daemon 与运行实例状态，不重启服务。
- **批次 7 实施：** 实例卡片改为 260px 起步的身份列，长名称与状态独立排列；部署页缩短重复说明并移除选中核心的重复描述，同时保留来源校验、节点选择、EULA 和许可证事实；日志仅在展示时移除 ANSI 序列、不可见控制符和特定边界替代符，单条显示仍限 4096 字符，不改写持久化数据。短屏日志窗最小高度从 150px 调整到 120px，使 390×520 窗口底部完整落入视口。另在回归中发现同工作树的敏感配置清空分支偏离 6c 既有验收且造成类型推导失败，恢复“空白不发出替换项、保留旧值”的已验行为；不扩大本批配置编辑范围。
- **批次 7 设置与性能：** 沿用 `general.cardMotionEffect`、`appearance.advanced.reducedMotion`、主题/颜色/字体/字号/壁纸/遮罩/模糊及部署 Runtime 设置；没有新设置或偏好写入，没有增加请求、订阅、计时器、观察器或动画循环。日志格式化对最多 500 条、每条最多 4096 字符执行有界字符串处理；没有测帧时间。
- **ChatGPT 内置浏览器实页：** 使用当前 checkout 的 Vite PID 28412（命令入口 `E:\lfaa1\lfaa\apps\web\node_modules\.bin\vite`，地址 `http://127.0.0.1:5173`），没有重启正式 Web 或可能承载活动实例的服务。桌面 1280×720 的 `/games/minecraft/instances` 卡片宽 1098px，实例标题高 24px、单行显示；页面 `scrollWidth/clientWidth=1280/1280`。同尺寸的 `/games/minecraft/deployment` 真实目录显示 5 类核心、68 个版本，页面无横向溢出。
- **手机与窄屏实页：** `/games/minecraft/deployment` 在 390×844、320×600 单列换行、版本列表纵向可滚；320px 宽时工作区 248px、文档宽度 320/320，核心分类轨道局部横向滚动（441/224px），部署“下一步”在页面下方可达并处于 enabled 状态。`/games/minecraft/instances` 在 390×844、320×600 无页面横向溢出，状态摘要转为 2×2，实例信息与操作分组纵排；向下滚动后启动/安全停止/管理/删除按钮可见，真实运行实例的禁用/可用状态未变化。`/games/minecraft/logs` 在 390×844 的日志区为 294×428px，文档宽度 390/390；短屏 390×520 时日志区为 294×126px、底部 y=516，位于视口内，500 条内容在内部滚动。
- **日志和运行边界：** 内置浏览器打开真实日志页显示 500 条、无 `�` 字符；标准输出筛选从 500 条降为 499 条，再恢复“全部”，没有改动服务端日志。浏览器控制台错误列表为空。未创建/提交部署、未接受 EULA、未读取或保存 server.properties、未创建备份、未启动/停止/删除实例、未打开当前运行实例的 PTY、未改账户设置。手机实页、主流桌面与短屏均完成；没有物理手机/平板、多主题对照或帧时间测量。
- **源码验证：** `pnpm --filter lfaa-client-ui-minecraft run build` 通过（产物位于根 `dist/packages`）；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`node --test apps/cli/tests/minecraft-task-workspace.test.mjs` 12/12 通过；Taste lint 扫描 11 个 TSX 文件，0 FAIL/0 WARN；`git diff --check` 通过。批次文件包括 `MinecraftWorkspace.tsx`（日志展示格式化与部署页标题说明）、`MinecraftWorkspace.css`（实例列和短屏日志高度）、`MinecraftDeploymentPanel.tsx`（减少重复部署文案）、`README.md`（说明布局和日志显示策略）、任务回归、提示索引与本合同。

### 批次 8：修复日志过滤后的宽度塌缩与控制台自动附着

- 用户补充指出日志筛选页右侧空白、实例控制台要求手动重试；本批检查日志、实例配置与 `/terminal` 的实际源码页，不触碰运行实例命令或生命周期。
- 真实复现：内置浏览器当前源码路由 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/logs`，视口 1280×720。日志卡片宽 808px；全部 500 条时视口同为 808px，点击“错误”显示 0 条后视口收缩至 303px，点击“系统”显示 1 条后收缩至 449px。过滤只改变本地显示状态，500 条数据没有删除或改写。深入测量确认外层 Card 的横向 Flex 排列使 `.ant-card-body` 按当前内容宽度收缩；仅给 Grid 轨道设 `minmax(0, 1fr)` 无效。
- 配置页复核：同实例 `/configuration` 真实路由、1280×720，读取到真实快照 34/34 项；两类属性分组各自使用双列字段布局，当前可用宽度内没有复现空列/字段错位。本批不改配置值、保存语义或设置偏好；后续若用户提供具体字段/视口故障，沿配置 Owner 单独复现。
- 控制台复现：同实例 `/terminal` 显示运行中的实例和在线节点，但标签状态“未连接”、没有输出且无错误提示。源码入口 `packages/client/ui-renderer/src/render.tsx` 使用 `React.StrictMode`；`TerminalSessionPane` 的自动启动 effect 同步发起请求，同时会被开发模式首次挂载清理，`autoStarted` 一次性标记使第二次 effect 不再启动。实际修复让自动启动等待可取消的下一轮事件循环，使 StrictMode 的模拟清理先完成，再只创建一次真实终端会话；没有绕过审批、权限或 Daemon 实例/PTy 校验。
- 实际修复：Ant Design Card 默认横向 Flex 排列导致正文按子内容缩窄；将日志 Card 改为纵向 Flex，正文与日志视口明确占满卡片宽度。
- 实页验收：源码 Vite `/games/minecraft/logs` 在 1280×720 下“全部”500 条、“错误”0 条、“系统”1 条三种筛选的卡片/正文/视口均为 808px，页面没有横向溢出。390×844 下日志区域宽 294px，320×600 下宽 224px；两者 `scrollWidth=clientWidth`。窄屏工作台右菜单为现有移动端 overlay 展开态，会遮住部分底层筛选按钮，因此只在桌面实测筛选交互；未改写工作台偏好，测试后恢复默认视口。
- 控制台实页验收：同实例 `/terminal` 在 1750×1244 下自动选中并附着正在运行、节点在线的 Minecraft 实例，显示同一真实 PTY 的 stdout 回放；按钮不再停留在要求用户重试的未连接态。没有发送命令；随后通过“断开会话”释放测试订阅，实例仍处于运行中。
- 回归/构建：`node --test apps/cli/tests/minecraft-task-workspace.test.mjs` 12/12；Minecraft UI、共享 Terminal Manager 包构建、Client TypeScript 与 `git diff --check` 均通过。验收使用源码 Vite `127.0.0.1:5173`，正式 Web `3000` 未重启，以免影响仍由现行服务托管的 Minecraft 实例。未改配置、实例、任务或设置。

### 用户追加：实例摘要与任务区分

- 用户希望实例概览改成附件图一的横向信息卡层级，并指出将近期任务嵌在实例摘要旁会混淆“实例”和“任务”。本批使用 LFAA 深色运维主题，采用横向封面/名称/状态/真实元信息/生命周期动作的信息顺序；示例封面只作为装饰图，不代表实例实际世界截图。
- 近期任务从实例概览移除，全部记录仍由独立“任务”菜单及详情页负责；不删除或更改任务数据。
- 实例卡只呈现真实的服务端版本、节点状态、端口、运行配置、创建时间、执行方式与 EULA 事实，不添加示例地址、玩家数或推算运行时长。启动、安全停止、安全重启与进入控制台继续走既有 Minecraft action API、管理员权限、节点状态、实例状态、AppContainer 能力和安全停止确认；不调用或测试真实生命周期动作。
- 使用现有 `樱花水岸` 静态 Minecraft 插画作为封面装饰，Appearance、主题、颜色、字体、字号、壁纸/遮罩/模糊及减少动态效果保持现有共享映射；不新增/修改用户偏好。
- 验收：实例概览显示单一清楚的摘要卡和运行环境区；“最近任务”只在任务页出现；在桌面、窄容器/手机和短屏检查换行、溢出与操作可达；实例操作仅静态核对按钮条件，不启动/停止/重启服务器。

### 2026-10-30 全部 Minecraft 界面批次最终验证

- 页面实测使用 ChatGPT 内置浏览器当前源码路由 `127.0.0.1:5173`；配置页完成 `1750×1244`、`1920×1080` 和 `390×520` 检查，窄屏配置中间区宽 `294px`、34 项齐全且无横向溢出。实例概览、任务、日志、部署和停服控制台实页结果分别记录于本合同与 `shared-minecraft-terminal-console-20261030.md`。
- 部署路由 `/games/minecraft/deployment` 等待真实核心目录载入后，桌面显示 5 类核心与 68 个版本；窄屏 `390×520` 的工作区为 `318px`、部署表单为 `294px`，页面 `scrollWidth=clientWidth=390`，无横向溢出。全程未选择版本或提交部署。
- 验证通过：`pnpm run build:harness`（225 个能力包）、`pnpm run build:web`、`pnpm run build:control-plane`、`pnpm run build:windows-sandbox-host`、`pnpm run typecheck`、Minecraft UI/共享终端包构建、任务工作区回归 14/14、属性文件与敏感值回归 2/2、`git diff --check`。属性敏感值回归运行在唯一临时 `LFAA_HOME`/`LFAA_DATA_DIR` 中，结束后已清理，不占用运行中控制端的数据锁。
- 构建只写根目录 `dist/`；保留现有暗色主题、Appearance/字体与 `general.cardMotionEffect` 动效，以及减少动态效果、统一权限、实例/节点和 `minecraftRuntime.minecraftStopTimeoutSeconds`；没有增加或修改设置。
- 真实实例保持已停止。没有点击启动、安全停止或安全重启，没有发送控制台命令、保存节点配置或删除任务；真实启动后的自动 PTY 重新附着过程、帧时间和物理设备未实测。正式 Web `3000` 与 Daemon 未重启，验收页面来自当前 Vite `5173`。

### 2026-10-30 实例概览摘要卡与任务分离实页验收

- 实例详情概览改为横向英雄卡：复用仓库内置樱花水岸图作为装饰，按 LFAA 深色运维主题展示真实实例名、状态、核心/版本、节点、端口、Java 与内存，以及启动/安全停止/安全重启/控制台入口；下方保留运行环境、EULA 与执行方式等真实管理信息。图片明确为空替代图，不冒充实例实际世界画面。
- 实例概览移除“最近任务”记录卡。8 条真实任务记录仅在独立 `/games/minecraft/tasks` 页面显示；实例详情不再混排任务历史。
- ChatGPT 内置浏览器源码实页：桌面 `1920×1080`、手机窄屏 `430×900` 和短屏 `390×520` 检查 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/overview`。概览卡分别为横排与单列；页面 `scrollWidth=clientWidth`。短屏滚到操作区后，操作按钮完整进入 `390×520` 可视区域。任务页同一真实账户显示 8 条已完成记录；两条页面均无横向溢出。
- 实例当前真实状态为已停止、节点在线：启动入口可见；安全停止/重启按状态禁用。验收没有触发启动、停止、重启、控制台命令、配置写回或任务删除。继续使用 Appearance/共享主题、字体和动效映射，以及实例/节点/管理员权限校验；没有新增或修改设置。
- 视口使用当前源码 Vite `5173`，未重启正式 Web `3000` 或 Daemon。未测物理设备和帧时间。
- 最终检查：`node --test apps/cli/tests/minecraft-task-workspace.test.mjs` 14/14、Minecraft UI 包构建、Client TypeScript 检查与 `git diff --check` 通过。

### 2026-10-30 概览实例操作区与核心信息位置调整

- **用户问题：** 总览实例卡内的“启动/安全停止/安全重启/终端/管理实例”挤在节点到实例关系行旁边；核心名与版本也应从实例标题下移到右侧空位，并增加对应核心图标。
- **目标运行入口与 Owner：** `/games/minecraft/overview`；唯一 UI Owner 为 `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 中的 `.minecraft-overview-hero__actions` 与 `.minecraft-overview-hero__core`，由该包的 `MinecraftWorkspace.css` 管理布局。核心名、版本与图标分支只读取同一 `overviewInstance` 的真实 `coreType`、`releaseId`；Paper 标志使用官方未修改资源，其他核心使用中性方块图标。真实权限、节点在线、实例状态及动作提交继续由原 Minecraft action API/Permission Owner 决定。
- **设置、数据与权限：** 沿用当前 Appearance 主题、字号与强调色；无新增/修改设置，无配置或运行数据写入。不得更改启停状态判断、操作回调、终端导航或权限流程；本批不执行服务器启停或终端命令。
- **允许范围：** 调整总览实例摘要卡的操作区与核心身份区对齐、窄容器换行，更新 Minecraft `DESIGN.md`、README 和本合同验收记录。
- **验收条件：** 桌面操作按钮出现在摘要卡右上；核心图标、核心名与真实 Minecraft 版本位于右下，不覆盖实例名称或节点—实例关系信息；窄容器中各区域顺序重排且无横向溢出；原状态门控与导航行为不变。
- **性能与安全边界：** 仅静态布局变更，不增加订阅、请求、动画或主线程计算；沿用已存在的状态、权限和节点校验。
- **实页验证：** 正式 Web `http://127.0.0.1:3000/games/minecraft/overview`，1440×900 桌面视口显示操作位于卡片右上，当前真实 `CatServer` / `Minecraft 1.16.5` 标识位于右下，控制端已连接；820×520 窄短视口中内容随容器重排，页面无横向溢出且核心信息可滚动到达。刷新仅重新读取状态；没有启动/停止实例、发送终端命令或写入配置。该次总览选择的是 CatServer，所以 Paper 官方图标分支未在本次实页显示验证。
- **构建与边界：** `pnpm run build:web` 已通过，正式产物输出到仓库根 `dist/`；Impeccable 检查返回 `[]`，`git diff --check` 通过。构建同时将 JVM 标签改为读取 API 已公开的 `major` 字段，以消除旧字段名造成的类型错误，不改变 Java 选择或配置逻辑。窄短屏验证使用 820×520；未对真实手机/平板硬件或帧时间作结论。

### 2026-10-30 实例概览去除冗余标题

- **用户问题与目标：** 实例概览横幅顶部的“Minecraft 实例”重复表达当前页面对象，占用垂直空间；删除这条可见小标题，保留实例名、运行状态、核心与版本、实例操作和详情菜单。
- **目标运行入口与 Owner：** `/games/minecraft/instance/:id/overview`；由 `MinecraftWorkspace.tsx` 内 `selectedInstance` 的 overview hero 唯一渲染。仅移除 eyebrow 文本，不改变数据、路由、按钮、权限、状态或持久化。
- **设置与验收：** 继续使用现有主题/字体映射，不新增或修改设置。桌面及窄短屏确认标题消失、实例信息完整且无溢出；运行 `pnpm run build:web` 和 `git diff --check`。实页验收待本批完成后填写。

### 2026-10-30 操作后留在当前页与任务提示卡

- **用户问题与目标：** Minecraft 工作区中不少操作成功后会自动跳到“任务”，打断当前操作。操作成功后应留在当前页面，并在右下角显示可点击的短时任务提示；用户点提示才进入任务列表。提示显示 5 秒倒计时，到时自动收起，也可以主动关闭。
- **入口与 Owner：** Minecraft 手动工作区及实例详情路由；`MinecraftWorkspace.tsx` 是操作编排和反馈 Owner，部署向导 `MinecraftDeploymentPanel.tsx` 仅传递真实提交结果及反馈文案，`MinecraftWorkspace.css` 持有局部浮卡样式。任务数据继续来自现有 Minecraft API、Socket 与受限轮询；不复制任务事实或增加路由状态。
- **设置盘点：** 复用 `general.notificationPopupsEnabled`（Settings Owner 默认 `true`、账户持久化的工作台通知总开关）；开启时显示浮卡，关闭时退回页面内状态提示。继续消费 Appearance 主题、强调色、字体/字号、遮罩/模糊令牌及 `appearance.advanced.reducedMotion`；不新增设置或重置偏好。浮卡入场动效受减少动态效果控制。
- **数据与权限边界：** 只展示既有 API 已接受的操作结果；卡片点击进入工作区现行任务路由 `/games/minecraft/tasks`。实例、部署、配置、取消及删除继续调用现有认证 API，并保留角色、节点、实例状态、EULA 和 Permission Owner 检查。关闭卡片只关闭提示；只有点击卡片会导航，不触发服务器动作或任务写入。
- **允许范围：** 将操作成功后的默认自动导航改为留在当前路由，包含部署向导提交；提供单条、有界、可关闭的 5 秒任务提示卡及任务入口；保留错误反馈和通知总开关关闭时的页面内提示；更新直接回归、包 README、本合同和索引。
- **禁止范围：** 修改 Minecraft API/任务格式/Daemon、认证授权、真实实例/任务数据、用户设置值或权限模式；增加轮询/订阅、动画库、第二套通知服务或无界通知队列；将自动跳转恢复为默认行为。
- **UI Skills 决策：** Taste app-screen 与 Impeccable Operate 延续当前玩家运维界面的平面层级；UI Motion 仅用一次短淡入/上浮，倒计时直接显示秒数，不增加动画循环；UI/UX Pro Max `ux` 搜索建议提示 3–5 秒自动收起且不抢焦点；Baseline UI 复用当前 CSS 与主题令牌。Audit Skills 仅覆盖 Java/.NET/PHP，不把 TypeScript/CSS 声称为专项扫描通过；安全边界继续按现有认证 API 和操作前置条件审查。
- **验收条件：** 任一成功操作均留在原路由；默认通知开启时显示可点击“查看任务”的卡片，数字从 5 秒倒数至自动收起；手动关闭有效，点击后才导航到任务页；通知总开关关闭时仍有页面内成功提示；失败留在原页面并显示错误；桌面和窄/短视口无遮挡、横向溢出或不可达操作；不改变真实数据/权限/设置。
- **实现：** `submitAction` 成功后留在原页并立即显示反馈，再异步刷新真实状态；运行中的成功任务共用单张 5 秒浮卡，点击只跳转至 `/games/minecraft/tasks`，关闭/替换/卸载均清除计时器。部署向导复用相同提交合同。操作失败仍显示原页面错误；通知总开关关闭时改用页内提示；JVM 保存和任务记录删除显示完成提示，不冒充后台任务。
- **源码验证：** `node --test apps/cli/tests/minecraft-task-workspace.test.mjs` 16/16；`pnpm --filter lfaa-client-ui-minecraft run build`、Client TypeScript 检查、`pnpm run build:control-plane`、`pnpm run build:web`、`node scripts/runtime-build-state.mjs web`（输出 `[]`）及 `git diff --check` 通过。Impeccable detector 输出 `[]`。Taste lint 对三个目标文件仍报告 36 项 FAIL、24 项 WARN，均位于既有 Minecraft 布局/封面/代码样式；本次浮卡的新分隔线已改为色面，叠层阴影和按设置生效的模糊注明为适用例外。
- **内置浏览器只读验收：** 使用当前 checkout 构建并启动 `127.0.0.1:3000`，最新 Web 通过版本保护；在 ChatGPT 内置浏览器打开 `/games/minecraft/instances`（截图视口 978×925），看到真实实例列表与停止状态，再打开 `/games/minecraft/tasks` 确认现行任务路由可达、显示真实任务。没有点击启动/停止/删除/部署，也没有改变用户设置或任务数据。截图在本轮内置浏览器结果中查看，未另存图片。
- **未实测与性能边界：** 为避免改变真实服务器数据，本批没有触发实际任务提交，因此浮卡出现、真实 5→0 秒视觉倒计时及卡片点击导航未做浏览器实测；这三项由直接源码回归覆盖，不能标记为实页通过。内置浏览器当前工具没有可用的窄屏/短屏视口设置，故该批窄/短视口也未实测。没有测帧时间；实现仅在卡片可见时使用一个 1 秒计时器，卡片关闭、替换或卸载时清理，不新增请求、订阅或数据增长。
- **启动流程记录：** `lfaa.bat` 菜单尝试在进入菜单前被工作区已有的 `scripts/windows-rust-toolchain.ps1` PowerShell 解析错误阻断；没有改动该文件。随后按同一运行树规则执行 LFAA Web 写锁预检、Control Plane/Harness 与 Web 构建、指纹复核和源码 CLI 启动。最新正式服务保持运行，构建后页面实测可正常加载。

### 2026-10-30 通知提示卡偏好接入

- **用户目标与入口：** 在设置中心“通知”页配置 Minecraft 操作提示卡停留秒数、几种进场效果与提示音；工作台入口继续是 `/games/minecraft/*`，通知偏好由 `/settings?section=notifications` 管理。
- **Owner 与配置盘点：** General Settings Owner 继续持有认证、严格校验、旧账户补值和账户持久化。复用已有 `general.notificationPopupsEnabled`（默认开启）和 `general.notificationSound`（新账户默认 `default`）；新增 `general.notificationToastDurationSeconds`（默认 5、范围 1–60 整数）及 `general.notificationToastEffect`（默认 `fluid`，共享 `fluid`/`fade`/`lift`/`none` 四种动效 ID）。旧客户端缺少新字段时合并当前账户值；旧账户缺字段时取共享默认。Appearance 减少动态效果优先关闭卡片动画，未更改任何当前用户偏好。
- **实现：** SettingsPage 在通知分组增加秒数输入和动效选择；Minecraft `showActionFeedback` 读取保存后的时长并按现有 1 秒间隔更新倒计时，使用所选 CSS 进场效果，并调用 `client-resources` 的 `playNotificationSound` 使用既有声音选择。通知总开关关闭时保持页内提示且不播放声音。Settings Agent 目录通过同一 Schema 暴露新增 General 字段，不增加授权 Owner。
- **逐批回归与构建：** 定向设置合同、Agent 设置目录、Minecraft 提示卡和通知运行时测试共 5/5 通过。`lfaa-client-ui-minecraft` 包构建、CLI Host TypeScript 检查、Control Plane 构建、Web 类型检查/构建均通过；`runtime-build-state.mjs web` 输出 `[]`；`git diff --check` 通过。未筛选的旧测试组另有一个模型错误文案预期不符，Minecraft 测试文件另有两个现存容器断点断言与当前 CSS 不符；本续批命中的回归均通过，未改这些无关断言。
- **ChatGPT 内置浏览器实页：** 构建完成后安全确认 `/api/minecraft/tasks` 的 5 条任务全部 `succeeded`，确认无运行中任务后重启本 checkout 的正式 LFAA Web，端口为 `127.0.0.1:3000`。在 `/settings?section=notifications`、截图 1280×720 实际看到 1–60 秒数字控件、当前 5 秒、四种动效当前项、统一提示音选择和试听入口；无重叠或横向溢出，没有编辑或保存任何账户偏好。服务保持启动。
- **未测与性能边界：** 为不启动/改动真实 Minecraft 实例，本批未触发成功操作，真实浮卡计时、动效、点击任务入口和声音播放未实页触发；由定向回归及构建覆盖。当前 CUA 内置浏览器没有视口尺寸 API；按键缩放未改变截图尺寸，故窄屏/短屏实页验收未完成，不能据此标记通过。实现可见卡片时只有一个每秒计时器，关闭、更换及卸载会清理；不增加轮询、订阅、请求或数据增长，也未测帧时间。

### 2026-10-30 服务器列表窄分栏溢出与 Minecraft 响应式复核

- **用户问题与目标：** `/games/minecraft/instances` 在窄分栏里实例操作区越出右侧。截图显示外层浏览器较窄但服务器卡仍维持桌面三列。
- **目标入口与 Owner：** Web `/games/minecraft/instances`；页面布局唯一 Owner 为 `packages/client/ui-minecraft/src/MinecraftWorkspace.css`，真实实例/节点状态继续来自 Minecraft API。实例卡原三列最小宽度合计约 900px，另有 28px 列间距和 32px 内边距；既有 800px 内容断点不足以覆盖完整最小宽度。
- **修复：** 将 `MinecraftWorkspace.css` 中 760/560/480px 的宽度断点改为查询共享 `.module-center-content` 实际宽度；增加 1024px 内容断点，使服务器卡在扣除工作区留白前就改为纵向信息与可换行操作。短屏高度断点仍按实际视口高度处理。`MinecraftWorkflowCanvas.css` 的响应式断点也已核对，按共享内容容器宽度工作；未发现 `inline-block` 布局或页面级横向滚动规则。
- **设置、数据与权限：** 继续消费现有 Appearance 主题、强调色、字体/字号、对比度、Minecraft 背景槽、区域遮罩透明度/模糊与减少动态效果映射；`general.cardMotionEffect` 保持现有共享动效 Owner。未新增或修改设置、服务端数据或权限；未执行实例操作。实例动作的管理员、节点在线及状态条件未改。
- **逐批验证：** `pnpm --filter lfaa-web run build` 通过（TypeScript 与 Vite 构建，输出在根 `dist/apps/web`）；`pnpm --filter lfaa-client-ui-minecraft run build` 通过（输出在根 `dist/packages`）；构建 CSS 已含 `module-center-content` 与 1024px 断点；Impeccable detector 返回 `[]`；`git diff --check` 通过。
- **内置浏览器实页：** 使用当前源码 Vite `http://127.0.0.1:5173/games/minecraft/instances`；服务端 `3000` 已由本仓库 LFAA Web 占用，因此未重启或停止它。浏览器截图为 1280×720，右侧工具栏将 Minecraft 主内容约压至 824px；实例卡已纵向排列，操作区留在卡片内。版本公告遮罩仍打开，未确认公告或改写其浏览器持久状态；检查中出现请求失败与实时连接中断提示，连接显示有波动，因此未验收数据刷新或服务端状态。没有执行启动/停止/删除等操作。
- **范围限制：** 本轮真实浏览器只复核了实例列表路由的窄嵌入列；未通过手机/平板设备或 390px 视口，也未直接复核 520px 短屏。其他 Minecraft 路由已做 CSS 容器断点静态复核，不能据此声称全路由、物理设备或帧时间验收通过。
