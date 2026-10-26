# 共享工具合同与注册 Owner

持有工具类型/参数辅助、可撤销注册/上下文工厂与 Run 摘要目录。领域工具和正文不再集中在 business-tools。

公共合同：registerAiBusinessTool、registerAiBusinessToolFactory、listAiBusinessTools、createToolDiscoveryTools。`lfaa_tools_list` 支持按工具 ID、名称或说明做多词任一命中搜索，结果先按完整查询命中、再按命中词数量排序，并返回 `matchedTerms`；空查询保留注册顺序和分页。`lfaa_tools_load` 仍只按精确工具名加载已有合同，不执行业务。

Skill 附属文本资源通过 `lfaa_skill_load` 按当前 Skill Provider 或项目文件 Owner 读取；项目文件工具的 `read.limit` 可限制为 1–100000 个字符，不改变原有根目录、节点、身份与权限检查。

用户明确提供本机绝对项目目录时，`project_file_operation.rootDirectory` 优先于隐式 Agent Git/Workspace 绑定，无显式 `nodeId` 时复用 LFAA Host 的 Project Files Owner。未登记根目录只读，并沿统一 Permission Owner 作为危险读取授权；目录列表、搜索和读取保持有界，Agent Run 的取消信号会传到本机只读 Host 操作。模型据真实读取证据说明项目用途、入口和框架；对概览请求优先使用项目导航与架构说明，避免递归读取所有包，说明未覆盖范围，不把 `list` 或一次搜索说成读完全项目。

运行位置：Control Plane 的 Cordis 插件或内部合同库，由 base Bundle 装配；不运行在浏览器，不将凭据或节点进程带入客户端。依赖以本包 package.json 为准，真实消费者见生成包清单的静态证据。源码/装配声明与现场运行验收分别记录。

设置：复用 plugins.enabled（第三方扩展）、plugins.skillDirectories（Skill 来源）、permissions.mode、Provider/模型及 aiRuntime 的输出/请求/上下文/工具/委派预算；领域工具读取原 minecraftRuntime、设备存储位置及节点覆盖。没有新增设置或默认值，不重置用户偏好。内置方法不因第三方开关关闭而成为虚假不可用，用户内容仍受原范围与开关约束。

`capabilities.settings-status` 对 Browser Use 显示主开关与已登记工具；内置浏览器不需要接入偏好，个人 Tabbit 连接保存在 `enabledProviderIds`。Settings Owner 的 `webUrlOpenLocation` 与 `localUrlOpenLocation` 分别指导 Agent 处理公开网页和本地开发 URL 的优先路径，默认均为 `lfaa`；选择当前浏览器时只可使用本 Run 实际提供并经现有设置/权限允许的 Tabbit 或 Windows CUA。不能把未接入的个人 Edge/Chrome Profile 当作 Browser Provider，也不能静默改变用户设置或在所选通道不可用时切换路径。具体 Host 是否有可用浏览器由 Browser Owner 的提供方目录确认。设置变更仍通过统一 Permission Owner。

Browser History Tools 可同时要求 `requiresBrowserUse` 与 `requiresBrowserHistoryAccess`；Agent Loop 按 Settings Owner 实时值筛选，Browser History Owner 执行时再次验证历史开关，敏感读取仍走现有权限模式。

`lfaa_browser_website_tools` 还要求 Agent Browser Use 与 `useWebsiteToolsByDefault` 或精确来源例外；只读取当前页面同源 WebMCP 工具，网站描述、参数和结果均是不可信内容，执行按危险操作经 Permission Owner。`lfaa_browser_cdp` 仅在 `browserUse.enabled`、`developerMode` 和 `fullCdpAccess` 同时开启时发现；Browser Owner 执行时再次校验这些设置并拒绝个人 Tabbit Provider，只附着当前 LFAA 页面，参数/结果有界，调用按危险操作经 Permission Owner。

产品名可能同时指本机客户端与官网时，通用 Agent 指令要求先结合对话判断；上下文未能确定时先通过 `lfaa_ask_user` 询问目标，在用户回答前不搜索/启动本机应用，也不导航网页。工具审批不替代目标澄清。

