# Minecraft 与小鱼工作通知卡统一紧凑布局（2026-10-31）

<a id="lfaa-minecraft-action-toast-layout-20261031"></a>

## 用户目标与可观察结果

- Minecraft 操作完成/任务提交和小鱼工作完成后的右下角通知使用同一套紧凑提示卡呈现。
- 卡片保持单一表面背景，不再用独立大色块承载关闭区或倒计时；主要信息和操作链接清晰可读，右上角仅放小型关闭图标，Minecraft 自动收起倒计时置于底部。
- 保留 Minecraft 任务跳转、小鱼会话跳转、两类通知各自的自动收起时长、声音通知、实时状态与可访问语义。

## 入口、Owner、数据与权限

- 页面：Minecraft 实例工作区 `/games/minecraft/instance/:instanceId/overview`；提示卡由该工作区动作回报后显示。
- 共享卡片外观/组件 Owner：`packages/client/ui-primitives`；调用方分别是 Minecraft 工作区与 `packages/client/ui-layout/src/Workbench.tsx`。
- 卡片继续读取当前真实 Minecraft 操作结果或小鱼工作通知；分别导航至 Minecraft 任务页和对应会话。本轮不改变动作执行链、会话/任务数据或权限。
- 小鱼工作通知的状态仍由 Workbench 持有；Client Resources 的现有通知音频与 Permission/会话规则不迁移到共享 UI 控件。
- 验收期间不提交 Minecraft 生命周期/归档/配置操作，不触发小鱼 Agent 任务或配置写入。

## 设置中心配置盘点

- `general.notificationPopupsEnabled`：账户级通知总开关，默认开启；关闭时工作区按现有逻辑不显示提示卡。
- `general.notificationToastDurationSeconds`：账户级倒计时设置，默认 5 秒，服务端校验范围 1–60 秒；本轮继续读取且不改动用户值。
- `general.notificationToastEffect`：账户级动效选择，共享默认 `fluid`；沿用既有动效入口与减少动态效果优先级，不新增动效。
- 小鱼工作完成音效继续使用 `general.completionNotification`（默认 `unfocused`）、`general.notificationSound`（默认 `default`）及通知总开关；提示声音仍由 Client Resources 实现，AI 工作通知原 8 秒自动收起不变。
- 卡片颜色、字体、字号、背景透明度、模糊及对比度继续沿用 Appearance 共享映射；不新增或重置任何设置项。

## 允许与禁止范围

- 允许：在 `ui-primitives` 增加共享提示卡组件和样式；让 Minecraft、Workbench 两个调用方消费该组件；更新三个受影响 UI 包说明、依赖装配、任务合同与索引。
- 禁止：改写通知状态/计时器、任务链接目标、声音策略、动作结果、服务端 API、通知或外观设置；不得通过真实服务器动作或小鱼 Agent 任务制造验收提示。

## 验收条件

- 执行 Minecraft UI 包构建、Client 类型检查和正式 Web 构建；产物只写根目录 `dist/`。不运行自动化测试，除非用户另行要求。
- 正式 Web 启动前核实运行产物与当前源码匹配；在 ChatGPT 内置浏览器检查同一实例概览页与 `/work` 桌面、窄视口，没有横向溢出、两类通知的入口/关闭不混淆，卡片不遮挡重要操作。
- 如果没有安全的 UI 预览入口，不触发真实 Minecraft 操作或小鱼 Agent 任务；明确记录 toast 在验收时是否实际可见及对应未测边界。
- 汇报使用的设置、变更文件绝对路径、运行检查、性能/安全检查与未测项。

## 实施与验收记录

- 状态：已实现；完成了正式页面与响应式布局检查，瞬时提示卡本身未能在无副作用的情况下触发预览。
- 实现：`packages/client/ui-primitives` 新增唯一的 `NotificationToast` 组件和样式。卡片采用单一表面背景、右上角 44px 关闭按钮触控区、底部细分隔线与倒计时；调用方继续持有通知状态、计时器和动作。Minecraft 工作区与 Workbench 已迁移到该组件，移除两套重复样式。保留 Minecraft 任务链接和设置控制的时长/动效/声音；保留小鱼会话链接、原 8 秒收起和 Client Resources 的音效实现。
- 设置：继续使用 `general.notificationPopupsEnabled`、`general.notificationToastDurationSeconds`、`general.notificationToastEffect`、`general.completionNotification`、`general.notificationSound` 及 Appearance 共享令牌；没有新增、重置或写入偏好。
- 构建：`pnpm --filter lfaa-client-ui-primitives run build`、`pnpm --filter lfaa-client-ui-minecraft run build`、`pnpm --filter lfaa-client-ui-layout run build`、`pnpm run build:web`（包含 `tsc --noEmit -p tsconfig.client.json`）、`pnpm run build:control-plane` 均通过；`node scripts/runtime-build-state.mjs web` 与 `host` 均返回 `[]`。`git diff --check` 通过；旧的 `.minecraft-action-toast` / `.ai-work-notification-toast` 选择器搜索无命中。Impeccable detect 返回 `[]`。未运行自动化测试，未测帧时间。
- ChatGPT 内置浏览器：正式服务由当前源码启动，实际路由 `/games/minecraft/instance/bd7c58bb-a1e1-4d20-b7f6-d66f23841e2d/overview` 在 1280×720 检查；`/work` 在 1280×720 和 390×640 检查。页面宽度均与视口一致，无横向溢出；Workbench 页面已加载共享卡片样式（26 条匹配 CSS 规则）。每个页面均未显示 toast（`toastCount=0`），因此只验收了真实页面布局和样式装载，没有声称提示卡外观、关闭点击或倒计时在实际通知态通过。为遵守验收边界，没有启动/停止 Minecraft 实例、提交 AI 任务或写入用户设置来制造提示；两类通知实际出现时的视觉与点击仍待自然操作验收。浏览器测试视口已重置，临时验收标签页已关闭。
- 性能/安全：共享组件是纯展示层，不持有计时器、请求、事件订阅或轮询；未改变动作/导航/状态 Owner、授权、通知音效或服务端 API。Audit Skills 的检查范围不覆盖本次 TSX/CSS；无独立设备、桌面 WebView 或帧时间测量。
