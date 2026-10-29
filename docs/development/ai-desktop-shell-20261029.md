# LFAA AI 应用工作台（2026-10-29）

<a id="lfaa-ai-desktop-shell-20261029"></a>

## 用户目标

LFAA 是由统一 AI 核心驱动的应用工作台。用户认证后直接进入“小鱼智能体”的聊天与代码开发工作区；从全局应用入口切换到 AI 视频、AI 写作、Minecraft 开服、Steam 游戏部署等独立应用。应用通过共享 Agent 能力协作，但保留自己的工作区、数据和功能菜单，并通过内部应用市场发现、安装、更新和移除。

2026-10-29 最新决定：不采用独立桌面启动页作为默认入口。此前实现的 `/desktop` 启动页和“AI 虚拟桌面”概念已被用户明确撤回；`/desktop` 只保留为兼容地址并归一到 `/work`。系统操作感来自清晰的全局导航与应用内聚焦工作区，不要求模拟 Windows/macOS 桌面画布。

## 当前入口与真实差距

- Windows Electron 主进程创建一个 BrowserWindow 并加载共享前端；当前应用以单窗口聚焦工作区和现有路由切换。
- Web 客户端入口静态导入并逐个装配一组 UI 包；Workbench 维护应用卡片、导航入口和路由装配。ApplicationId 由源码清单定义。
- 插件管理页负责检查和管理 Profile 插件来源与生命周期；它不是用户面向的应用目录/桌面启动器。
- 现有 UI 采用共享 Appearance 令牌与分包 Owner；保留这些主题、权限、数据、Session、Agent Loop 和领域服务合同。
- 延续 LFAA 当前 Appearance 令牌和主题；此任务不添加桌面启动页或模拟操作系统的视觉外壳。

## 系统架构合同

- 共享 AI 核心继续使用唯一模型、Agent Loop、Session、Tools/Skills/Experts/MCP、Subagent 和 Permission Owner。应用可请求同一核心执行领域任务；上下文、预算和权限仍由现有 Owner 校验。
- 系统全局导航拥有应用切换入口；每个应用进入一个聚焦工作区，应用内部菜单只展示当前应用的功能。继续复用 Electron 单窗口宿主和现有路由，不新增桌面画布或多窗口状态。
- 普通应用左二菜单严格按当前 `ApplicationId` 装配，只列出该 App 的功能模块；跨 App 切换由导航轨的全局应用弹层负责。聚合工作区只在聚合入口保留跨领域子入口，不能渗入 Minecraft、Steam 等具体 App 的功能菜单。
- `/work` 是认证后的默认入口；根地址 `/`、旧地址 `/desktop` 和 `/tasks` 均归一到 `/work`。`/work` 复用既有通用 Agent、会话和项目能力。
- 每个可安装应用以独立插件包登记应用 ID、用户可见元信息、版本、运行兼容性和公开入口。应用声明所需系统能力，并只通过公开系统 API/SDK 调用 AI 核心和共享 Owner。应用之间不直接导入彼此业务实现。
- 内部应用市场提供可用应用目录和安装/更新/移除入口。复用既有 Plugin Manager/插件生命周期 Owner，不在 UI 或 Marketplace 中复制校验、安装、更新、权限或数据清理规则。
- 可安装应用插件 ID 与当前 ApplicationId 的权限/会话/数据作用域语义保持区分。现有稳定 ID、用户偏好、账户数据和领域数据不因新注册表迁移或重置。
- 当前 `/work` 作为共享 AI 核心的聊天与代码开发工作区；认证后直接进入，不再显示桌面启动页或首次进入向导。应用切换和每个应用自己的模块导航继续可用。

## 分批范围

### 批次 A：入口与导航收敛

- 认证后直接呈现 `/work`，根地址和兼容桌面地址归一到该路由。
- 小鱼工作区只显示一份全局入口，移除重复的桌面和工作入口；保留现有应用切换能力。
- 保留 LFAA 现有基础样式、主题、会话与用户偏好，不创建桌面专属设置。

### 批次 B：应用边界与共享核心

- 小鱼工作区继续复用唯一 Agent、Session、项目、Tools/Skills/MCP、Subagent 和 Permission Owner。
- 应用切换使用现有 Workbench 应用清单和受保护路由；不重复实现应用启动或权限生命周期。
- 每个应用的左二菜单只展示当前 App 的功能模块；Minecraft、Steam 等专用菜单不能混入其他应用功能。

### 批次 C：市场与首个领域应用迁移

- 市场列出真实兼容、可安装和已安装应用状态；安装、更新、移除动作由既有插件生命周期 Owner 回读真实结果。
- 选一个现有领域应用完成端到端插件加载、共享 AI 调用、独立数据 Owner 和安装/卸载生命周期；再按同一合同迁移其余应用。
- 首个迁移不改变账户、会话、权限、ApplicationId 或现有业务数据；失败时保留可恢复状态。

## 设置、数据与权限

- 延续 Settings Owner 的 Appearance、Reduced Motion 及已有系统设置；工作区消费共享主题令牌，不新增桌面外观设置。
- 不新增独立权限模式；所有 Agent、工具和操作继续使用唯一 Permission Owner 与当前 permissions.mode。
- 应用运行数据仍归现有领域 Owner；不修改账户偏好、会话或用户文件。
- 应用目录元数据不等同于 App 权限范围；选中或安装应用不能扩大账户、项目、文件、工具或节点授权。

## 验收条件