安全与数据：目录/方法不构成授权；真实动作经过原 Permission、参数、账户、作品/项目/节点和领域事务。本机项目只由 `nodeId: null` 或精确匹配受保护本机 Daemon 身份的目录进入本机 Host；身份未知的非空节点 ID 不会被当作本机。加载不执行外部文档指令，不自动重放未知副作用。注册随所属 Fiber 撤销，异步正文加载前后检查登记，Run 工具选择不进入全局状态；子任务只继承父 Run 提供的范围。

构建输出：根 dist/packages/core/tools/。直接回归见 apps/cli/tests/package-owner-lazy-capabilities.test.mjs、harness-runtime-wiring.test.mjs 与各领域长期测试；具体已运行结果见本轮任务合同及交付报告，不能据包存在宣称 Provider/桌面/远端已实测。

Agent 设置中心工具：`lfaa_settings_list` 按分类/关键词查询 Settings Owner 当前值、默认值、可选枚举/范围，并分页返回；`lfaa_settings_update` 只按精确字段路径更新一个账户偏好，由 Settings Owner 再次严格校验、保存和回读。`permissions.mode` 只能由用户控制；能力总开关继续使用 `lfaa_set_capability_enabled`，敏感连接和来源由专属 Owner 管理。每次写入在 Agent Loop 按工具风险进入同一 Permission Owner，`ask`、`approve_remembered` 和 `full_access` 不新增设置专属审批策略。

设置页 Browser Owner 菜单入口 `lfaa_browser_manage_settings` 支持连接/断开可用个人 Provider、清理账户最近网站/浏览数据、只读凭据元数据、删除已保存条目和在当前 LFAA 页面安全自动填入。连接保留用户电脑操控开关；断开先关闭对应账户会话。元数据过滤用户名和联系方式；填入按危险操作走同一 Permission Owner，不返回密文/明文、不提交表单、不操作个人 Profile；新增或编辑凭据仍由用户在安全设置表单直接输入。该工具不管理 Electron 下载记录或扩展目录。

`lfaa_settings_list` 返回 `util/values/src/settings-menu-catalog.ts` 的完整设置菜单清单；`menuId` 可精确读取该菜单的账户字段和接入边界。需要菜单动作或读取动态数据时，Agent 按目录 `toolSearchTerms` 搜索并按需加载本次运行真实登记的 Owner Tool；清单说明某功能未接入时不得用通用设置写入或假成功补齐。密码、恢复密钥等安全表单仍由用户直接输入。

代码审查菜单映射到 `project_file_operation` 的 `diff` 操作，使用 Agent Git Workspace 当前绑定仓库与本机 Git Owner 返回的真实差异。模型须围绕改动读取必要上下文并给出只读审查；无绑定仓库或差异读取失败时如实说明，不自动写入、提交或推送。

钩子菜单提供 `lfaa_settings_runtime_hooks_list`，读取当前 Agent Host 中 Cordis AI Runtime Hook 注册表的 ID 和事件列表；回调与插件代码不离开 Host。没有 Hook Owner 注入时工具会报告不可用；钩子创建、编辑和代码执行仍须由受信任插件 Owner 提供，本工具不伪装为可写。

家长控制菜单提供 `lfaa_settings_parental_list` 与 `lfaa_settings_parental_update`。策略由 Identity/Auth 的账户使用控制 Owner 管理；只允许管理员为普通成员配置每周时段与每日 Agent 分钟数，更新始终按统一 Permission Owner 执行。写入按危险风险范围授权，结果读取 Owner 回读；Agent 执行链独立消费策略。此能力不写入或替代 `permissions.mode`。

`lfaa_settings_mini_window` 将打开/关闭请求经 Control Plane 子进程 IPC 交给 Electron Main Owner，等待该窗口 Host 的真实回执；Web Host 抛出不支持错误。`lfaa_settings_sync_status` 只读取 Settings Owner 按账户隔离的当前 Control Plane 分类/时间元数据，不暴露设置值、会话或凭据。两者仍由 Agent Loop 的唯一 Permission Owner 控制写风险。

`lfaa_tools_list.query` 使用中文词语分段并合并相邻单字词，支持自然中文整句发现当前已登记工具；英文、数字与中英文标点分词和原有任一词匹配/排序/分页保持不变。该目录不增加或扩大工具授权。
