# Minecraft 实例文件直达与文件管理四栏工作台

<a id="lfaa-minecraft-instance-files-workbench-20261030"></a>

## 用户目标与可观察结果

- 用户指出 `/files` 的全局入口只进入通用资源总览；Minecraft 实例没有自己的文件管理入口，用户无法直接到该实例记录的实际目录。单页文件管理当前还把资源分类、目录树和文件列表放在独立布局里，切换手感与应用共享工作台不一致。
- Minecraft 实例列表的每个实例都提供“打开实例文件”，点击后 `/files` 直接定位到该实例在其已登记 Daemon 上的真实文件夹。实例版本号、显示名称和浏览器端拼接的路径均不能用作目录事实。
- `/files` 复用 `ResizableWorkbench` 的四个同级区域：左一全局导航、左二资源分类、中间文件操作区、右侧实际目录树。普通文件资源总览和从实例进入的目标位置都保留在同一文件管理 Owner。
- 中间区保留共享四槽标题栏：左侧折叠入口、当前页面标题、中间模式槽和右侧状态/工具；`/files` 与 App 工作区都通过 `ui-primitives/WorkbenchHeader` 使用同一结构与外观。
- 已有文件查询/操作、错误反馈、权限门禁、文件传输、审计、预览和对话框合同保持；窄分栏、窄屏和短屏下内容不重叠，表格可在自身范围滚动，目录树和文件区有界滚动，关键控件保持键盘可达。

## 运行入口、Owner 与边界

- 游戏入口由 `packages/client/ui-minecraft` 的 Minecraft 工作区提供，主要用户路径是 `/games/minecraft/instances` 中实例卡片到 `/files`。`packages/client/ui-sidebar-files` 独占 `/files` 页面与文件管理交互；`packages/client/ui-dockkit` 的 `ResizableWorkbench` 负责栏位尺寸、分隔器与 Dock/overlay；全局图标入口仍由共享导航装配。
- 一次性位置合同由 `packages/client/connection/src/file-manager-location.ts` 按当前用户保存和消费。入口传稳定资源 ID `.lfaa-library/game-instances/<instanceId>`，然后导航 `/files`。
- `packages/api/workspace-files` 注册的 `gameInstanceFileMount` 根据 Minecraft 领域服务中的实例 ID 和目标节点存储设置，将受管操作映射到真实实例目录；远端实际 I/O 由对应 Daemon 执行。UI 不推测 `.lfaa/data/games/minecraft/<version>`，不访问本地文件系统，也不接受浏览器构造的绝对路径。
- 文件服务现有认证、`assertSystemFileAccess`、角色、设置权限和挂载能力检查保持不变。直接打开入口只选择路径，不启动实例、不改变权限、不执行写操作；运行状态下可写能力仍由文件服务真实返回的操作集合决定。
- 本轮只改入口与界面装配，不复制文件业务规则、不新增 API/Daemon 协议、不改变数据库或 Minecraft 实例记录，不删除或覆盖工作树中的其他 Minecraft 在研修改。

## 设置中心配置盘点

- 权威默认值、校验与账户持久化仍由 `packages/util/values/src/settings-contract.ts` 和 Settings Owner 管理。权限模式默认 `ask`，已保存的 `ask`、`approve_remembered` 或 `full_access` 均保持；原有文件服务门禁不因入口直达而绕过。
- 全局导航继续消费当前用户的 `general.navigationLayout`（默认 `three-column`）、`general.hiddenApplicationNavigationIds`（默认空数组）、`general.showServiceStatus`（默认 `true`）及现有导航回调。
- 外观继续由 Workbench/Appearance 共享映射提供：主题 `system`、强调色 `#3457d5`、侧栏色 `auto`、界面/代码字号 `14/12`、字体 `system`、对比度 `60`、壁纸默认 `none`、遮罩透明度 `65`、模糊 `14px`、减少动态效果 `system`；外观配置继续通过设置服务保存到当前用户设置。文件页不写固定色板、不覆盖壁纸、字体或动效偏好。
- DockKit 分栏宽度和收起状态沿用该 Owner 的 `storageKey` 本地布局持久化；它不是设置中心新配置项。本轮不新增或重置设置字段。

## UI 技能与布局判断

- 已按仓库硬规则读取 Taste app-screen、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI。用户选择的 Impeccable 主目标为文件管理；保留现有 LFAA 文件管理视觉与 Appearance 令牌，不另造主题。
- UI/UX Pro Max 的 `ux` 定向检索指出需要避免窄屏横向溢出、固定导航遮挡内容并保持完整键盘操作；实现按 DockKit 实际容器宽度确定分栏/浮层行为。
- Audit Skills 仅覆盖 Java/.NET/PHP，不把它报告为 TypeScript/React/CSS 专项安全扫描。无新增动效；沿用当前减少动态效果映射。
- 结构映射：`leading` 为全局导航，`left` 仅放资源分类，`center` 放共享四槽标题栏、资源信息、面包屑、工具栏、表格和页脚，`right` 仅放物理目录树。分隔器继续可键盘调整；弹窗挂到工作台根容器，避免被窄栏裁切。

