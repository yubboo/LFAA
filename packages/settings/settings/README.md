# 设置 Owner 与统一数据根

`preferences/service.ts` 是账户 App/工作模式和首次入口引导标记的唯一 Owner。`guidedEntryCompleted` 默认 `false`，完成后与 `selectedApp/selectedMode` 一起写入现有 `user_preferences` 配置记录；它不是设置中心可切换项，不影响业务数据或权限。

账户外观中的 `appearance.advanced.writingLightRaysEnabled` 由本包设置合同校验并按账户持久化；缺少该字段的旧账户仅补共享默认开启值。设置中心与普通写作工具栏读取同一偏好，Settings Owner 不复制写作背景逻辑。

AI 漫剧与画布共用图片账户/模型默认值 `aiRuntime.imageGenerationAccountId/imageGenerationModelId`；`imageGenerationMode` 只控制 AI 漫剧本机/远程引擎，画布使用远程 Provider，可由 Agent 按单次目标选择当前用户账户中的 Agent Plan 图像模型，且不写回默认偏好。视频继续使用 `videoGenerationMode/videoGenerationAccountId/videoGenerationModelId`。Agent Plan 模型目录带官方 `taskType`、支持档位与来源：设置只把图像/视频能力模型放进对应选择器，主模型路由只暴露文本模型。图片/视频账户复用设置中心加密密钥和当前用户所有权；设置中心凭据来源仅向登记的消费者提供账户密钥解析，画布生成 Owner `lfaa-canvas-generation` 已登记为该来源消费者。本机模型 ID、时限和空闲释放仍读取现有 `aiRuntime` 字段，切换漫剧引擎不会清除远程选择。

`registerAiProvider` 是 Provider 设置目录的 Cordis 扩展合同：插件可提供受校验的 Provider 选项、模型发现与真实模型测试处理器，列表 API 返回防篡改副本，注销会移除该插件的目录定义。静态账户凭据仍由本包及 Credentials Owner 管理；Provider 连接 URL 必须使用 HTTPS 且不得内嵌身份信息。该扩展接口不改变当前外部插件 Runtime 的隔离边界。

Agent Shell 的文件访问范围由 `aiRuntime.executionSandboxMode` 设置，默认 `workspace-write`，可选只读、工作区读写或完全访问；该字段不是 Permission Owner 的三种授权模式。设置服务负责默认值、枚举校验与账户持久化；受限模式能否执行仍取决于目标平台实际注册的 Sandbox Provider，缺少完整 OS 隔离时失败关闭。

普通 Provider/API Key、模型目录与系统活动模型由 Settings Owner 写入 `ai_accounts` system scope（`configuration_records.user_id = null`），所有登录账户读取同一系统模型集合；系统模型编辑 API 仅管理员可写。火山方舟 Agent Plan 与 Coding Plan 使用 `user_id` 保存席位所有者，每个登录用户只能读取、测试、激活、改密钥或删除自己的 Plan 账户；其活动模型优先于系统活动模型，未配置个人席位时回退到系统活动模型。Plan `options.planTier` 保存个人套餐档位。套餐专属 Key 没有公开 `/models` 目录 API，因此 Settings Owner 使用带修订日期与官方来源 URL 的套餐公开能力目录；文本主模型保存前仍向专属 Chat Completions 端点真实测试，能力目录不伪装成账户实时权限查询。实际可用范围按控制台档位与服务商请求结果验证。

首次读取旧模型配置时，仅在尚无任何 system-scope 配置的情况下，将超级管理员的旧非套餐 Provider 模型记录按原 ID、活动状态、选项和密文原样迁入 system scope；Agent/Coding Plan 记录不参与迁移，其他成员的旧个人记录保留且不进入系统模型列表。此读取迁移不会解密或重写密钥。

已保存系统模型的“更新目录”只重新读取并保存 Provider 官方模型目录，不发起模型推理，也不更改已选模型 ID 或 `reasoning_mode`；若当前型号已从新目录移除，保留原选择并提示管理员。“重测模型”只对当前已选型号发起真实请求，可能产生 Provider 用量。DeepSeek 官方错误码 402 映射为余额不足提示，422 才提示检查模型/参数；目录读取成功始终不代表真实推理请求通过。系统模型替换密钥和管理操作仍要求管理员权限；个人 Plan 配置由席位所有者管理。Plan 主模型必须是文本生成能力；图像、视频、语音、向量模型不进入 Agent Loop 文本路由。`aiRuntime` 的运行参数与图片/视频模型选择仍按登录账户保存。

