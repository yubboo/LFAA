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
