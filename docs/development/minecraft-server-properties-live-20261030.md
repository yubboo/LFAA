# Minecraft 实例配置真实文件对账合同

<a id="lfaa-minecraft-properties-live-20261030"></a>

## 用户问题与目标

配置页将固定字段和 UI 默认值显示成实例配置，未从节点读取安装后生成的 `server.properties`。例：Minecraft 1.12.2 配置页出现 `simulation-distance`，而该属性于 1.18 加入 Java 服务端。用户要求修复。

目标：配置页进入时通过目标节点的 Minecraft 领域任务读取真实文件；依据实际存在的属性显示真实值，并把文件中的每个属性都做成可视化编辑项。已知键用合适的开关、枚举、数值控件，其他真实键用文本控件；敏感值遮蔽。保存后通过受校验的 Minecraft 任务原子写回真实文件，保留其他行与注释，并用节点回读结果对账。

## Owner、入口与边界

- 运行入口：Web/Desktop 共用 `packages/client/ui-minecraft`，路由 `/games/minecraft/instance/:id/configuration`。
- 数据与规则 Owner：`packages/games/minecraft` 持有实例状态、真实快照键约束、类型/范围验证和实例任务创建；`packages/jobs/jobs` 持有 Minecraft 任务租约/结果事实；`packages/host/daemon` 仅在目标节点安全读取/写入实例目录。`packages/api/minecraft-controller` 提供认证路由和参数适配；`packages/client/connection` 提供公开类型与 API 调用。
- 保存前置：更新仍要求管理员、在线目标节点、实例停止且没有活动 Minecraft 任务；读取要求管理员、在线且报告 `minecraft-server-properties-file-v1` 能力的目标节点、目标目录归属有效且实例无冲突任务。保存也要求节点报告该能力，并且只有节点回传有效写后文件快照才标记成功；旧版节点不会继续走无法对账的补丁回退路径。读取结果不得改变实例运行状态或磁盘文件。
- 读取方式：只通过目标节点受认证的 Minecraft 任务通道，不使用控制端本地路径或通用文件接口。回传仅为最多 256 项、文件总量不超过 64 KiB 的属性快照；密码/令牌/凭据和资源包 URL 只回传键名与“已隐藏”标记。控制端任务记录只存计数与时间，实例快照保存脱敏值。
- 已有配置 `server_properties_json` 可容纳兼容快照；本任务不改变该快照格式，也不新增账户设置。SQLite 的任务表增加独立版本迁移，以允许新建 `properties-read` 任务。实例 `serverPort`、正版验证等既有领域消费者继续读取规范化字段。
- Appearance、主题、强调色、字体/字号、对比度、Minecraft 背景/遮罩/模糊、减少动态效果和 `general.cardMotionEffect` 继续使用共享配置；不修改用户偏好。Minecraft 运行默认值仅作为部署输入默认，不得替代已部署实例的文件值。
- 禁止整份文件覆盖、通用文件接口绕过、向 UI 显示敏感属性值、按服务端版本硬编码臆造属性、读取其他实例/账户目录，或执行启停/部署/许可操作。

## 可观察验收

- 1.12.2 的真实文件快照中没有 `simulation-distance` 时，界面不渲染该输入框；不存在的属性不得显示 UI 猜测值。
- 文件键动态形成完整属性清单；已知键显示对应类型输入，其他实际存在键显示文本输入；敏感键明确标记并遮蔽，不包含秘密原文。
- 保存只传递改变的、白名单允许的键；节点保留未知/只读属性并回读最终文件，控制端只记录规范化且脱敏的真实值。
- 节点离线、文件缺失/过大、实例忙碌、权限不足或解析失败时显示实际错误/状态，不报告读取成功，不提供假默认值。
- 完成相关包构建、客户端类型/接口检查、直接相关回归与正式 Web 构建；在 ChatGPT 内置浏览器查看实例配置路由的桌面及手机/窄短容器。真实实例验收只应创建 `properties-read` 只读任务并在控制端保存脱敏快照；不得写入 `server.properties`、停服/启动实例或创建其他类型任务。

## 实施记录

