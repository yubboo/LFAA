# Minecraft 实例与实例文件双向往返

<a id="lfaa-minecraft-instance-files-roundtrip-20261030"></a>

## 用户目标与可观察结果

- 从 Minecraft 实例列表或概览打开该实例文件后，文件页提供醒目的“返回实例”，并回到同一个实例的概览。
- 返回实例后，原有“打开实例文件”入口仍可用；再次进入后仍定位到同一实例实际目录，形成可连续往返的操作路径。
- 从左侧全局文件入口直接进入的通用文件页不显示虚假的实例返回入口；在已打开实例文件内浏览子目录时，返回入口保持可用。

## 运行入口、Owner 与边界

- 运行入口是 Web/Desktop 共用 Client；来源为 `packages/client/ui-minecraft` 的 Minecraft 实例卡片/概览，目标为 `packages/client/ui-sidebar-files` 的 `/files`。
- `packages/client/ui-minecraft` 是来源实例及其详情路由 Owner。它传递稳定实例 ID 对应的文件资源位置和该 ID 的实例概览路由。
- `packages/client/connection/src/file-manager-location.ts` 是账户限定的一次性页面间导航元数据 Owner；只保存待定位资源位置和可选站内返回路由，不授予文件访问权。
- `packages/client/ui-sidebar-files` 消费返回路由并呈现入口；实际文件目录仍由 `packages/api/workspace-files` 的 `gameInstanceFileMount` 按已登记实例、节点和设置解析，Client 不推导物理目录。
- 认证与文件权限继续由当前账户和 Permission Owner 执行。本功能不改变设置、文件内容、实例状态或节点数据，不启动/停止实例。

## 设置中心配置盘点

- 文件读取继续使用 `permissions.mode` 及现有角色门禁；外观继续使用共享 Appearance 令牌，服务状态继续受 `general.showServiceStatus` 控制。
- 不新增或重置设置字段，不改变已保存的布局和外观偏好。

## 验收条件

- 静态回归覆盖来源实例路由与资源位置均使用同一稳定 ID、文件页只对带实例来源的入口展示返回按钮、导航元数据按账户校验并一次性消费。
- 直接相关的 Client 类型检查和文件管理/Minecraft 构建通过。
- 使用用户指定的正式 `admin` 登录态，在 ChatGPT 内置浏览器从真实 Minecraft 实例进入 `/files`，确认准确实例目录；点击“返回实例”后确认同一实例；再点击“打开实例文件”确认可再次到达相同目录。
- 实际检查常用桌面与相关窄分栏视口中的返回入口可达；不写入真实文件、实例或账户偏好。
- 构建和静态检查不能替代真实路由/目录验收。未完成的设备或帧时间测量须单列。

## 实施记录

- `packages/client/ui-minecraft` 在实例列表卡片和具体实例概览提供“打开实例文件”，并在进入文件页时复用同一稳定实例 ID 生成概览返回路由；`packages/client/connection` 将此相对站内路由与文件位置一并按账户写入并校验；`packages/client/ui-sidebar-files` 在文件页标题操作区提供“返回实例”，进入该文件页的上下文只对来源账户有效。返回仍走既有 `onNavigate`，打开文件仍走 `gameInstanceFileMount`。
- 更新 Connection、Minecraft、Files 包 README 与本合同，记录同一流程与唯一 Owner；没有新增设置、API、权限或实例数据规则。
- 静态回归 `client-file-manager-responsive`、`client-minecraft-instance-file-entry`、`client-minecraft-instance-files-roundtrip` 共 7/7 通过；Client 类型检查、Files 包构建与正式 Web 构建通过，Web/Host 构建指纹均为 `[]`。
- ChatGPT 内置浏览器使用真实 `admin` 登录态：实例 `1.21.1`（ID `45f694c3-fbf3-447c-a848-80c6a5c5724c`）点击“打开实例文件”进入 `/files`，位置显示 `DESKTOP-26FQTU7 · …\games\minecraft\1.21.1` 且读取 29 项；点击“返回实例”回到同一 ID，再次打开后仍到达相同路径。390×845 手机 viewport 下，文件区与表格分别为 `332/332px`、`316/316px`，无横向溢出；实例保持停止，没有启动/停止或文件写入。
- 实际桌面/手机浏览器往返已测；真实设备与帧时间未测。
