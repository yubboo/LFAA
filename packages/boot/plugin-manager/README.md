# LFAA 插件管理器

`/plugin-manager` 消费 DSH Plugin Manager 的 9 个类型化 UI Slot：`plugins.add.actions`、`plugins.tab`、`plugins.bundle.activation`、`plugins.item`、`plugins.bundle.config`、`plugins.row.config`、`plugins.detail.actions`、`plugins.detail.badge`、`plugins.detail.section`。声明和 Outlet 位于 `client/modules` 与 `ui-plugin-manager`；贡献者通过 LFAA 的 Slot Registry 生命周期注册/订阅并由页面消费。Slot 只提供 UI 接缝，不授予 Host 服务、配置存储、安装清单或 Bundle Row 权限；缺少 LFAA 事实的 DSH ConfigForm/Row inventory 会被明确留空/不支持，不伪造运行状态。

`lfaa-plugin-manager` 是 Web 与 Desktop Profile 共用的第三方插件来源和安装清单 Owner，并通过 `lfaa-capability-installs` 注册为 `plugin` 类型适配器。支持 GitHub 仓库、官方 NPM 包和 LFAA Host 本机绝对路径三种来源。自然语言发现、检查、安装、App 路由、清单查询、启停和移除使用跨类型的 `capability_*` AI Tools；候选始终未验证，必须先检查固定来源与清单才能判断合同兼容性。

GitHub 来源固定到不可变 commit；手动 NPM 来源可按当前检查任务选择官方、npmmirror 或自定义 HTTP(S) registry，固定包名与版本后要求 registry metadata 和 tarball 同源，并核验 SHA-512 SRI 后再安全展开；NPM 依赖补充与 GitHub 快照缺少声明构建文件时的 `gitHead` 发布产物核验仍只使用官方 `registry.npmjs.org`。所选 registry 仅是一次检查/安装参数，不写入账户设置、Profile 配置或 `.npmrc`；包含认证信息的地址会被拒绝，不支持需要登录的 registry。Host 本机来源只接受绝对目录或 `.tgz/.tar.gz`，拒绝符号链接和特殊文件，并以内容 SHA-256 固定快照。三种来源保存到 `<LFAA_HOME>/plugins/profiles/<Profile>/`；Wallpaper Engine 的受控运行副本位于 `<LFAA_HOME>/plugins/runtime-adapters/`，其私有设置/上传继续位于 `<LFAA_DATA_DIR>/plugins/runtime-data/`。旧版本仍在 data 根中的 Profile/适配目录会先校验并复制到安装根，不删除旧目录；如果两个位置内容冲突则拒绝覆盖并报告需人工核对。更改 `LFAA_DATA_DIR` 不会移动插件包或受控适配副本。校验归档路径、文件类型、数量与大小以及插件包清单，并将记录限定到一个明确 App。手动检查与安装绑定相同的来源类型、位置、registry 和固定摘要，安装期间按阶段回传真实的解析、来源核验、兼容性检查、文件暂存和清单登记状态；失败保留准确错误，不伪造包管理器输出。手动安装只登记 Profile 内容，返回的插件可能为已安装或不兼容状态；“立即启用”仍调用 Permission Owner 与同一真实生命周期 Owner 单独执行。对话中的 `capability_install` 继续按原合同在同一操作内启用兼容的新插件或同 revision 的已安装插件，并由 Owner 回读实际运行状态；不兼容插件不启用，更新到不同 Wallpaper Engine revision 时仍保持停用。服务启动时，Owner 按 Profile 清单恢复上次已持久启用且当前兼容的插件；某一插件恢复失败会记录诊断，不阻止其余插件或控制端启动。启用失败时安装记录保留并返回“已安装但未启用”，不能报告为可用。安装器不运行依赖脚本，也不导入任意外部代码。唯一专用例外是下文的 Wallpaper Engine 官方 DSH 来源；该插件只在准确的官方仓库、逐次固定的 commit、包清单和适配锚点匹配时由专用 Cordis Loader 托管，不提供操作系统进程沙箱。清单 v4 增加来源类型和位置，读取 v1/v2 时补齐原有跨 App 可见范围，读取 v3 时将原 GitHub 记录标注为 `github`。DSH 来源检查会读取被检查快照中的最低 DSH 版本、Host 入口、bundle 补丁、Client 入口与注入服务、peer dependencies 和声明的脚本名称；脚本只展示、不执行。识别出 DSH manifest 或补齐构建产物，仅表示来源包完整，不表示 DSH Runtime 已移植。插件工具会再读 Profile 清单，核对同一来源、固定内容版本、目标 App 和真实状态；无兼容运行适配器的插件回报为 `verified_incompatible`，不能表述成已可使用。安装审批摘要会显示当前 Runtime 是否支持运行，并说明兼容新安装会尝试自动启用。

