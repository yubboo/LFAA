# LFAA 插件管理器

`lfaa-plugin-manager` 是 Web 与 Desktop Profile 共用的第三方插件来源和安装清单 Owner，并通过 `lfaa-capability-installs` 注册为 `plugin` 类型适配器。自然语言发现、检查、安装、App 路由、清单查询、启停和移除使用跨类型的 `capability_*` AI Tools；候选始终未验证，必须检查仓库清单后才能判断合同兼容性。

安装只把经 `capability_inspect` 固定到不可变 Git commit 的包保存到 `<LFAA_DATA_DIR>/plugins/profiles/<Profile>/`，校验来源提交、归档摘要、ZIP/TAR 路径与文件类型、文件大小及插件包清单，并将记录限定到一个明确 App；插件 Owner 明确声明不接受额外项目或 Minecraft 实例目标。通用检查凭证按当前用户、类型、App 和 Owner 目标绑定，15 分钟过期且只能消费一次。对话中的 `capability_install` 会在同一操作内启用兼容的新插件或同 revision 的已安装插件，并由 Owner 回读实际运行状态；不兼容插件不启用，更新到不同 Wallpaper Engine revision 时仍保持停用。服务启动时，Owner 按 Profile 清单恢复上次已持久启用且当前兼容的插件；某一插件恢复失败会记录诊断，不阻止其余插件或控制端启动。启用失败时安装记录保留并返回“已安装但未启用”，不能报告为可用。安装器不运行依赖脚本，也不导入任意外部代码。唯一专用例外是下文的 Wallpaper Engine 官方 DSH 来源；该插件只在准确的官方仓库、逐次固定的 commit、包清单和适配锚点匹配时由专用 Cordis Loader 托管，不提供操作系统进程沙箱。当 GitHub 快照缺少 package.json 声明的 DSH `main` 或 `./client` 产物时，安装器才会检查同名官方 NPM 发布包；只有包名、版本、GitHub 仓库、`gitHead` 提交与 SHA-512 SRI 全部一致，且 tarball 通过安全展开检查后，才用发布产物补齐该固定提交。清单 v3 记录受归档校验的运行入口和 App 范围，读取 v1/v2 时补齐原有跨 App 可见范围。DSH 来源检查会读取被检查快照中的最低 DSH 版本、Host 入口、bundle 补丁、Client 入口与注入服务、peer dependencies 和声明的脚本名称；脚本只展示、不执行。识别出 DSH manifest 或补齐构建产物，仅表示来源包完整，不表示 DSH Runtime 已移植。安装工具会再读 Profile 清单，核对同一来源 commit、目标 App 和真实状态；无兼容运行适配器的插件回报为 `verified_incompatible`，不能表述成已可使用。安装审批摘要会显示当前 Runtime 是否支持运行，并说明兼容新安装会尝试自动启用。

AI 的 `capability_list` 为模型返回当前 Owner 判定的 `canEnable`，该值由实际兼容 Runtime 状态派生，不写入 Profile 清单。模型处理直接 GitHub 来源时先核对同 App 同源记录；已启用项停止，已安装且可启用项走 `capability_set_enabled` 后回读清单，普通“安装”不触发 revision 更新。

Windows x64 会注册 `WindowsAppContainerPluginRuntime`：只接受声明 `.mjs` 入口且没有额外 capability 的 LFAA v1 插件；源码只读、AppContainer 无网络、插件环境变量按白名单重建、每个进程最多 512 MiB、每个 Profile 最多同时启用 4 个进程。启动须收到 Host 与插件两层就绪消息；停用等待插件确认和 Host 退出，再撤销 ACL 与 AppContainer 配置。`plugins.enabled` 继续管理账户 AI 扩展，不决定本包的核心工具是否可见。

## LFAA-Harness 内的 Wallpaper Engine 来源兼容

LFAA-Harness 是产品、Profile、插件来源核验、安装与生命周期的唯一 Owner；Host 路由继续由 LFAA 的认证 WebServer 提供，账户偏好和设置由 LFAA Settings Owner 持有。`DshWallpaperEngineRuntime` 是 LFAA Plugin Manager 对这个固定第三方包所声明 DSH v1 ABI 的兼容适配，不要求安装或运行 DSH 应用，不把 DSH 变成 LFAA 的宿主，也不构成通用 DSH 插件宿主。

## 官方来源检查与更新

`DshWallpaperEngineRuntime` 只接受官方 `elysia395/dsh-wallpaper-engine`、包名 `dsh-plugin-wallpaper-engine`、有效语义版本、Plugin Manager 核验记录与当前 DSH v1 Host/Client 合同。它不重复固定某一个版本或提交号。适配锚点须同时匹配 LFAA WebServer 管理边界、Scene 媒体源与 Scene Renderer 文档路由的围栏/生命周期合同；Client 必须保留上游 RopeDock 和生命周期结构。不匹配时拒绝启用。每个来源 commit 与 `adapter-<revision>` 都写入独立运行副本，并保存来源版本、commit、归档摘要及适配后内容 SHA-256；后续加载前回读校验。插件源码仍在 LFAA Web Host 进程内由 DSH Loader 托管，**不具备 AppContainer 进程隔离**，所以不能扩大为任意 DSH 插件。Client 在 LFAA 登录恢复前从启动图过滤，登录后同步 Host 当前模块图，注销时卸载插件模块。其他 DSH 插件或仓库不会由此适配器加载。