- 状态：实现完成。无快照时不再展示硬编码表单；读取结果只接受节点回传的真实文件快照，并据此生成属性清单和编辑值。
- 代码验证：`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm exec tsc --noEmit -p tsconfig.host.json`、`node --check packages/host/daemon/src/daemon.mjs`、Minecraft Domain/Jobs/Daemon/API/Connection/UI 包构建、`pnpm run build:control-plane`、`pnpm run build:web` 和 `git diff --check` 均通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`。没有新增或运行测试套件。`pnpm run check:workspace` 因未修改的 `docs/development/left-preview-hover-flicker-20261025.md` 引用两个缺失的 `dist/.tmp` 截图失败，与本任务无关。
- 初次离线验收：ChatGPT 内置浏览器正式源码服务 `http://127.0.0.1:3000`，实际路由 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/configuration`。1506×1244、768×900、390×650 下页面无横向溢出；手机短屏的主内容容器存在可滚动余量。当时实页显示“实例所在节点未连接。节点上线后会读取真实 server.properties 文件”，读取按钮禁用，离线自动读取不会调用 API；后续节点及真实快照验收见下文。
- 设置与数据：没有新增设置或改变用户偏好；样式继续消费共享主题/尺寸令牌和现有 Appearance 映射。未写入实例或 `server.properties`，未启动/停止服务器。
- 性能与范围：自动读取只在实例节点已在线且报告文件能力时发起；离线或不支持的节点只显示状态，不发起必失败请求。读取为显式单次任务，不加轮询；仅任务完成回调更新快照，组件卸载/实例切换仍使用既有请求与事件清理。未做帧时间测量。真实 Daemon、实际属性文件和服务端写回待连接目标节点后验收。

### 后续修复：能力协商导致 Daemon 心跳被拒

- 用户报告完整 Web 启动后本机 Daemon 节点离线。附带 Harness 输出显示 `/api/daemon/heartbeat` 连续 400 `invalid_request`。
- 调用链确认：Daemon 已在心跳能力列表声明 `minecraft-server-properties-file-v1`，但 Remote 的严格 Joi 白名单没有该能力；`.unknown(false)` 与固定 `.valid(...)` 会拒绝整个心跳，节点因此不能登记在线。
- 修复目标已完成：Remote 只登记这一项已实现能力，不放宽通配字符串或其他字段；Control Plane/Web 构建和差异检查通过。当时尚未启动 Daemon/Minecraft；后续正式 Harness 心跳恢复结果见“最终在线验收”。

### 后续修复：真实配置读取任务被 SQLite 旧种类约束拒绝

- 用户在节点恢复后仍遇到“没有取得节点文件快照 / 服务器内部错误”。完整 Web 日志显示 `POST /api/minecraft/instances/:id/properties/read` 返回 500。
- 调用链确认：认证 Minecraft Controller 调用 `readMinecraftServerProperties()`，由 Jobs Owner 创建 `properties-read` 任务；SQLite `minecraft_tasks.kind` 的 CHECK 约束仅由 v34/v56 扩展，v56 加入 `delete` 后尚无迁移登记 `properties-read`。因此 INSERT 会被 SQLite 拒绝，且任务不会到达 Daemon。
- Owner：`storage-sqlite` 持有迁移与任务表结构；`storage-domain` 协调旧库升级顺序；Minecraft Domain / Jobs 持有任务创建。设置/权限不变，仍要求管理员并通过在线节点与能力校验。
- 修复目标已完成：新增递增、事务化迁移，在保留所有任务行、索引、外键与现有结构的前提下允许 `properties-read`；更新最高支持版本、storage-domain 协调与 README。真实迁移及实读结果见“最终在线验收”。

- 本轮真实节点验收又发现完成回传合同漏项：任务已以 HTTP 202 排队，Daemon 也已读取文件，但 Remote 的严格 `minecraftCompletionSchema` 没有登记 `serverProperties` 与脱敏 `fileSnapshot`，所以完成回传被 HTTP 400 拒绝。目标：在保持未知字段拒绝的同时加入有界、逐项校验的快照合同；重启后确认任务成功、UI 显示真实快照且没有 400。
- 第二次实读进一步发现属性文件允许空字符串，真实实例的 MOTD、种子及文件其他属性值都可能为空；Joi 字符串默认拒绝 `""`，导致已登记的字段仍无法完整回传。目标：仅对这些合法字符串字段显式允许空串，不改变敏感项脱敏、键名格式及 64 KiB/256 项边界。

### 最终在线验收