AI Work 模型选择从 `/settings/ai/accounts` 的全部可见账户目录产生；上下文、输出上限、任务/输入模态、版本与思考参数只使用目录内已明确提供并经过校验的字段。`selectAiAccountModel()` 验证 Provider 当前目录及目标模型后，事务性保存模型 ID、完整模型目录、该模型兼容的思考模式和活动账户；切到系统账户会清除当前用户的 Plan 覆盖，未选中的系统回退账户仍按全局规则处理。

Provider 与插件秘密凭据使用 LFAA Home `credentials/settings.key` 执行 AES-GCM 加密。读取时若密钥文件缺失，Settings 不得自动生成替代密钥，以免让已有密文永久无法解密；用户明确录入新 Provider 凭据时才可创建密钥。已有密文校验失败时显示重新录入指引，保留旧账户记录，不声称能从密文恢复原密钥。

账户偏好、Provider 凭据引用和权限留在 LFAA Home（默认 `%USERPROFILE%\\.lfaa`，不增加 `system-data` 子目录）。`project-storage.ts` 负责统一业务 Data 根，首次默认 `<LFAA_HOME>/data`（Windows 默认 `%USERPROFILE%\\.lfaa\\data`）；Home Paths 在 Data 根创建共享 `models/`、`input/`、`output/`，模型适配器按自身模态与原生组件格式管理 `models/text/`、`models/image/`、`models/video/`、`models/audio/`、`models/encoders/`、`models/vae/`、`models/adapters/`、`models/acceleration/`、`models/upscalers/`。目录结构由 LFAA 自己定义，和 ComfyUI 权重格式/版本无关；Veo3 是远程 Provider 能力，不当作本机模型。AI Video 的最终项目素材仍由其 Owner 保存于项目目录，避免同时写进共享 `output/`。账户业务文件位于 Data 根的 `users/` 下。系统推荐路径按当前项目或安装根动态解析为其 `data` 子目录；自定义路径把用户所选目录作为父目录，在其中创建 `data/`（所选目录本身名为 `data` 时直接使用）。位置保存在 Home 控制配置；切换时创建新业务分类、保留旧根，控制端与 Daemon 重启后使用新值。游戏、小说和漫剧内容复制/核对/ZIP 仅处理受管业务子树，不复制 Home 系统账户数据。远端环境位置由该节点真实 data 根与平台推导，不能复用控制端盘符。

常规设置中的 `general.cardMotionEffect` 与 `general.dialogMotionEffect` 由此处执行 Strict 校验、按账户持久化和旧值兼容；旧记录缺字段时分别回落到共享默认值，旧客户端省略动效字段保存其他常规设置时保留已选效果。

`general.notificationPopupsEnabled` 是账户级通知总开关，默认开启，统一控制首次登录提醒、版本公告及其他工作台弹出通知。凭据、AI Provider 和业务内容目录类别状态分别保存在 General 的 `defaultAdminCredentialReminderEnabled`、`aiProviderReminderEnabled` 与 `setupReminderEnabled`，由提醒弹窗中的“不更改”更新；设置中心不提供首次登录类别开关。SteamCMD 游戏安装位置由“项目与存储”管理，不作为首次登录提醒。General 读取旧账户缺失字段时使用共享默认值；旧客户端保存其他 General 字段时省略已有字段不会覆盖服务端状态。版本公告的确认状态按账户/版本保存在浏览器本地；公告与桌面更新器合同相互独立。

`general.defaultMode` 与 `general.defaultStandaloneChat` 因首页固定为 `/work` 而不再驱动路由；服务端仍校验、读取并保存账户原值，其他 General 更新不会重置旧账户偏好。

账户 `plugins.disabledSkillNames` 保存设置中心逐 Skill 停用名单，默认空列表，最多 200 个唯一 kebab-case 名称。读取历史设置缺少此字段时使用空列表；旧客户端提交缺字段时，`saveUserSettings()` 合并当前值以保留既有停用选择。此名单只控制模型 Skill 发现、按需加载和工作区 Skill 引用，不修改 Skill 文件、来源或权限模式。