- 认证后根地址和登录默认路由进入 `/work`；直接访问 `/desktop` 与 `/tasks` 也进入相同的小鱼聊天/代码工作区。
- `/work` 不显示桌面启动页或首次进入向导；全局小鱼入口不重复，应用切换器仍能进入 Minecraft、Steam、写作、视频等真实应用路由。
- 通用 AI 对话/代码开发仍由原 Agent 核心执行；至少一个领域应用能以自己的 App/项目上下文调用同一核心，且不创建第二套模型、Session 或权限 Owner。
- 新增兼容应用只需发布并安装符合合同的应用插件，不修改桌面清单、Workbench 页面分支或通用 AI 核心。
- 应用安装、启动、更新或移除显示插件/应用 Owner 返回的真实状态；不支持或不兼容时如实展示。
- 既有 App ID、路由深链、账户偏好与领域数据仍可用；宽屏与窄屏工作区不横向溢出，并响应当前主题与减少动态效果。
- 界面按独立批次做直接回归和构建，再在当前 LFAA 正式 Web/内置浏览器与 Windows Electron 实页验收；代码、构建、Web 和原生桌面证据分开记录，无法实测的边界保持未验。

## 最新决定实施与验收（2026-10-29）

- 已移除桌面首页分支与首次进入向导；根地址和登录后的默认入口进入 `/work`，旧 `/desktop`、`/tasks` 归一到同一工作区。
- 全局图标轨由所有页面共用：小鱼智能体、应用、最近会话、设置和更多功能位置固定；移除按页面变化的显示器模式主页与重复 AI 工作快捷入口。
- 左二菜单继续显示当前应用自己的功能模块，但沿用 ApplicationWorkspace 的工作区布局与共享菜单样式；设置分类和 AI Work 应用目录复用 SecondaryNavigation。应用路由和业务 Owner 不混用。
- `pnpm run build:web`、`pnpm run build:control-plane` 与 `git diff --check` 通过；经用户先前授权，通过 LFAA CLI 重启 Web 与本机 Daemon。`node scripts/runtime-build-state.mjs web` 返回 `[]`，`/api/health` 返回 `status=ok`、`persistence=ready`。
- 内置浏览器确认根地址和 `/desktop` 均进入 `/work`；当前轮又在 `/games` 与 `/games/minecraft/instances` 实页确认全局入口相同、游戏/Minecraft 左二菜单只显示各自模块。保留原工作区用户数据与布局；没有提交消息或启动领域应用。
- 之前记录的 1440×900 和 390×844 AI Work 布局观察仍适用；本轮未重复测窄屏。没有运行测试套件；Windows Electron 实页与应用启动后的领域流程未验。
- 未运行测试套件；Windows Electron 实页与应用启动后的领域流程未验。

## 历史实施记录（桌面方向已由用户撤回）

- 已核对根 AGENTS.md、开发规范、系统总体架构、包职责文档、Workbench/Client 装配、插件管理器和 Electron 入口。
- 用户选择 AI-Native Desktop Hub，并确认沿用 LFAA 现有基础样式；采用系统桌面入口 + 应用内精准切换，每个应用仍使用单窗口中的聚焦工作区。
- 已加入 `/desktop` 登录后默认入口、主题感知的桌面启动器、现有 AI Goal 输入桥接、系统桌面入口和应用切换菜单；Minecraft 与 Steam 从现有游戏聚合入口分开展示。
- 已将普通应用左二从全局应用目录收敛为当前 App 功能菜单；全局应用弹层承接切换，AI Work 右侧应用目录保留。Minecraft 菜单不再混入 Steam、联机管理、写作、AI 漫剧或系统画布；游戏服务聚合页、Steam 工作区和 AI Work 目录分别实页核对。
- 本次调整的 `pnpm run build:web` 与 `git diff --check` 通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`，`/api/health` 返回 `status=ok`、`persistence=ready`。正式 Web 只读核对了 Minecraft 实例、Steam 工作区、游戏服务聚合页和 AI Work 应用目录，没有操作 Minecraft 实例。
- 桌面应用列表暂时读取现有应用导航合同；运行时应用注册、用户应用市场、安装/卸载生命周期及领域插件迁移尚未实现，仍属后续批次。
- `pnpm run build:control-plane`、`pnpm run build:web`、`git diff --check` 均通过；最终 `node scripts/runtime-build-state.mjs web` 返回 `[]`。未运行测试套件。
- 经用户授权，通过 LFAA CLI 启动流程重启了现有 Web；启动日志确认 Web 与本机 Windows Daemon 已就绪，`GET /api/health` 返回 `status=ok`、`persistence=ready`。
- 已在用户现有 Edge 登录环境中打开实际 `/desktop` 页面，宽屏与 390×844 窄屏均已查看。应用切换菜单包含桌面、AI 工作、领域应用、Minecraft、Steam 和插件管理；窄屏下 5 个顶部导航项均在视口内且没有横向溢出。AI 输入只做本地填写/清空，没有发送任务；没有点击会改写所选应用偏好的启动项。
- 本轮桌面视觉优化保留既有导航、深色主题和应用入口行为；移除应用区与页脚之间的弹性空白，扩展应用启动器宽度并提高卡片、图标和说明文字的辨识度；390×844 两列布局的奇数末项居中。只消费既有 Appearance 字体、颜色、透明度、模糊及 Reduced Motion 设置映射，没有新增设置或更改账户偏好。
- 本轮 `pnpm run build:web` 与 `git diff --check` 通过；通过 LFAA CLI 重启 Web 后，`node scripts/runtime-build-state.mjs web` 为 `[]`，`/api/health` 为 `status=ok`、`persistence=ready`。ChatGPT 内置浏览器 `/desktop` 在默认桌面视口和 390×844 窄屏实测：7 张启动卡可纵向滚动到页脚，窄屏末卡居中且无横向溢出。未启动应用、发送 AI 任务或更改设置；未运行测试套件。
- Windows Electron 实页和应用启动后的领域流程尚未验收；概念图仍只作方向参考，不作为产品截图证据。
