# client/ui-layout

`Workbench` 将认证后的 `/plugins` 路由懒加载到 `ui-plugin-manager`，并把它作为独立模块工作区显示。页面的全局导航归 `ui-sidebar`，插件来源/状态展示与动作意图归 `ui-plugin-manager`；WorkBench 只装配该页面，不持有插件规则。

## 小鱼共享工作入口（2026-10-14）

小鱼智能体对话区是首页，根地址与登录默认入口都落到 `/work`；旧工作路由归一。左侧紧凑“应用”菜单保留游戏库和各专业 App 的常规入口，沿用已有 App 打开、偏好保存和路由状态。共用工作区只有一个草稿写入器与活动会话选择；旧 App 草稿保留，首次无共享草稿时回读上次 App。通知直接打开共享会话。General 中旧 `defaultMode/defaultStandaloneChat` 字段保持账户读写兼容，不再改变首页。

构建只写仓库根 dist/packages/client/ui-layout/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

工作区现存卡片通过 `lfaa-card-motion` 和 `lfaa-card-motion-list` 注册到共享动效；Workbench 将账户 `general.cardMotionEffect` 映射到根节点，并将 `general.dialogMotionEffect`、减少动态效果偏好及当前 Appearance 主题/强调色/字体字号/对比度/壁纸表面令牌同步到 body，供 Ant Design Portal 的 Modal、确认弹窗和 Popconfirm 读取；弹窗外框、标题/正文/操作区留白和响应式滚动基础归 `ui-theme` 集中维护，业务页面只保留内容布局与必要尺寸。

Workbench 协调默认凭据安全提醒与首次配置提醒的先后顺序。凭据提醒数据和“稍后再说”的确认请求仍由 `ui-renderer` 从 Account Owner 读取；Workbench 将状态及回调交给 `ui-settings-general` 的 `SetupReminder`，两类提醒共用同一 Modal、单一标题、说明和按钮布局。`general.notificationPopupsEnabled` 是弹出通知总开关，关闭时隐藏首次配置、凭据与通行密钥提醒，并阻止新增 AI 工作通知和 Toast；各类别长期值及会话内审批/澄清卡片保持不变。账户安全提醒的“今日不再提醒”按账户、本地日期写入独立浏览器标记，次日恢复；暂停当天不阻止首次配置提醒检查。“不再提醒”由 `SetupReminder` 保存现有 `general.defaultAdminCredentialReminderEnabled=false`，成功后关闭当前提醒，保存失败显示错误并保留弹窗。首次内容存储提醒明确提供“不更改”和“更改为系统推荐”操作：分别保存 Owner 返回的默认内容根与动态推荐根；自定义位置仍前往配置中心。成功确认后由内容存储 Owner 的 `configured` 状态抑制重复提醒，不移动数据或修改系统数据根。凭据检查完成前及凭据提醒显示期间暂停首次配置提醒检查，避免并行请求和双重遮罩；设置检查、当日暂停与提醒开关仍由 `SetupReminder` 独立管理。

登录进入时，`Workbench` 仅在认证已成功后由 Renderer 挂载；首轮布局提交可通过 `onAuthTransitionWarmupReady` 通知 Renderer。转场期间根节点保持隐藏、不可聚焦且不可交互，提醒继续暂停；动画结束后复用已挂载的同一 Workbench。

壁纸画布仍消费 Settings Owner 的 `appearance.backgrounds` 与 `appearance.wallpaperEngine` 偏好。首帧根据账户启用状态、项目 ID 与已应用的 DSH Profile Client 图选择 Owner，避免刷新时先绘制账户背景再切到插件壁纸；Profile Client 图移除引擎后恢复账户背景，不改写用户保存的偏好。插件拥有活动壁纸画布时，Workbench 将 `--we-accent`、玻璃色/保真度/透明度、模糊、边框和逐面设置映射到 LFAA 共享 Appearance 令牌；插件停用或壁纸未运行时不装配该映射，回到账户 Appearance。Settings、左右侧栏、聊天和浮层分别读取 DSH 的 `data-we-*` 开关及逐面变量；玻璃滤镜沿用插件的模糊、饱和度、亮度和对比度，深色右侧栏沿用 65% 玻璃色权重；不复制插件配置、不增加请求或状态订阅。主题与字体角色继续分别使用 Theme Owner 和受限 DSH Token Bridge。