`general.hiddenApplicationNavigationIds` 是用户可隐藏的内置工作台导航项白名单，默认 `[]`；读写时按共享导航 ID 列表严格校验并去重，导航项可包含领域聚合入口和系统共享能力，不等同于 App ID。旧账户缺字段时读取默认空列表；旧客户端遗漏字段更新其他 General 偏好时保留服务端当前值。该设置仅控制导航显示，不代表应用权限、安装或运行状态。

旧 project_storage_locations 中的作品与环境位置仅作为已有文件回读候选，不删除原记录/文件。Writing、AI Video 和 Runtime Executor 继续核验账户、项目和真实路径；新内容写入当前已选择的业务内容根。原分类设置写入接口由 API Owner 明确退役，不另造迁移器或权限策略。

“项目与存储”由 `project-storage.ts` 唯一持有业务 Data 根：首次默认 `<LFAA_HOME>/data`；“系统推荐”按当前项目或安装根动态生成 `data`；自定义位置在用户选择的位置下创建 `data/`（如果所选目录本身名为 `data`，就直接使用它）。当前 Data 根原子保存在 `<LFAA_HOME>/storages/data-directory.json`，旧 `project_storage_locations.content_directory` 只在升级时回读一次；首次选定或切换后创建 Data 业务分类，旧根保留。控制端和 Daemon 重启后从同一配置读取该路径。若部署显式设置 `LFAA_DATA_DIR`，设置页只读并由部署配置控制。

`content-storage-migration.ts` 仅发现 `games/` 与账户哈希下的 Writing/AI Video 项目树。系统复制覆盖前保留目标业务子树备份，合并时保留目标独有文件；手动模式只有路径、类型、大小及 SHA-256 完全一致才切换；ZIP 导入/导出只包含上述业务树。迁移源始终保留，复制/导入回读校验成功后才保存新根。API 由认证管理员显式发起，并通过 Permission Owner 的显式页面操作授权。开发者页只展示客户端与控制端状态，不展示或更改数据目录。浏览器验收复用现有 admin 测试账号；自动化回归使用合成文件，不创建产品账号。ZIP 辅助脚本随 Electron/Tauri 运行树打包。

设置页沿用共享主题、字号、动效与响应式配置；[本轮提示词](../../../docs/development/file-resources.zh.md)。构建只写根 dist/packages/settings/settings。

外观自定义背景由 Settings Owner 按认证账户保存文件与 MIME 索引；上传声明中的 MIME 只作提示，实际 PNG/JPEG/WebP 类型按文件签名确定，再由唯一尺寸解析和服务端 3 MiB、8192 边长、2000 万像素限制校验。私有素材保存在 `<LFAA_HOME>/users/<账户哈希>/assets/backgrounds/`，磁盘文件采用上传原名的安全版本与实际内容扩展名；同账户重名时追加 `(2)` 等可读序号，SQLite UUID 仍只用于内部引用。旧 UUID 文件与 SQLite BLOB 在摘要/内容回读核验后迁移，保留账户隔离并在成功写入前不删除原文件；构建只写根 dist/packages/settings/settings。

`browserUse.webUrlOpenLocation` 与 `browserUse.localUrlOpenLocation` 默认均为 `lfaa`，按账户保存 Agent 打开公开网页与 localhost/loopback 开发 URL 的位置；`current-browser` 仅在本 Run 有可用的个人 Browser Adapter 或 CUA 时可执行。旧客户端省略新字段保存 Browser Use 设置时保留服务端已有偏好，并为缺失账户补共享默认值。工作区 HTML/HTM 预览仍由 Project Files Owner 提供受限临时页面。

`browserUse.recordRecentSites` 默认开启并按账户保存设置；旧客户端保存其他 Browser Use 字段时省略该值不会覆盖已有选择。该开关不控制 Agent 工具连接权限，只由 Browser Owner 用于停止/恢复最近网站元数据的写入与读取。

`browserUse.allowAgentHistoryAccess` 默认关闭，单独控制 Agent 是否可按任务需要读取 Browser Owner 最近网站记录；还须启用 Agent 浏览器主开关、最近网站记录，并通过既有 `permissions.mode`。`browserUse.annotateScreenshots` 默认 `on-demand`，枚举为 `always`、`on-demand`、`never`，只影响 Agent 页面观察工具是否将当前视口截图作为临时图像输入；截图不会持久化。服务端严格校验并为旧客户端保存其他 Browser Use 设置时保留缺失字段。