- 责任归因：这次修复中我漏同步了三处严格合同，确实造成了节点离线和配置读取失败：Remote 心跳白名单缺少 Daemon 已实现的文件能力；SQLite 任务种类 CHECK 漏登记 `properties-read`；完成回传 schema 漏登记脱敏快照结构，且默认拒绝合法空字符串。Minecraft Java 实例没有被启动或停止。
- 已修复并实测：心跳白名单加入唯一缺项；SQLite v77 在事务中扩展任务种类并保留既有任务/索引/外键；Remote 完成合同增加有界属性快照并允许必要的空字符串。正式 Harness 模式启动后，节点 `WIN-20250328BHE` 在线；真实读取请求 HTTP 202，Daemon 完成回传 HTTP 204，配置页实际呈现该节点 `server.properties` 的 9 个可编辑字段与 25 个只读字段。1.12.2 文件没有 `simulation-distance`，界面未显示该字段；敏感资源包属性隐藏，空种子与文件内空字符串正常呈现。
- 实页验收：ChatGPT 内置浏览器 `http://127.0.0.1:3000/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/configuration`，1506×1244。页面显示真实文件时间戳与属性清单；刷新后任务仍显示已完成，实例概览确认节点在线、Minecraft 实例已停止。没有保存配置、写入 `server.properties`、启动或停止实例。
- 排查代价：定位逐层暴露了心跳、SQLite 任务种类和严格完成合同三个独立漏项；过程中生成了 4 条失败的只读配置读取任务记录，最终有 1 条成功。失败记录仍在最近任务历史中，未擅自删除；没有产生写文件/实例启停任务。
- 最终检查：Control Plane、Web、storage-sqlite、storage-domain、api-remotes、api-job-controller 构建通过；Host TypeScript 检查通过；`git diff --check` 与 Host/Web 运行构建指纹检查通过（均为 `[]`）。没有新增或运行测试套件。无设置中心配置新增或修改；权限、Appearance 和样式设置未改。
- 性能边界：属性读取仍为进入页面后的单次、有界只读任务，不加轮询；本轮没有做帧时间测量。实页验证为桌面视口，本轮未重复手机设备验收，因为后端合同/迁移修复没有改动页面布局或样式。

### 启动后再次对账