AI 的 `capability_list` 为模型返回当前 Owner 判定的 `canEnable`，该值由实际兼容 Runtime 状态派生，不写入 Profile 清单。模型处理直接来源时先核对同 App 同源记录；已启用项停止，已安装且可启用项走 `capability_set_enabled` 后回读清单，普通“安装”不触发 revision 更新。自然语言启停与卸载仍走管理员 `capability_*` 工具、Permission Owner、`permissions.mode` 和真实清单回读。插件管理页的启停按钮由 Permission Owner 将该次显式点击作为用户授权，再调用本包同一 `setEnabled` 生命周期 Owner；请求绑定目标 App 与固定来源版本，不经过 Agent Loop，也不创建聊天消息。安装与卸载按钮直接调用受认证的管理 API，并由同一 Permission Owner 将明确点击绑定到来源版本；自然语言仍使用 capability_*。卸载等待 Runtime 停止并删除当前 Profile 的安装源码、全部适配版本及插件私有设置/上传/缓存，不删除 LFAA 账户外观设置和 Steam 原壁纸。

Windows x64 会注册 `WindowsAppContainerPluginRuntime`：只接受声明 `.mjs` 入口且没有额外 capability 的 LFAA v1 插件；源码只读、AppContainer 无网络、插件环境变量按白名单重建、每个进程最多 512 MiB、每个 Profile 最多同时启用 4 个进程。启动须收到 Host 与插件两层就绪消息；停用等待插件确认和 Host 退出，再撤销 ACL 与 AppContainer 配置。`plugins.enabled` 继续管理账户 AI 扩展，不决定本包的核心工具是否可见。

## LFAA-Harness 内的 Wallpaper Engine 来源兼容

LFAA-Harness 是产品、Profile、插件来源核验、安装与生命周期的唯一 Owner；Host 路由继续由 LFAA 的认证 WebServer 提供，账户偏好和设置由 LFAA Settings Owner 持有。`DshWallpaperEngineRuntime` 是 LFAA Plugin Manager 对这个固定第三方包所声明 DSH v1 ABI 的兼容适配，不要求安装或运行 DSH 应用，不把 DSH 变成 LFAA 的宿主，也不构成通用 DSH 插件宿主。

## 官方来源检查与更新

`DshWallpaperEngineRuntime` 只接受官方 `elysia395/dsh-wallpaper-engine`、包名 `dsh-plugin-wallpaper-engine`、有效语义版本、Plugin Manager 核验记录与当前 DSH v1 Host/Client 合同。它不重复固定某一个版本或提交号。适配锚点须同时匹配 LFAA WebServer 管理边界、Scene 媒体源与 Scene Renderer 文档路由的围栏/生命周期合同；Client 必须保留上游 RopeDock 和生命周期结构。不匹配时拒绝启用。每个来源 commit 与 `adapter-<revision>` 都写入独立运行副本，并保存来源版本、commit、归档摘要及适配后内容 SHA-256；后续加载前回读校验。插件源码仍在 LFAA Web Host 进程内由 DSH Loader 托管，**不具备 AppContainer 进程隔离**，所以不能扩大为任意 DSH 插件。Client 在 LFAA 登录恢复前从启动图过滤，登录后同步 Host 当前模块图，注销时卸载插件模块。其他 DSH 插件或仓库不会由此适配器加载。

