# Minecraft 实例卡片操作聚合弹窗

<a id="lfaa-minecraft-instance-action-menu-20261031"></a>

## 用户目标与可观察结果

- 在实例列表卡片中，将“管理实例”“打开实例文件”“删除实例”三项收进单个“管理”按钮。
- 点击“管理”后，在当前 Minecraft 工作区弹窗内提供以上三个独立操作；生命周期按钮“启动”“安全停止”仍留在卡片。
- 管理实例继续导航到原实例概览，打开实例文件继续使用稳定实例 ID 的共享文件位置合同，删除继续走已有确认、节点归档与任务 Owner。
- 弹窗在桌面、窄容器和短视口下可读可操作，键盘可关闭与触发，删除入口保留原角色、节点和实例状态禁用条件。

## 入口、Owner 与数据

- 用户参考路由：`/games/minecraft/instances`；Minecraft Client 兼容入口为 `/apps/minecraft/normal/instances`。
- 唯一 UI Owner：`packages/client/ui-minecraft`，由 `MinecraftWorkspace.tsx` 管理所选卡片弹窗状态和现有导航/提交调用，`MinecraftWorkspace.css` 维护弹窗动作布局。
- 数据继续来自现有账户隔离的认证 Minecraft 实例快照。文件位置由共享 `setFileManagerLocation` 合同建立；实例归档删除由 `deleteMinecraftInstance` 与节点 Daemon 完成。
- 不新增 API、业务规则、缓存、订阅、轮询或持久化；不改 Minecraft 或共享工作台 Owner。

## 设置、权限与边界

- 无新增设置或偏好字段。弹窗继续继承外观设置的主题、颜色、字体/字号、背景遮罩和减少动态效果映射；卡片布局不引入新的 CSS 自定义属性。
- 打开文件只使用稳定实例 ID 和既有导航合同，不自行拼接文件系统路径，也不写文件。
- 删除按钮沿用 `hasAdminAccess`、节点在线、实例状态与 `Popconfirm` 条件，并调用当前 `deleteInstance` 提交函数；保留认证、授权、输入校验、备份归档与任务反馈。
- 不在验收中触发真实删除、启动、停服、配置写入或修改用户外观设置。

## 实施批次与验收

### 批次 1：实例卡片三项操作收进管理弹窗

- 卡片只保留“启动”“安全停止”“管理”；管理弹窗展示“管理实例”“打开实例文件”“删除实例”三个按钮。
- 三个按钮保持原功能去向；删除按钮保留原 Popconfirm 确认文案及可用条件，取消确认后仍停留在管理弹窗。
- 增加定向长期回归，覆盖菜单可访问名称、三操作完整性/目标调用、危险操作限制及现有实例生命周期动作仍留在卡片。
- 运行 Minecraft UI 包测试、Client 类型检查、Minecraft UI 包构建和正式 Web 构建；构建输出只进入根 `dist/`。
- 从当前源码启动正式 Web，在 ChatGPT 内置浏览器访问上述实际路由，目视验证桌面与窄分栏/短屏的卡片操作、弹窗布局、键盘关闭与按钮可达性；确认打开管理和文件入口，删除仅检查确认提示并取消。记录视口与截图证据。

## 性能、安全与未测范围

- 弹窗复用已有实例数据与调用，不增加请求、订阅、计时器、观察器、动画或随时间增长的数据。
- 服务端权限、节点校验和删除归档合同保持不变；UI disabled 状态仅作原有防误操作提示，不替代服务端校验。
- 未进行真实帧时间测量时记录为未测；静态、构建和浏览器证据分别记录。

## 实施与验收记录

- 状态：已完成。三个实例操作已收进纵向管理弹窗；卡片继续显示启动与安全停止。
- 本次变更：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 管理弹窗状态、按钮与原 Owner 调用；`MinecraftWorkspace.css` 纵向全宽布局与 44px 最小按钮高度；包 README、定向测试、任务合同和 `docs/PROMPTS.md` 登记。
- 设置核对：未新增设置/偏好。继续使用当前外观设置及共享主题令牌；没有改变用户外观设置。
- 自动检查：Minecraft UI 包测试 13/13 通过；Minecraft UI 包构建与 `pnpm run build:web` 通过，产物在根 `dist/`；`node scripts/runtime-build-state.mjs web` 返回 `["host"]`，表明 Web 已构建而现有 Control Plane 构建指纹仍过期；`git diff --check` 通过；Impeccable `detect --json` 返回 `[]`。Web 构建另有现存大包提示：`cpp` 501.30 kB、`three.module` 526.97 kB；MinecraftWorkspace chunk 为 147.42 kB（gzip 51.36 kB）。本轮没有做帧时间测量或这些共享 chunk 的拆分。
- 工作区检查：`pnpm run check:workspace` 报 4 项既有清单问题：包目录 JSON 清单过期，以及 `PROMPTS.md` 指向的 `minecraft-multicore-metadata-recovery-20261030`、`minecraft-instance-jvm-configuration-20261030`、`java-environment-master-detail-20261030` 三个合同锚点不存在。本次没有改动包目录清单或这三份合同。
- 实页验收：在 ChatGPT 内置浏览器，以源码 Web `http://127.0.0.1:5173/games/minecraft/instances` 打开真实实例列表；页面截图尺寸为 1020×924，LFAA 工作台左右栏使实例主内容处于窄分栏。另在 ChatGPT 内嵌工作台的桌面窗口截图 2560×1392、短屏窗口截图 1867×822 下目视检查。点击“管理”后，三个竖排按钮完整可见；Escape 关闭弹窗；“管理实例”进入原实例概览；“打开实例文件”进入该实例稳定 ID 对应的文件目录；删除显示原有归档确认，取消后仍留在弹窗。没有执行删除、启停或配置写入。三个视口的截图均由本轮 CUA 页面验收捕获。
- 实页限制：`runtime-build-state web` 的 `host` 项过期，当前端口 3000 的服务也报告构建指纹过期并拦截新文档导航；该服务进程组承载 Daemon，本轮没有重启或重建其他任务涉及的 Control Plane。实页使用当前 checkout 的 Web Vite 入口 5173，连接现有控制端。未对 3000 重启后的生产交付入口复测。
- 性能与未测：改动复用现有实例快照和操作调用，不新增请求、订阅、计时器或观察器；未做帧时间测量，手机设备未实测。
