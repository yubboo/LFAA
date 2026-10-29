/**
 * 功能：提供设置中心内开发手册的结构化正文。
 * 作用：让人通过手册 UI 浏览工作台分区，同时让 AI 可直接检索同一份结构化源码。
 * 关联文件：DeveloperHandbook.tsx、docs/development/handbook.zh.md、docs/PROMPTS.md。
 */
export interface DeveloperHandbookPoint {
  label: string;
  detail: string;
}

export interface DeveloperHandbookSection {
  id: string;
  shortTitle: string;
  eyebrow: string;
  title: string;
  summary: string;
  problem: string;
  owner: string;
  implementation: readonly DeveloperHandbookPoint[];
  promptExample?: string;
  settingsAndData: string;
  responsive: string;
  records: readonly string[];
  files: readonly string[];
  verification: string;
}

export const developerHandbookSections: readonly DeveloperHandbookSection[] = [
  {
    id: "overview",
    shortTitle: "工作台总览",
    eyebrow: "先认区域，再追代码",
    title: "LFAA 工作台是怎么拼起来的",
    summary: "工作台把全局入口、当前工作区导航、业务画布和上下文工具放在同一个响应式容器中。四个区域分别由不同包负责，Workbench 负责把它们装配起来。",
    problem: "以前只看某一个页面，很难判断一个按钮属于全局导航、当前应用侧栏还是工作区本身；同类菜单也容易在不同页面各自复制。",
    owner: "应用装配入口是 packages/client/ui-layout/src/Workbench.tsx。布局与栏宽归 ui-dockkit；全局导航归 ui-sidebar；工作区归 ui-workspace；设置分类正文归 ui-settings。",
    implementation: [
      { label: "左一 · 全局导航", detail: "从任意主界面进入首页、应用、最近会话、文件、插件、工具资源或设置。组件只呈现入口并调用 Workbench 传入的回调。" },
      { label: "左二 · 当前工作区导航", detail: "显示当前工作区自己的内容。AI Work 显示草稿、置顶、项目和会话；设置页显示设置分类；其他工作区由其页面决定是否提供侧栏。" },
      { label: "中间 · 主要工作区", detail: "用户正在查看和操作的页面。普通 App 展示业务操作；/work 展示共享的小鱼智能体对话及项目；设置中心展示当前分类。" },
      { label: "右侧 · Dock", detail: "显示当前上下文工具或应用入口。开合、尺寸、拖动和窄容器下的覆盖层行为由 DockKit 管理。" }
    ],
    settingsAndData: "工作区外观读取账户 Appearance 设置并映射成共享主题令牌。导航和面板偏好使用既有 General/DockKit Owner。这个手册本身是静态说明，不读取账户业务数据、不改变任何设置。",
    responsive: "栏位是否并排由 ResizableWorkbench 观察实际工作区容器决定。宽度不足时按已有布局合同收起一侧或改用 Overlay；不能只根据浏览器窗口宽度推断。",
    records: ["#130：四栏工作台的布局合同与代表性宽度验收。", "#141–#143：最近会话入口、一次性导航意图和共享会话 Dock。", "#144：应用导航迁入右侧 Dock 的实施合同；其完成与验收状态以该合同当前记录为准。"],
    files: ["packages/client/ui-layout/src/Workbench.tsx", "packages/client/ui-dockkit/src/ResizableWorkbench.tsx", "packages/client/ui-sidebar/src/GlobalNavigationRail.tsx", "packages/client/ui-workspace/src/ApplicationWorkspace.tsx", "docs/PROMPTS.md"],
    verification: "读源码可以确认组件和调用链；只有对应任务合同记录的真实页面、容器宽高与交互结果才算界面验收。源码存在或构建成功不代表窄栏和短屏体验已通过。"
  },
  {
    id: "global-navigation",
    shortTitle: "左一 · 全局导航",
    eyebrow: "跨页面入口",
    title: "最左侧这一列负责什么",
    summary: "所有页面共用同一条全局图标轨：小鱼智能体、应用、最近会话、设置及更多功能；当前 App 的模式主页与功能模块留在左二工作区菜单。",
    problem: "入口分散在各业务页时，用户需要记住每个页面的返回路径；把业务状态也放进这条导航又会造成两套状态。",
    owner: "呈现组件是 packages/client/ui-sidebar/src/GlobalNavigationRail.tsx；导航目标和业务打开逻辑由 packages/client/ui-layout/src/Workbench.tsx 提供。GlobalNavigationRail 不保存第二份会话清单或应用业务数据。",
    implementation: [
      { label: "菜单项", detail: "小鱼智能体入口固定进入共享 /work；应用、最近会话、设置及更多功能在各页面保持相同位置和样式。组件根据 activePage 标记当前主页面，并通过回调请求 Workbench 导航。" },
      { label: "最近会话", detail: "调用专属 onOpenRecentSessions。Workbench 进入共享 /work 后展开唯一会话 Dock，避免在全局轨再维护一份会话列表。" },
      { label: "服务状态", detail: "只有 general.showServiceStatus 开启时显示连接状态点；状态值来自真实 ServiceState。" },
      { label: "宽度", detail: "标准与紧凑宽度分别由 GLOBAL_NAVIGATION_RAIL_WIDTH 和 GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH 提供，不在调用页面重复定义。" }
    ],
    settingsAndData: "菜单可见性遵守 general.hiddenApplicationNavigationIds；该设置只控制应用导航是否显示，不授予或撤销应用权限。账户、会话与服务状态仍属于各自 Owner。",
    responsive: "导航轨通过 DockKit 的工作区度量使用标准或紧凑宽度。窄视口还要检查弹出菜单是否在所属工作区内可见、可滚动并可用 Esc 关闭。",
    records: ["#141–#143 记录了最近会话从其他页面进入 /work 并展开同一个 Dock 的导航意图和生命周期。", "应用入口布局调整见 #144；不要只凭旧截图推断当前菜单所在栏位。"],
    files: ["packages/client/ui-sidebar/src/GlobalNavigationRail.tsx", "packages/client/ui-sidebar/src/GlobalNavigationRail.css", "packages/client/ui-layout/src/Workbench.tsx", "packages/util/values/src/settings-contract.ts"],
    verification: "检查入口要逐个操作：打开应用菜单、最近会话、工具资源和设置，再确认回调目标与当前活动页一致；窄屏补查菜单的定位与键盘关闭。"
  },
  {
    id: "secondary-navigation",
    shortTitle: "左二 · 分类与会话",
    eyebrow: "当前工作区的导航",
    title: "第二列显示当前区域自己的内容",
    summary: "左二不是另一条全局菜单。它由当前页面决定显示什么，因此工作、设置和其他工作区可以共享导航样式而各自拥有内容与状态。",
    problem: "把所有分类和业务入口塞进同一条侧栏会导致导航拥挤，也会让当前页面承担不属于自己的业务列表。",
    owner: "可复用菜单组件是 packages/client/ui-sidebar/src/SecondaryNavigation.tsx；调用方持有 groups、active 项、展开状态和 onSelect。设置中心使用它渲染设置分类，AI Work 工作区提供自己的会话/项目导航。",
    implementation: [
      { label: "分组与当前项", detail: "调用方传入分组、条目、图标、说明和活动状态；SecondaryNavigation 负责显示，不查询业务清单。" },
      { label: "键盘操作", detail: "支持上下方向键、Home、End 在可用菜单项之间移动；调用方可选择方向键移动时是否立即激活项目。" },
      { label: "设置页面", detail: "左二显示个人、AI、外观、权限、集成等设置分类；搜索、分组展开和 section 持久化仍由 SettingsPage 处理。" },
      { label: "AI Work 页面", detail: "会话与项目列表使用对应 Session/Project Owner；侧栏只发起选择、置顶、归档等既有操作。" }
    ],
    settingsAndData: "设置导航位置按账户恢复；工作区 Dock 的开合和栏宽遵循既有 General 与 DockKit 偏好。会话、项目、设置分类不能由导航组件自行保存为另一份业务数据。",
    responsive: "由 ResizableWorkbench 与调用页面容器共同决定侧栏是占栏、收起还是 Overlay。侧栏内容需要独立滚动，Overlay 选择后应回到可见正文。",
    records: ["设置分类和窄容器行为见 packages/client/ui-settings/README.md 与对应 PROMPTS 合同。", "共享工作区左侧会话 Dock 和最近会话跳转见 #141–#143。", "应用导航右移仍须核对 #144 状态，历史布局不能直接当作当前验收证据。"],
    files: ["packages/client/ui-sidebar/src/SecondaryNavigation.tsx", "packages/client/ui-settings/src/SettingsPage.tsx", "packages/client/ui-workspace/src/ApplicationWorkspace.tsx", "packages/client/ui-dockkit/src/ResizableWorkbench.tsx"],
    verification: "验证活动项、分组折叠、搜索定位、键盘移动与选择后的滚动位置。窄容器下要确认侧栏和正文都能访问，不发生菜单遮挡正文。"
  },
  {
    id: "center-workspace",
    shortTitle: "中间 · 工作区",
    eyebrow: "主要任务发生的位置",
    title: "中间区域由当前工作区的 Owner 提供",
    summary: "中间区域不是固定的一张页面。它可以是 AI Work 聊天、游戏或写作 App、文件管理、插件管理或设置分类；Workbench 只负责根据当前路由装配相应 UI。",
    problem: "如果把业务逻辑放进工作台外框，应用切换、数据加载和权限就会重复实现；如果把 Agent 专属流程复制进普通 App，也会形成两套工作流。",
    owner: "路由及共享装配归 packages/client/ui-layout/src/Workbench.tsx；普通应用与 AI Work 的工作区 UI 归 packages/client/ui-workspace；具体业务 API、数据和权限仍归各领域 Owner。",
    implementation: [
      { label: "普通 App", detail: "用户通过应用工作区手动操作并管理成果；各 App 向自己的领域服务请求数据。应用清单由 Workbench 装配，不在侧栏复制业务规则。" },
      { label: "/work 小鱼智能体", detail: "接收 Workbench 投递的 AiWorkGoalRequest 并交给 AiWorkChat；Agent Loop 根据目标和当前已登记的能力继续执行，界面展示真实结果、审批或澄清。" },
      { label: "项目画布", detail: "AI 漫剧等复杂工作区使用项目 Owner 的认证保存接口；组件状态只是当前交互，不替代服务端项目文件。" },
      { label: "页面切换", detail: "Workbench 保持全局布局与导航意图；业务区卸载时由功能 Owner 撤销请求、事件或资源。" }
    ],
    settingsAndData: "AI Provider、模型、权限模式、通知和外观从设置中心的权威配置进入工作台；项目、会话和媒体内容各由领域 Owner 保存。界面不得以浏览器本地临时状态冒充已保存结果。",
    responsive: "工作区依赖父级可用容器宽度而非全局 viewport；打开左右 Dock 时调整内部布局，窄栏下收起一侧或使用 Overlay。具体项目画布还需测短屏滚动和操作控件可达性。",
    records: ["#130 记录共享工作区布局基线。", "小鱼智能体入口与调用链见 docs/development/xiaoyu-agent-20261015.md。", "普通 App 与 Agent 的边界见 packages/client/ui-workspace/README.md。"],
    files: ["packages/client/ui-layout/src/Workbench.tsx", "packages/client/ui-workspace/src/ApplicationWorkspace.tsx", "packages/client/ui-workspace/README.md", "docs/系统总体架构.md"],
    verification: "分别核对普通 App 与 /work；检查空状态、加载/错误、真实 API 结果、离开页面时取消工作，以及中心区在不同 Dock 组合下的实际宽度。"
  },
  {
    id: "right-dock",
    shortTitle: "右侧 · 工具与应用",
    eyebrow: "随工作区变化的上下文区域",
    title: "右侧 Dock 放当前上下文需要的内容",
    summary: "右栏由统一 Dock 容器承载工具/资源或应用菜单等视图。它解决的是让主画布保留专注空间，同时让上下文操作随时可回到同一个工作区。",
    problem: "把应用菜单、工具信息和当前工作页面混在一起会压缩主内容；每个 App 自建右栏又会造成宽度、开合和窄屏行为不一致。",
    owner: "栏位尺寸、拖动、收起与覆盖层归 packages/client/ui-dockkit/src/ResizableWorkbench.tsx。右侧视图及由 Workbench 提供的 applicationNavigationItems 由工作区装配与对应导航组件展示。",
    implementation: [
      { label: "工具与资源", detail: "呈现当前工作区可用的上下文工具或资源。工具是否可执行、如何授权由工具/Permission Owner 决定，UI 不伪造可用能力。" },
      { label: "应用视图", detail: "显示 Workbench 注入的应用导航项；点击后复用已有路由或 App 打开回调。Minecraft、联机服务和写作入口仍走原领域工作区。" },
      { label: "侧栏组合", detail: "打开两侧栏时先满足中心区的布局要求；空间不足时根据现有布局合同收起或覆盖其中一栏。" },
      { label: "当前迁移状态", detail: "应用导航迁入右 Dock 的实现记录在任务合同 #144。是否已完成最终验收，应以该合同本轮的状态和证据为准。" }
    ],
    settingsAndData: "用户原有导航布局、Dock 开合与尺寸设置仍由 General/DockKit Owner 读取和保存；本手册不增加或重置这些偏好。应用条目仍只决定导航可见性与打开目标。",
    responsive: "Dock 必须按实际工作区容器宽度处理；窄容器转换为适合的收起/Overlay 状态，短屏内容可滚动，浮层定位在当前工作区而非整个浏览器外框。",
    records: ["四栏组合与边界宽度见 #130。", "应用导航右 Dock 的目标和未完成事项见 #144。", "不要把静态渲染图、构建结果或目标描述当成内置浏览器实页验收。"],
    files: ["packages/client/ui-dockkit/src/ResizableWorkbench.tsx", "packages/client/ui-workspace/src/ApplicationWorkspace.tsx", "packages/client/ui-workspace/src/module-workbench.css", "packages/client/ui-workspace/README.md", "docs/PROMPTS.md"],
    verification: "检查 Dock 开合、视图切换、条目跳转、栏宽拖动、短屏滚动和左右栏组合。正式 UI 变更还需当前源码工作区启动 Web 服务，并用内置浏览器检查实际路由与桌面/窄视口。"
  },
  {
    id: "settings-center",
    shortTitle: "设置中心",
    eyebrow: "配置、外观与更新入口",
    title: "设置中心怎样管理产品偏好",
    summary: "SettingsPage 把账户设置分组、数据表单、自动保存和共享外观接到现有 Settings API 与领域 Owner。手册入口本身放在“关于与更新”里，不新增可开关的账户偏好。",
    problem: "设置散落在各业务页会让默认值、校验、持久化和主题映射各写一份；更新、运行状态和帮助资料也难以被统一找到。",
    owner: "设置界面和分类导航由 packages/client/ui-settings/src/SettingsPage.tsx 持有；工作台把当前账户设置、服务状态与操作回调注入设置页；服务端校验和持久化归设置 API/Settings Owner。",
    implementation: [
      { label: "分类切换", detail: "section 由 SettingsPage 管理；SecondaryNavigation 负责呈现分类。只在进入需要远端数据的分类时加载相应数据，避免初次打开设置就并发读取所有模块。" },
      { label: "设置保存", detail: "账户设置使用既有 Settings API、字段合同和分类 schema；自动保存失败回退到最近服务端确认值并在原分类显示错误。" },
      { label: "外观", detail: "主题、字体、字号、强调色、壁纸、遮罩、模糊、对比度和减少动态效果通过 Appearance 共享令牌进入 UI；新页面不另建视觉设置。" },
      { label: "关于与更新", detail: "显示真实构建/桌面版本和平台支持的更新状态；本手册入口以页内导航打开阅读视图，返回后仍在关于与更新。" },
      { label: "手册数据", detail: "正文由 developer-handbook-content.ts 的结构化章节提供；不发 API 请求，不写入 Local Storage，也不改动用户设置。" }
    ],
    settingsAndData: "界面读取现有 appearance.*、general.* 与 Dock 偏好；手册浏览不保存一个‘显示/隐藏手册’开关。更新自动下载偏好仍由现有桌面更新器合同控制。",
    responsive: "设置页和手册使用 settings-main 的实际容器宽度断点。手册目录在窄栏改为横向可换行导航，正文卡片收为单列；页面仍在设置正文滚动容器内，不另开固定全屏浮层。",
    records: ["Appearance 与设置 Owner 的完整字段、默认值和持久化见 packages/client/ui-settings/README.md、packages/settings/settings/README.md 及 docs/系统总体架构.md。", "本手册入口合同见本轮 #146。", "更新功能的真实平台边界以当前实现及版本更新合同为准。"],
    files: ["packages/client/ui-settings/src/SettingsPage.tsx", "packages/client/ui-settings/src/SettingsPage.css", "packages/client/ui-settings/src/DeveloperHandbook.tsx", "packages/client/ui-settings/src/developer-handbook-content.ts", "packages/client/connection/src/api.ts"],
    verification: "从设置中心左一入口进入“关于与更新”，打开手册、切换目录并返回；确认原分类仍可用、主题随账户外观、桌面/窄栏均不溢出，且进入手册没有触发设置写入或额外网络读取。"
  },
  {
    id: "business-areas",
    shortTitle: "文件、插件与业务页",
    eyebrow: "领域 UI 与共享外框",
    title: "业务页面如何接入统一工作台",
    summary: "文件管理、插件管理、游戏、写作和媒体页面可以复用工作台外框与通用导航，但各自的业务行为必须留在所属领域 Owner。",
    problem: "共享 UI 容器很容易被误用成业务层：如果容器直接保存作品、安装插件或启动游戏，就会同时复制领域规则、权限和错误处理。",
    owner: "全局导航和 Dock 属于客户端共享 UI；文件路径与操作归文件服务/文件领域；插件 Profile 生命周期归 Plugin Manager；Writing 与游戏数据/任务归各业务 Owner。先从功能入口追到 API、Owner 和运行端，再写界面。",
    implementation: [
      { label: "文件管理", detail: "展示当前账户与访问范围内的文件入口；读取、选择和写操作必须走文件服务的授权及路径合同。" },
      { label: "插件与集成", detail: "显示真实登记的扩展、MCP 配置和连接状态；安装、启停与授权仍走对应 Profile/Permission Owner。未接入的市场明确展示状态，不填充示例能力。" },
      { label: "写作与媒体", detail: "作品正文、项目媒体和生成任务通过各自认证 API 保存与刷新；UI 局部状态不替代持久化业务 Owner。" },
      { label: "游戏与节点", detail: "安装、实例、运行环境和 Daemon 操作由对应领域/节点 Owner 执行；控制端 UI 展示实际任务结果。" }
    ],
    settingsAndData: "只读取相关的现有设置、权限模式和用户偏好；任何新控制项先接入设置中心并完成服务端校验/持久化，再由业务页消费。业务数据、系统数据和远端节点数据保持原有归属。",
    responsive: "应用工作区在有限宽度下共享 DockKit 布局；业务表单、列表和浮层仍要按自己的内容与容器检查换行、内部滚动和短屏操作可达性。",
    records: ["包边界和装配状态见 docs/development/package-responsibilities.zh.md 与 docs/harness-packages.md。", "文件、插件、Writing、媒体和游戏专题见本手册功能地图及对应 PROMPTS 合同。"],
    files: ["packages/client/ui-sidebar-files/README.md", "packages/client/ui-plugin-manager/README.md", "packages/client/ui-workspace/README.md", "docs/development/package-responsibilities.zh.md", "docs/harness-packages.md"],
    verification: "每个领域至少核对一条真实读取或操作链、权限/校验失败状态、空/加载/错误状态与容器边界；不能用占位数据或单纯 UI 构建声称业务已实测。"
  },
  {
    id: "development-process",
    shortTitle: "怎么开发与验收",
    eyebrow: "从问题到证据",
    title: "让一次 UI 改动能被后来的人复盘",
    summary: "每次改动要留下用户问题、真实入口、Owner、配置与数据合同、实现位置和实际验证证据。源码、构建、浏览器、桌面和真实服务属于不同层次的证据。",
    problem: "只有一份‘功能已完成’的概述，后来的人仍然不知道入口在哪、状态由谁保存、限制是什么、原来解决了什么问题。",
    owner: "开发流程按仓库根开发规范、包职责规范、实际 Owner README 和 docs/PROMPTS.md 任务合同执行；持续有效的架构事实同步架构文档，任务历史保留在任务合同。",
    implementation: [
      { label: "先登记", detail: "每项新功能、修复或架构调整都先在 docs/PROMPTS.md 建立编号、目标、Owner、修改边界和验收合同；小任务可用精简合同。" },
      { label: "用自然语言描述目标", detail: "告诉 AI 你遇到的问题、当前实际行为、期望结果、入口和必须保留的行为。技术细节不知道时可以留空，AI 应从当前代码与文档核实。" },
      { label: "再找 Owner", detail: "沿真实调用链读入口、公开合同、数据和权限 Owner、消费者；避免在 UI 或 App Bundle 复制领域规则。" },
      { label: "按批实现", detail: "复用已有设置和外观令牌；按容器宽高设计布局，及时检查读取是否串行、有界，交互资源在卸载时是否撤销。" },
      { label: "逐层验收", detail: "记录静态/类型、直接相关回归、构建、当前源码 Web 页面、桌面或设备、真实 Provider/Daemon 各自结果与未测边界。不要把一种证据写成另一种。" },
      { label: "完成后写回", detail: "在同一合同逐文件记录职责、如何解决原问题、实际验证命令/路由/视口/交互/截图及未测项；只在长期事实变化时同步架构、包 README 或计划。" }
    ],
    promptExample: `请在当前 LFAA 项目中完成这项修改，并遵循仓库 AGENTS.md、开发规范.md、docs/系统总体架构.md 和相关包 README。

我遇到的问题/想实现的目标：[用自己的话描述]
现在我是这样操作的：[页面、入口、操作步骤；不知道可留空]
现在实际发生：[错误、缺少的能力或目前行为]
希望改完后：[用户能做什么、界面/结果应是什么]
适用范围：[页面、账户/项目/节点、桌面/手机等；不知道可留空]
必须保留：[已有行为、设置、数据或权限边界；没有可写“请先核实”]
我认为的验收方式：[具体操作和预期结果；需要的视口可写宽×高]

请先检查当前工作树、相关任务合同和源码，沿调用链确认唯一 Owner，并盘点有关设置、默认值、持久化、数据与权限归属；不要让我重复提供代码里能查到的信息。开始实现前在 docs/PROMPTS.md 登记任务合同、允许/禁止范围和验收条件。若存在会改变数据归属、安全或用户行为的关键歧义，再简短询问；其余部分继续推进。只做必要修改。

完成后，在同一任务合同记录：每个改动文件的职责、具体解决了什么问题、实际执行的验证命令及结果、真实页面/视口/交互和截图证据、失败项及未测边界。稳定架构或包职责变化时同步对应权威文档。不要把未运行的检查写成通过，也不要提交或发布。`,
    settingsAndData: "所有配置从权威设置合同读取；权限继续统一经过 Permission Owner。新增界面需消费共享 Appearance 令牌，不在组件里另造主题开关。",
    responsive: "验证使用真实路由与当前源码服务。至少覆盖常用桌面宽度和一处相关窄栏/短屏，并记录容器宽高、关键交互、截图证据和未测设备。",
    records: ["可复制的提示词、任务记录字段和维护边界：docs/development/handbook.zh.md 的“怎么开发与验收”。", "每项新功能/修复的逐轮合同与实施证据：docs/PROMPTS.md。", "本轮把记录流程固化到规范和项目内手册，见合同 #147；手册 UI 入口见合同 #146。"],
    files: ["开发规范.md", "docs/development/guide.zh.md", "docs/development/handbook.zh.md", "docs/PROMPTS.md", "packages/client/ui-settings/src/developer-handbook-content.ts"],
    verification: "交付只列实际运行过的命令和实页结果。UI 页面没有在当前源码服务与 ChatGPT 内置浏览器检查时，应明确标为未实测，并记录阻碍原因。"
  }
] as const;