LFAA 的 Cordis 会将可构造的具名 `function apply` 识别为 class 插件。上游 Host/Client 导出的 `apply` 因此在 LFAA 私有运行副本内包装为箭头回调，确保上游返回的清理器由对应 Fiber 持有；LFAA 的停用流程也等待 Cordis Loader 丢弃的 Fiber 清理 Promise 完成，再报告停用。该窄适配只改导出形态与 LFAA 生命周期等待，不改上游界面或已安装源码；变更适配器时递增 `adapter-<revision>`，保留旧副本以便诊断。

更新仍由管理员在现有 `capability_inspect` → `capability_install` 检查/审批链选择新的明确来源 revision。只有同一官方插件、同一 App、当前已停用、且新清单仍由 Runtime 支持时，安装器才原子替换插件源码目录；其他插件 ID 冲突规则不变。失败会恢复原目录和清单；更新后保持停用，须显式启用。更新时保留旧的按版本隔离运行副本及插件私有数据；明确卸载时一并删除当前 Profile 的这些文件。正常上游版本和 UI 资源由插件源码提供，LFAA 不维护 UI fork；若上游改变 DSH ABI、Host 媒体边界或适配锚点，则该 revision 会拒绝启用，需要更新适配合同后再接入。

适配沿用上游 Web/Scene/Video 实时壁纸、播放列表与轮播、过渡、项目属性、导入/上传、音频、过滤/评级/隐藏恢复、字体集、外观/播放设置、QuickPanel、诊断和媒体准备/回退逻辑。LFAA 提供 DSH `settings.section`、`sidebar.right.pane.tab` 和 `shell.overlay` Slot；现有设置页与右栏呈现上游面板，RopeDock 使用 LFAA 已有 React 根。`shortcuts.register` 保存到账户快捷键设置，`locale` 跟随 `general.language`，`theme.setTheme` 写入 `appearance.theme`。DSH 文字色与字体角色令牌继承 LFAA Appearance 基线，并把用户设置的角色覆盖限定在 Workbench 的 Markdown、代码块和节点任务终端；上游字体集、字体角色和主题色偏好仍按上游格式保存在当前 Profile 运行数据中。插件拥有活动壁纸画布时，其 `--we-*` 外观令牌与 `data-we-*` 表面开关同时驱动 LFAA 对应工作台表面；插件停用/未运行后，LFAA 外观才回到账户 Appearance。插件值不复制到账户设置；`theme.setTheme` 与字体角色仍分别通过 LFAA Theme Owner 和受限 DSH 令牌桥接。上游不支持 Application/EXE 壁纸。

设置、上传、字体集和管理 API 复用 LFAA WebServer/Carrier；上游设置 Body 保持流式读取。壁纸 ID 适配到账户设置 `appearance.wallpaperEngine.enabled/projectId`，Profile DSH 配置中的共享 ID 固定为空。上传、字体集、其他插件设置和缓存沿用上游格式，写入 `<LFAA_DATA_DIR>/plugins/runtime-data/profiles/<Profile>/dsh-plugin-wallpaper-engine/`。Scene `scene.pkg` 与网页壁纸资源统一复用现有 Host 上的 `/wallpaper-engine/scene-files/` 路由，不另开 loopback 监听端口；此路由经过 LFAA 认证中间件，沿用上游 `handleSceneFiles` 的 Range 传输、资源 token、字面路径与 realpath 双层围栏。Scene Renderer iframe 复用同源 `/wallpaper-engine/scene-live/` 路由；适配副本只对 `index.html` 文档响应将全局 `X-Frame-Options: DENY` 覆盖为 `SAMEORIGIN`，静态资源和其他响应继续使用全局策略。适配器仍核验固定官方来源的临时监听、诊断端点、路径围栏和 Fiber 清理锚点，但运行副本将 `ensureMediaOrigin()` 固定为无源，避免库存、诊断或壁纸请求启动第二个监听；`mediaBase` 为空时由上游 Client 使用当前页面 origin。若官方来源路由、围栏或清理锚点变化，适配器拒绝启用。Wallpaper Engine 不创建通用插件服务或 Daemon 能力。`appearance.theme`、`accentColor`、`overlay`、`blur`、字体/字号、对比度和减少动态效果仍由 LFAA 管理。