LFAA 的 Cordis 会将可构造的具名 `function apply` 识别为 class 插件。上游 Host/Client 导出的 `apply` 因此在 LFAA 私有运行副本内包装为箭头回调，确保上游返回的清理器由对应 Fiber 持有；LFAA 的停用流程也等待 Cordis Loader 丢弃的 Fiber 清理 Promise 完成，再报告停用。该窄适配只改导出形态与 LFAA 生命周期等待，不改上游界面或已安装源码；变更适配器时递增 `adapter-<revision>`，保留旧副本以便诊断。

更新仍由管理员在现有 `capability_inspect` → `capability_install` 检查/审批链选择新的明确来源 revision。只有同一官方插件、同一 App、当前已停用、且新清单仍由 Runtime 支持时，安装器才原子替换插件源码目录；其他插件 ID 冲突规则不变。失败会恢复原目录和清单；更新后保持停用，须显式启用。旧的按提交隔离运行副本与 `<LFAA_DATA_DIR>/plugins/runtime-data/profiles/<Profile>/dsh-plugin-wallpaper-engine/` 私有数据不覆盖、不迁移、不清空。正常上游版本和 UI 资源由插件源码提供，LFAA 不维护 UI fork；若上游改变 DSH ABI、Host 媒体边界或适配锚点，则该 revision 会拒绝启用，需要更新适配合同后再接入。

适配沿用上游 Web/Scene/Video 实时壁纸、播放列表与轮播、过渡、项目属性、导入/上传、音频、过滤/评级/隐藏恢复、字体集、外观/播放设置、QuickPanel、诊断和媒体准备/回退逻辑。LFAA 提供 DSH `settings.section`、`sidebar.right.pane.tab` 和 `shell.overlay` Slot；现有设置页与右栏呈现上游面板，RopeDock 使用 LFAA 已有 React 根。`shortcuts.register` 保存到账户快捷键设置，`locale` 跟随 `general.language`，`theme.setTheme` 写入 `appearance.theme`。DSH 文字色与字体角色令牌继承 LFAA Appearance 基线，并把用户设置的角色覆盖限定在 Workbench 的 Markdown、代码块和节点任务终端；上游字体集、字体角色和主题色偏好仍按上游格式保存在当前 Profile 运行数据中。上游不支持 Application/EXE 壁纸。

设置、上传、字体集和管理 API 复用 LFAA WebServer/Carrier；上游设置 Body 保持流式读取。壁纸 ID 适配到账户设置 `appearance.wallpaperEngine.enabled/projectId`，Profile DSH 配置中的共享 ID 固定为空。上传、字体集、其他插件设置和缓存沿用上游格式，写入 `<LFAA_DATA_DIR>/plugins/runtime-data/profiles/<Profile>/dsh-plugin-wallpaper-engine/`。Scene `scene.pkg` 与网页壁纸资源统一复用现有 Host 上的 `/wallpaper-engine/scene-files/` 路由，不另开 loopback 监听端口；此路由经过 LFAA 认证中间件，沿用上游 `handleSceneFiles` 的 Range 传输、资源 token、字面路径与 realpath 双层围栏。Scene Renderer iframe 复用同源 `/wallpaper-engine/scene-live/` 路由；适配副本只对 `index.html` 文档响应将全局 `X-Frame-Options: DENY` 覆盖为 `SAMEORIGIN`，静态资源和其他响应继续使用全局策略。适配器仍核验固定官方来源的临时监听、诊断端点、路径围栏和 Fiber 清理锚点，但运行副本将 `ensureMediaOrigin()` 固定为无源，避免库存、诊断或壁纸请求启动第二个监听；`mediaBase` 为空时由上游 Client 使用当前页面 origin。若官方来源路由、围栏或清理锚点变化，适配器拒绝启用。Wallpaper Engine 不创建通用插件服务或 Daemon 能力。`appearance.theme`、`accentColor`、`overlay`、`blur`、字体/字号、对比度和减少动态效果仍由 LFAA 管理。

构建不能证明登录后的 Host/Client、真实 Steam Video/Web/Scene、上传/音频、Tauri 或帧时间验收；这些运行项要单列证据。插件继续通过既有 `capability_*` 流程检查/安装/启用，不会自动操作用户的 Steam 内容。

## 首阶段 LFAA v1 运行合同

插件包在 `package.json` 的 `lfaa.plugin` 声明 `apiVersion: 1`、稳定 `id`、包内 `.mjs` 相对 `entry` 和 `capabilities`。当前 Windows Runtime 只允许空能力列表，因为尚未实现宿主 API/IPC；入口收到 `LFAA_PLUGIN_ID`、`LFAA_PLUGIN_PROFILE` 和 `LFAA_PLUGIN_PROTOCOL=1` 后，必须在 stdout 输出一行 `{ "type": "lfaa.plugin.ready", "protocolVersion": 1, "pluginId": "<id>" }`。停用时 stdin 收到 `{ "type": "shutdown" }`，插件输出 `{ "type": "lfaa.plugin.stopped", "pluginId": "<id>" }` 并退出。stdout 只承载有长度上限的 JSONL 生命周期消息，未识别的输出会终止该进程；stderr 可用于常规诊断。

跨类型目录当前已登记 `plugin` 适配器；Skills、Prompts、Tools、MCP、Minecraft 插件和模组仍显示为领域 Owner 适配器未接入。模型工具按目标 App 路由，插件安装/启停/移除遵循管理员身份与 `permissions.mode`。真实 Provider 连续选择工具的端到端验收尚未完成。