## 分批计划与验收

### 批次 1：实例卡片直达

- 仅传实例 ID 到既有一次性文件位置合同，加入实例卡片入口。更新相邻 UI 回归并运行受影响包构建、Client 类型检查和 Web 构建。
- 内置浏览器从 Minecraft 实例路由检查入口实际显示及导航；若当前账户没有可安全浏览的已登记实例，明确标记真实实例目录读取未实测，不用伪造实例完成验收。

### 批次 2：文件页四栏装配

- 将 Files 页装配到 shared DockKit workbench，资源分类与实体目录树拆成独立 sibling panes，调整现有样式和布局回归，更新 `ui-sidebar-files` 包 README。
- 运行 Files/DockKit 直接相关回归、包构建、Client 类型检查和当前源码 Web 构建；紧接着在 ChatGPT 内置浏览器检查 `/files` 的桌面、窄分栏/短屏和移动视口，并检查目录/资源导航、表格滚动、关键操作和弹窗可达性。
- 每批记录源码、构建和内置浏览器证据；未实测的真实节点/实例、物理设备和帧时间明确列出。构建产物只写仓库根 `dist/`。

### 批次 3：四栏共享标题栏

- 将 `ApplicationWorkspace` 中间区的标题栏抽到 `ui-primitives/WorkbenchHeader`，由 App 工作区与 `/files` 共同消费；`/files` 左侧控件折叠资源分类栏，右侧控件折叠真实目录树，中间栏和现有业务工具保持自身 Owner。
- 继续从现有 `general.showServiceStatus` 与 Appearance 令牌读取显示；不新增设置，不改变认证/权限、节点文件或用户布局偏好。
- 对该批运行直接相关 UI 回归、受影响包构建、Client 类型检查和 Web 构建；正式 Web 在构建指纹匹配并由用户重启后，以 ChatGPT 内置浏览器检查 `/files` 常用桌面、窄分栏与移动短屏视口及两个开合入口。

### 批次 4：移动侧栏可达性

- 在资源分类栏和物理目录树浮层内提供关闭入口；移动视口确保左右浮层互斥，防止两边同时展开互相遮挡。
- 对直接相关布局回归、类型、文件管理包构建及 Web 构建后，继续在正式内置浏览器检查桌面、窄分栏/短屏和手机开合与恢复；结束时恢复用户布局和默认视口。

## 实施记录

### 批次 1：实例卡片直达

- `MinecraftWorkspace` 在实例卡片和当前实例概览各加入“打开实例文件”，只将账户限定的 `.lfaa-library/game-instances/<instanceId>` 写入既有一次性历史状态，再导航 `/files`。真实目录仍由 `gameInstanceFileMount` 查询实例与节点记录，不读取或推导版本号路径。
- 新增入口回归：断言两个按钮、稳定实例 ID 路径、目标路由和服务端挂载 Owner；最终 1/1 通过。`lfaa-client-ui-minecraft` 构建、Client 类型检查和完整 Web 构建通过；Web 转换 3910 个模块，`node scripts/runtime-build-state.mjs web` 返回 `[]`。构建仅写仓库根 `dist/`。
- ChatGPT 内置浏览器实际运行的是当前 checkout 的正式 CLI Web 服务，使用 `http://127.0.0.1:3001/games/minecraft/instances`、独立 `dist/.tmp/minecraft-instance-files-review/{data,home}` 和临时进程内 JWT secret；3000 的归属不明服务没有被重启或复用。`/api/health` 报告 `status=ok, persistence=ready`。
- 内置浏览器桌面视口为 `1280×720`，实际路由显示 Minecraft 实例列表页、全局导航、Minecraft 工作区菜单及真实空状态。隔离数据库没有已登记 Minecraft 实例，实例数据请求显示服务端内部错误，因此该页面无法渲染实例卡片，也不能通过真实卡片点击核对目标节点目录。截图在本轮内置浏览器验收输出中显示，未另存本地图片。批次源码/构建通过不冒充真实实例浏览验收。
- 浏览器登录仅进入本轮隔离数据目录中的默认管理员账户；提醒通过 Escape 临时收起，没有保存或修改权限、外观、数据目录或其他设置，也未调用 Minecraft 写操作。未测真实实例/Daemon、窄视口和帧时间。

### 批次 2：文件页四栏装配