详细本轮真实验收与逐文件变更见 [验收记录](../../../docs/development/plugin-lifecycle-session-responsive-20261016.md)。

构建不能证明登录后的 Host/Client、真实 Steam Video/Web/Scene、上传/音频、Tauri 或帧时间验收；这些运行项要单列证据。插件继续通过既有 `capability_*` 流程检查/安装/启用，不会自动操作用户的 Steam 内容。

## 首阶段 LFAA v1 运行合同

插件包在 `package.json` 的 `lfaa.plugin` 声明 `apiVersion: 1`、稳定 `id`、包内 `.mjs` 相对 `entry` 和 `capabilities`。当前 Windows Runtime 只允许空能力列表，因为尚未实现宿主 API/IPC；入口收到 `LFAA_PLUGIN_ID`、`LFAA_PLUGIN_PROFILE` 和 `LFAA_PLUGIN_PROTOCOL=1` 后，必须在 stdout 输出一行 `{ "type": "lfaa.plugin.ready", "protocolVersion": 1, "pluginId": "<id>" }`。停用时 stdin 收到 `{ "type": "shutdown" }`，插件输出 `{ "type": "lfaa.plugin.stopped", "pluginId": "<id>" }` 并退出。stdout 只承载有长度上限的 JSONL 生命周期消息，未识别的输出会终止该进程；stderr 可用于常规诊断。

跨类型目录当前已登记 `plugin` 适配器；Skills、Prompts、Tools、MCP、Minecraft 插件和模组仍显示为领域 Owner 适配器未接入。模型工具按目标 App 路由，插件自然语言安装/启停/移除遵循管理员身份与 `permissions.mode`；插件页手动启停则由 Permission Owner 校验这次管理员明确点击。真实 Provider 连续选择工具的端到端验收尚未完成。

## 文件管理与插件存储边界（2026-10-14）

扩展插件的 inventory.json、源码快照及适配副本继续由本包独占写入；文件管理不浏览插件安装根，也不开放 runtime-data 通用读取，避免通用上传/写入/移动/删除破坏安装状态。插件包安装在 `<LFAA_HOME>/plugins`，用户私有运行数据在 `<LFAA_DATA_DIR>/plugins/runtime-data`。实例内 plugins/mods 属游戏 Owner，与 Harness 扩展分开。安装/更新/自然语言启停/卸载沿用 capability_* 与现有权限，手动启停沿用 Permission Owner 并调用本包同一生命周期方法，不扩大任意 DSH ABI 兼容范围。目录设计见[文件资源规范](../../../docs/development/file-resources.zh.md)。

2026-10-16：npm 与 GitHub 均实时解析官方来源；npm 官方包名为 `dsh-plugin-wallpaper-engine`，不从项目旧安装回填。1.3.x 拆分媒体模块通过新适配结构核验，Scene 路由继续使用认证同源服务；npm 运行路径以已验证的归档摘要命名。依赖安装沿 DSH 的 pnpm 路径，由 pnpm 负责完整版本图、可选依赖与完整性；安装仅运行依赖且不执行来源生命周期脚本。独立安装使用 hoisted node_modules，并移除副本内包存储和下载缓存；卸载整个运行副本，不残留项目内依赖副本。官方 npm 包名、GitHub 来源与本地兼容包均进入同一生命周期；本地目录跳过 .git/node_modules 并按 package.json files 范围取内容，file:/link: 绝对路径规格解析为内容快照，不修改原目录。GitHub API 限流或归档连接失败后，改用 Git 浅取当前引用并按包发布范围导出；不会读取项目旧安装。来源摘要仅用于版本校验，不作为运行验收。
