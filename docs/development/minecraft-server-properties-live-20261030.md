# Minecraft 实例配置真实文件对账合同

<a id="lfaa-minecraft-properties-live-20261030"></a>

## 用户问题与目标

配置页将固定字段和 UI 默认值显示成实例配置，未从节点读取安装后生成的 `server.properties`。例：Minecraft 1.12.2 配置页出现 `simulation-distance`，而该属性于 1.18 加入 Java 服务端。用户要求修复。

目标：配置页进入时通过目标节点的 Minecraft 领域任务读取真实文件；依据实际存在的属性显示真实值；仅领域已校验支持的属性可编辑，其余属性显示为只读；敏感值从节点结果、控制端存储及浏览器响应中剔除。保存后继续原子写入路径，保留其他文件键，并用节点回读结果对账。

## Owner、入口与边界

- 运行入口：Web/Desktop 共用 `packages/client/ui-minecraft`，路由 `/games/minecraft/instance/:id/configuration`。
- 数据与规则 Owner：`packages/games/minecraft` 持有实例状态、可编辑属性白名单、类型/范围验证和实例任务创建；`packages/jobs/jobs` 持有 Minecraft 任务租约/结果事实；`packages/host/daemon` 仅在目标节点安全读取/写入实例目录。`packages/api/minecraft-controller` 提供认证路由和参数适配；`packages/client/connection` 提供公开类型与 API 调用。
- 保存前置：更新仍要求管理员、在线目标节点、实例停止且没有活动 Minecraft 任务；读取要求管理员、在线且报告 `minecraft-server-properties-file-v1` 能力的目标节点、目标目录归属有效且实例无冲突任务。保存也要求节点报告该能力，并且只有节点回传有效写后文件快照才标记成功；旧版节点不会继续走无法对账的补丁回退路径。读取结果不得改变实例运行状态或磁盘文件。
- 读取方式：只通过目标节点受认证的 Minecraft 任务通道，不使用控制端本地路径或通用文件接口。回传仅为最多 256 项、文件总量不超过 64 KiB 的属性快照；密码/令牌/凭据和资源包 URL 只回传键名与“已隐藏”标记。控制端任务记录只存计数与时间，实例快照保存脱敏值。
- 已有配置 `server_properties_json` 可容纳兼容快照；本任务不改变该快照格式，也不新增账户设置。SQLite 的任务表增加独立版本迁移，以允许新建 `properties-read` 任务。实例 `serverPort`、正版验证等既有领域消费者继续读取规范化字段。
- Appearance、主题、强调色、字体/字号、对比度、Minecraft 背景/遮罩/模糊、减少动态效果和 `general.cardMotionEffect` 继续使用共享配置；不修改用户偏好。Minecraft 运行默认值仅作为部署输入默认，不得替代已部署实例的文件值。
- 禁止整份文件覆盖、通用文件接口绕过、向 UI 显示敏感属性值、按服务端版本硬编码臆造属性、读取其他实例/账户目录，或执行启停/部署/许可操作。

## 可观察验收

- 1.12.2 的真实文件快照中没有 `simulation-distance` 时，界面不渲染该输入框；不存在的属性不得显示 UI 猜测值。
- 文件键动态形成完整属性清单；已支持且实际存在的键显示对应类型输入，其余非敏感键只读；敏感键明确显示已隐藏，不包含秘密原文。
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