- `/files` 已改为 DockKit `ResizableWorkbench` 四个同级区域：左一全局导航、左二资源分类、中间文件操作、右侧物理目录树。资源/目录按钮分别控制 DockKit 左右栏；页头、错误/空态、表格和页脚都留在中心区。目录树与分类栏各自有界滚动，表格继续在文件区内部横向滚动。
- 首次用管理员页面验收时发现实际布局重叠：DockKit 根保留默认 `--lfaa-leading-width: 0px`，而导航轨宽度只写在外层测量盒，导致左一未占 Grid 列、覆盖左二资源分类。已在 `.file-manager-workbench` 根按 `--module-rail-width` 明确预留左一列，并新增回归断言。测试筛选结果 6/6 通过，文件管理包构建通过，Web 构建通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`。Impeccable layout detector 返回 `[]`。
- 用户指定使用现有 `http://127.0.0.1:3000/files` 的 `admin / 123456` 页面后，内置浏览器确认真实资源分类与真实文件条目已加载；截图显示旧构建中的左一/左二重叠，这是本轮已修正的明确证据。构建后该服务显示“LFAA Web 或控制端构建文件在服务运行期间已更新”，未加载修正后的页面；当前不触碰该运行进程，修正后真实视口仍待该服务正常重启再验收。未修改账户权限、外观或文件数据，也未执行文件写操作。
- 设置读取无新增：权限仍按账户 `permissions.mode` 门禁，主题与字体/颜色等外观仍走共享令牌；新 Workbench 栏位状态由 DockKit 以 `lfaa.file-manager.workbench.v1:<userId>` 存入本机布局存储，不新增设置中心项目。未测本轮修正后的真实窄/手机视口、实例按钮点击到真实节点目录、设备帧时间。

### 批次 3：四栏共享标题栏

- `WorkbenchHeader` 由 `ui-primitives` 提供，`ApplicationWorkspace` 保留原有 App 模式组和状态/工具动作；`/files` 在中心区复用同一标题栏结构，左控件切换资源分类栏，右控件切换真实目录树，状态点继续受 `general.showServiceStatus` 控制。
- 文件页响应式回归 4/4、App 标题栏/四栏结构及实例入口筛选回归 4/4 通过；`tsc --noEmit -p tsconfig.client.json`、`ui-primitives`/`ui-sidebar-files`/`ui-workspace` 构建和 `pnpm.cmd run build:web` 通过。Web 构建转换 3912 个模块，最新 `node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过，Impeccable layout detector 返回 `[]`。所有产物位于根 `dist/`。
- 用户同意重启正式服务后，先通过 `pnpm.cmd run lfaa web` 核对并重启当前 checkout 的正式 Web；Control Plane 构建指纹缺失时按正式启动合同执行 `pnpm.cmd run build:control-plane` 后 Web 健康，`/api/health` 为 `status=ok, persistence=ready`，运行指纹为 `[]`。ChatGPT 内置浏览器的实际 `/files` 已显示共享标题栏和真实 `admin` 会话，没有隔离数据目录或隔离服务。
- `1280×720` 桌面展开全部栏：左一全局轨可见，左二资源栏 `x=64,width=200`，中心文件操作区 `x=265,width=771`，右侧目录树 `x=1037,width=243`；中心共享标题栏高 `48px`，栏间无覆盖。`820×520` 窄分栏/短屏仍保留这四个区域，中心宽 `311px`，标题栏高 `48px`；面包屑和工具栏在中心内折行，表格仅在自身容器内横向滚动。
- 已有真实 Minecraft 实例 `1.21.1` 的“打开实例文件”入口实点后进入 `/files`，服务返回位置 `DESKTOP-26FQTU7 · C:\Users\yu\.lfaa\data\games\minecraft/1.21.1`，并读取到 `cache`、`config`、`libraries`、`logs`、`plugins`、`world` 等实际条目。没有浏览器端拼接版本目录，也未启动实例或写入文件；真实账户中没有用该入口实测 `1.12.1` 版本。

### 批次 4：移动侧栏可达性与互斥

- 批次 3 首次手机实页检查发现：面板作为浮层打开后会遮住共享标题栏开关；两边同时打开时两个浮层互相覆盖。资源导航和目录树标题各加入自身关闭按钮；移动视口同一时刻仅显示一个侧栏浮层，初始/存储两边同时展开时折叠目录树。桌面仍可通过共享标题栏开合，也可在面板内关闭。
- 文件管理布局回归 4/4、Client 类型检查、`ui-sidebar-files` 构建、Web 构建和 `git diff --check` 通过；Web 转换 3912 个模块，`node scripts/runtime-build-state.mjs web` 为 `[]`。Impeccable layout detector 输出 `[]`。包与应用产物仅位于根 `dist/`。
- 最新正式 Web 重启后，内置浏览器在实际 `/files` 以 390×844 请求视口（页面 `innerHeight=845`）检查：桌面双侧栏缩到手机只保留资源导航浮层；关闭资源导航后可展开目录树，树浮层的关闭按钮可见，标题栏恢复，资源栏不会同时留在视口内。验收结束将两个 Dock 收回，并将临时视口重置为桌面。
- 没有改变设置中心权限、外观、导航或文件数据；仅进行用户已授权的真实目录读取与面板导航。真实设备、屏幕阅读器、帧时间及 `1.12.1` 实例未测。此前 `/files` 正式登录会话因一次浏览器导航连接错误被留在工具错误页，随后在同一内置浏览器中新标签恢复正式页面并完成上述验收；服务 API 与构建指纹均正常。
