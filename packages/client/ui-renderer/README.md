# client/ui-renderer

DSH Client 图可用时，Renderer 将 LFAA 工作台挂入 DSH UI Renderer/Slots；图或 Renderer 暂不可用时，直接用本地 React 根挂载同一 LFAA `App`。后一模式保留 LFAA 自身界面，只关闭 DSH 扩展槽；图恢复后刷新页面重新装载扩展。

## 小鱼共享工作入口（2026-10-14）

统一路由归一与认证恢复；根地址和认证后的默认入口直接进入 `/work` 小鱼智能体聊天与代码开发工作区；旧 `/desktop`、`/tasks` 和通用工作区 AI Work 路由继续归一到 `/work`。`/voice` 是同一 AI Work 工作区的全屏语音别名，不新增应用 ID 或认证范围。专业 App 从全局应用切换器打开，沿用现有应用入口标记与服务端认证/授权。旧工作地址刷新/历史归一。

认证后直接进入小鱼工作区，不再显示首次进入向导；`guided_entry_completed` 作为旧账户数据字段保留兼容，不要求用户选择或保存首次工作入口。

构建只写仓库根 dist/packages/client/ui-renderer/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

Renderer 从 Account Owner 读取默认凭据待处理状态，并在用户离开设置路由后重新读取；修改仍未完成且凭据提醒偏好开启时继续提醒。`ui-settings-general/SetupReminder` 将它与 AI Provider、业务内容目录提醒排队显示；当日暂停按账户/类别/日期保存，稍后重试只在当前工作区延后五分钟。SteamCMD 游戏安装位置仍由“项目与存储”管理，但不触发首次登录提醒。Renderer 不会因本地暂停或稍后重试而确认或修改服务端凭据状态；类别关闭状态由 Settings Owner 持久化并由提醒弹窗交互更新，设置中心只提供统一的通知总开关，不暴露分类提醒开关。

内置登录转场由 Renderer 预热 Workbench 并持有显示/交互门控；约 420ms 黑洞主动画完成后，Workbench 先在覆盖层后变为可见，再由登录覆盖层做 160ms 淡出，淡出结束后才释放 `inert`/`aria-hidden` 并显示提醒。认证转场合同见 [登录进入动画插件合同](../../../docs/development/auth-transition-plugins.zh.md)。

认证后的 Electron `/?mini=1` 路由读取当前 Settings Owner 偏好并渲染独立 Mini；该路由不预加载 Workbench。Web Host 没有桌面 Mini bridge 时仍显示普通工作区，不声称创建原生窗口。