Browser Use 设置还包括默认 Bing 搜索引擎、默认关闭的完整网址展示、默认关闭的 WebMCP 网站工具与按 HTTP(S) 来源设置的允许/拒绝例外、默认开启的下载前询问、摄像头/麦克风/位置信息/通知四类默认询问策略及来源例外、默认关闭的开发者模式与完整 CDP。所有这些偏好按账户走 UserSettings；完整 CDP 仅当开发者模式和完整 CDP 开关同时启用时有效，读取和更新均保留旧客户端未提交的已有字段。

密码与联系信息的 Browser Vault 秘密值走 Credentials Owner 加密记录，不能进入普通 UserSettings、列表响应或会话记录；Browser Owner 只向设置页返回元数据，并在用户明确点击后对当前 LFAA 内置页面执行来源与字段校验。Electron 下载目录、下载历史、扩展记录留在该 Host 的本地 `native-browser-state.json`；下载前询问和网站权限偏好仍按账户设置保存并同步给 Electron。网站权限由 Electron 原生 Session 执行；普通 Web Host 无这些系统级本机 API 时由 Client 显示不支持。

Agent 设置目录由 `src/agent-settings.ts` 从当前账户 `UserSettings` 与 `settingsSchemas` 生成，只返回有界字段、当前值、默认值和校验选项。`updateAgentSetting` 一次只写精确叶字段，并复用 `saveUserSettings` 的严格类别校验和账户持久化；权限模式只读，电脑操控/Browser Use/扩展总开关改走其真实能力 Tool，个人 Provider 连接、MCP 命令、插件来源目录和提示词正文留在专属 Owner。模型路由目录只返回当前账户真实已配置模型的非秘密元数据。Agent 直接设置不经过 Client/API 旁路；统一 Permission Owner 负责三种模式授权。Browser Recent Sites/数据/凭据/Provider 操作留在 Browser Owner 工具，不并入 Settings Owner 通用 Patch。

`listAgentSettings` 同时返回共享 `settings-menu-catalog.ts` 的完整菜单目录、访问边界、工具搜索词和按 `menuId` 筛选的字段；目录明确区分账户偏好、专属 Owner、只读、用户直接输入、部分接入与未接入状态。字段菜单映射、Joi alternatives 枚举、纯色背景和账户自定义背景选项由 Settings/共享值 Owner 生成；目录读取自定义背景元数据时不触发旧图片迁移。

`mini` 是账户级设置分类，默认伙伴为 `moss`、显示开启、窗口置顶开启、不透明度 100%；读取、严格校验、持久化和 Agent 单字段回读继续归 Settings Owner。`getUserSettingsSyncStatus()` 只返回当前账户已保存的分类和最新更新时间，不返回设置值/秘密；它描述当前自托管 Control Plane，不承诺独立 Control Plane 自动复制。

`canvas` 是账户级画布偏好分类，默认 `defaultMode: "generate"`、`gridStyle: "dots"`、`snapToGrid: false`、`showMiniMap: true`（在画布左上角显示缩略图）、`agentPanelDefaultOpen: false`。枚举与布尔字段由本包 Strict 校验，未知字段拒绝；`getUserSettings` 为无记录/缺字段的旧账户补共享默认值，`saveUserSettings` 在旧客户端遗漏新字段时合并当前值而不覆盖已保存选择。画布生成模型继续读取 `aiRuntime` 的图片/视频生成账户与模型，本分类不复制第二套模型配置，也不代表生成能力已接通。

账户 `appearance.areaEffects` 的逐区域遮罩/模糊由本包用同一 Joi Schema 做范围校验、旧账户补默认与持久化；`null` 代表继承全局值。旧客户端省略该对象或省略单个叶子时保留当前账户覆盖；登录背景结构缺少新增位置时也保留既有选择。Agent 设置目录从同一 Schema 暴露单字段更新。

账户自定义外观预设保存在既有 `appearance` 分类的有界 `presets` 字段。快照 Schema 拒绝白名单外的设置；`validateAppearancePresetSnapshot()` 仅验证可移植文件结构，允许导出账户的私有背景 ID 等待重新上传，`validateUserAppearancePresetSnapshot()` 再校验当前账户素材归属。`applyUserAppearancePreset()` 在一个配置事务中恢复 Appearance 与白名单 General 布局，同时保留预设库及其他 General 偏好。

`appearance.advanced.aiWorkOutputFocusBlurEnabled` 默认关闭；共享值和 Appearance Schema 使用相同默认，旧账户缺少该字段时只补关闭值，显式保存的账户开关不因默认变更而重置。