- 后续联动验收先由同一 Minecraft 实例启动任务成功启动 Paper 1.12.2，再在实例运行中点击“重新读取文件”。节点回传 `properties-read` 成功，`observedAt=2026-10-30T03:30:25.372Z`，包含真实 `server.properties` 的 34 个字段；配置页继续只显示 9 个支持编辑字段与 25 个只读字段。
- 关键值 `server-port=25565`、`max-players=20`、`view-distance=10` 与已启动的实例状态和控制台 `list` 返回的 `0/20` 一致；没有写入配置或改变实例状态，实例保持运行。完整的任务 ID、启动回执及限制见 [共享 Minecraft 控制台真实联动验收](shared-minecraft-terminal-console-20261030.md#lfaa-shared-minecraft-terminal-20261030)。

### 用户校正：文件中的全部属性都需要可视化编辑

- 用户指出“可编辑 9 项 / 其余 25 项只读”仍不符合需求：中间区域需要直接提供可修改真实配置的可视化编辑，而不是只读属性清单。
- 当前运行入口与 Owner 保持不变：实例配置页；Client 读取真实 `fileSnapshot.entries` 并提交已编辑的文件键值；Minecraft Domain 校验实例/节点/权限/停服条件和文件快照中的键；Jobs 持有任务与脱敏回读快照；目标 Daemon 在实例目录原子写入并重新读取最终文件。不能用控制端路径或通用文件管理旁路写入。
- 修订验收目标：本次节点快照中每个实际存在的属性都在中央配置区有可操作控件；已知布尔值/枚举/数值使用相应输入，其他合法属性使用文本输入。敏感值仍不回传，编辑器提供空白替换框；只有用户输入的新值才进入提交，空白不得清空旧秘密，显式移除才会删除对应敏感项。只保存发生变化的文件属性，严格限制键来自当前快照、值长度/字符和语义范围；Daemon 原子改真实文件并通过同一任务回传完整脱敏快照。
- 设置与权限不变：沿用 Appearance/共享主题映射和 `settings.permissions.mode`；无新增设置、无用户偏好写入。管理员/节点能力/实例必须停止/无冲突任务等既有校验继续有效。
- 验收方式：用桌面及窄/短容器检查真实配置路由，每个字段可聚焦编辑、变更数准确，状态不允许写入时保存按钮禁用；不在用户真实 Minecraft 实例上保存验收值。通过隔离的临时配置文件/Daemon 回归验证任意快照键更新、未知键/格式/长度拒绝、敏感值留空保持、文件其余键保留和写后读取。记录真实页面、视口、截图、设置、命令结果和限制。
- 状态：全量属性表单实现与实页响应式验收完成；当时实例运行中使保存保持禁用，因此没有在实机验证写回。后续隔离写回回归与本轮实页草稿交互结果见下文。

### 全量快照属性表单补充验收

- 配置 Client 表单现按本次节点快照中的实际键渲染全部 34 项，而不是限定 9 个编辑键并把其他字段做只读。布尔、已知枚举和数字属性使用对应控件，剩余实际属性使用文本控件；空快照不显示伪造的 UI 默认值。敏感值不在快照/界面显示，空白和输入后清空都不会提交空替换值；仅变化项进入写入请求。重置只清本地草稿。
- 类型规则明确限定到已知键集合，不从任意原始文本值 `true`、`survival` 推断控件类型；未知但在当前快照中存在的键也可作为普通字符串编辑。输入只收录当前快照存在的键并继续经过 Domain/Daemon 已有权限、实例停服、格式/范围和原子写入校验。
- 实页路由 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/configuration`，使用当前源码 Vite `http://127.0.0.1:5173` 和 ChatGPT 内置浏览器。已检查 1440×900、768×900、390×844、390×520：桌面/平板卡片并排，手机及窄短屏改为单列；390/768px 页面 scrollWidth 均与 clientWidth 相等，390×520 滚到底部后仍能触达重置/保存区。真实 1.12.2 快照的 34 项均出现，`simulation-distance` 不出现；敏感字段为空白。因实例仍运行，保存按规则禁用；没有创建新读取任务或写入配置。
- `pnpm --filter lfaa-client-ui-minecraft run build`、Client TypeScript 检查、Minecraft workspace 回归（11/11）、Taste UI lint（11 个文件，0 FAIL/0 WARN）与 `git diff --check` 通过。真实停服写回和隔离临时文件/Daemon 写回测试尚未执行；本批 UI 结果不能代替这两项写回验收。继续使用共享 Appearance/Theme 及 `settings.permissions.mode`，未增加设置或改变用户偏好；CSS 没新增自定义变量。正式 Web `3000` 未重启，帧时间未测。

### 2026-10-30 本轮配置页复查

- ChatGPT 内置浏览器重新读取源码 Vite 配置路由 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/configuration`。真实快照显示 34/34 项；1280×720 页面分组与字段网格完整，无水平溢出。390×844、320×600 下分组网格收为 294px、224px 单列，文档 `scrollWidth` 与 `clientWidth` 相等。
- `server-ip` 和 `level-seed` 的输入值都来自当前真实快照，DOM 值为空；这是对应 server.properties 的真实空值，不是漏渲染或假占位。本轮未发起新读取任务、保存草稿或写入节点文件，没有改实例状态和设置。没有复现配置页功能缺陷，因此未修改配置页业务代码。

### 用户追加：修复分组卡片高度造成的大块留白

- 用户截图显示“网络与安全”短组和“玩法与世界”长组使用同行等高网格；下一行的“性能”等短组被推到整行长组之后，留下大块空洞。
- 只改变属性分组流式布局：各组不拆分，按筛选后的字段数平衡两列；窄容器收为单列。字段、值、保存/API/权限规则均不改。
- 验收：桌面确认短组接续长组后的空位，容器宽 760px 以下与手机为单列；所有真实属性字段仍完整且不溢出。不读取/保存新的文件，不改变实例或账户设置。

### 2026-10-30 本轮全量配置可视化编辑验收

- 配置页按目标节点真实快照展示并编辑全部 34 个 `server.properties` 属性，不再把旧白名单之外的属性放进只读列表。页面中间区提供分组表单，支持搜索、布尔/枚举/数值/文本控件、待保存计数、撤销草稿及保存；敏感属性仍遮蔽，修改仅提交变化键。
- 实页：ChatGPT 内置浏览器源码路由 `http://127.0.0.1:5173/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/configuration`，截图视口 1750×1244。真实快照显示“34 / 34 项”，1.12.2 表单没有虚构 `simulation-distance`。给 `motd` 输入临时草稿后，界面从“0 项待保存”变为“1 项待保存”；撤销后回到“0 项待保存”，没有点击保存。
- 当前目标实例显示为已停止；没有修改它的 `server.properties`，也没有新建写入任务、启动或停止 Minecraft。实页验证了编辑与撤销反馈；真实文件写回通过隔离临时文件回归验证，不把两者混称为一次实机保存。
- 实际验证通过：Minecraft 属性文件与任务工作区回归 14/14；客户端与 Host TypeScript 检查；`pnpm run build:web`、`pnpm run build:control-plane`、Daemon 与共享 values 包构建；`git diff --check`。写回回归覆盖保留注释/未改条目、只更新当前快照键、敏感值密封/解封与移除、拒绝未知键和换行注入。
- 设置：继续使用现有 Appearance/主题/共享字体尺寸映射及 `settings.permissions.mode`；无新增设置或用户偏好修改。写回前仍要求管理员、目标节点在线且具备文件能力、实例停止、无冲突任务；敏感任务值通过现有设置密钥按实例/属性绑定加密，Daemon 回传脱敏真实快照。
- 视口与范围：本轮内置浏览器完成桌面 1750×1244 实页验收；本次浏览器控制接口没有暴露视口尺寸覆盖，因此未重新执行窄/短视口实页操作。前一轮 390/320px 布局检查保留在上文，但不表述为本轮复验。未测帧时间，也未向用户真实实例提交属性写入。

### 2026-10-30 配置组填列修正与窄屏复验

- 真实桌面容器 `1920×1080`、可用宽 `1136px` 下，纯 CSS 多栏仍把“网络与安全”单独留在左列，把较短的“性能/其他”继续排到长组之后；真实页面量得左列下方仍有约 929px 空位，故该方案没有通过验收。
- 改用两列独立 Grid 盒，并按当前筛选后的字段数贪心分组。真实 34 项快照在左列顺序为“网络与安全 → 性能 → 其他”，组间 26px；右列为“玩法与世界”。列间距随容器宽度在 26–40px 变化，两列总高度约 953px 和 1001px，长组不再把短组挤出同行。没有修改字段、值、保存/API/权限规则。
- ChatGPT 内置浏览器源码路由 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/configuration`：桌面 `1920×1080` 可用区宽 `1136px`，窄短屏 `390×520` 可用宽 `294px` 并收为单列；34/34 属性均在 DOM 中，窄屏 `scrollWidth=clientWidth=390`，无页面横向溢出。未编辑、保存或重新读取任何配置。
- 定向回归 `node --test apps/cli/tests/minecraft-task-workspace.test.mjs` 14/14 通过；`pnpm.cmd --filter lfaa-client-ui-minecraft run build`、`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`git diff --check` 通过。最终本轮构建在下方汇总。

### 2026-10-30 配置编辑器去卡片视觉优化

- 用户反馈每个配置分类外框显得呆板。本轮选用暗色平面分层方向，仅落在 `server.properties` 编辑器：分组本身无边框、无底色、无圆角；双栏靠留白分开，组间保留一条共享主题的细分隔线，字段控件继续使用现有表单表面。没有更改主题、字体、字段、值或写回行为。
- 桌面实页：ChatGPT 内置浏览器源码路由 `http://127.0.0.1:5173/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/configuration`，1750×1244；34/34 项仍在编辑器，分组外框计算为 `border: 0`、透明背景，左右组宽约 476px。真实截图由内置浏览器验收捕获。
- 窄视口：临时视口 1024×768 时分组收成约 296px 单列、文档无横向溢出；390×844 时分组和字段均为单列，文档宽度与视口一致。390px 实页中共享“应用工具”侧栏占据可见区域，因此只把配置组件的单列和无溢出作为通过证据，不把整套 Shell 的手机可操作性标成通过。验收结束后重置回默认桌面视口。
- `pnpm run build:web` 与 `git diff --check` 通过；无 JS/订阅/计时器变更，没有增加运行时工作量。未新增设置或 CSS 变量，继续使用现有外观/主题/字体尺寸映射。未编辑或保存真实配置。
- 辅助 UI 工具边界：Taste Skill 的独立 Inspector 使用未登录的隔离浏览器，落在 LFAA 登录页，未作为 Minecraft 实页验收证据；实际视觉验收使用上面的 ChatGPT 内置浏览器。整份 Minecraft 样式文件的 Taste linter 报出该文件其他模块既有边框/线条/阴影/渐变规则；本次配置组的单条细分隔线按暗色设置样式保留并标注忽略理由，没有据此改动其他模块。
