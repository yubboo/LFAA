# 会话待处理提醒与通知中心

状态：**已实施**（2026-11-22）。本文记录「会话需要确认/回答时在左二栏显示徽标，并按设置播放提示音、弹桌面通知」的实现边界。

## 目标

- 用户不在某个会话时，也能看到该会话正在等待自己处理：工具审批显示「待确认」，澄清提问显示「待回答」。
- 通知行为接入设置中心：轮次完成、权限提醒、问题提醒、会话状态徽标、提示音各自生效。
- 与已有的「运行中转圈 / 完成未读小圆点」互斥联动，不出现互相矛盾的状态。

## Host 契约

- 会话摘要新增 `pendingQuestion`：`{ messageId, question, options }`。`beginAgentRun` 在收到用户新消息时清除；本轮以澄清问题结束（`ask_user`）时写入，并同时标记未读。
- `GET /api/agent/attention` 返回 `{ items: [{ sessionId, kind: "approval" | "question", toolName?, question?, options?, messageId? }] }`：
  - 审批项来自仍在运行且 `pendingApprovals` 非空的运行，同一会话优先返回审批。
  - 问题项来自未归档会话摘要里的 `pendingQuestion`。
- 已有 `GET /api/agent/active-sessions` 继续提供运行中会话集合；两个接口都只暴露会话 id 与简短原因。

## Client 状态机

- `ChatStoreSnapshot.attention` 保存当前待处理项；`getSessionAttention(sessionId)` 供左二栏读取，并受「启用会话状态提醒」开关控制。
- `ChatBackgroundRuns` 每 1.5s（有运行任务）或 4s（只剩待回答问题）轮询运行集合与待处理集合；首屏从 Host 同步但不补发历史通知。
- 通知触发集中在 `ChatSessionNotifier`：
  - 新出现的审批/问题：按 `enableApprovalNotification` / `enableQuestionNotification` 播放提示音并弹桌面通知；当前打开的会话由界面自身提示，不重复通知。
  - 后台轮次结束：按 `turnCompleteNotification`（未聚焦/始终/关闭）提醒；同一轮已产生待回答徽标时跳过，避免双重提示。
  - 所有提示音统一使用 `notificationSound`（默认/清脆/静音）。
- 徽标优先级：待确认/待回答 > 完成未读点；当前打开的会话不显示徽标。审批中的会话仍保留左侧转圈，右侧显示待确认。

## 设置中心

- 新增独立 `settings:notifications` 视图，并登记为可用；「常规」页保留同一份通知分组，二者共用 `NotificationSettingsGroup` 与同一持久化配置。
- 提供桌面通知权限状态/申请、发送测试通知、提示音试听；权限未授予时应用内徽标与提示音仍可用。

## 验收与限制

- 单测覆盖：待回答持久化/清除、Host 待处理接口、澄清运行进入与退出待回答、侧栏徽标与互斥规则、通知档位与不支持环境回退。
- 真实验收：在独立 5174 宿主上用真实 Agent 运行触发「待确认」「待回答」，确认徽标、提示音与桌面通知，并验证通知设置页的测试通知；验收后删除测试会话并关闭临时宿主。
- 逐步轮询而非全局推送，后台事件最多延迟约 1.5–4s；桌面通知依赖宿主/浏览器授权，Electron 与浏览器均由 `Notification` API 提供。
- 新 Host 接口需要重启一次本地 `pnpm lfaa web`（或桌面端）后才在既有 5173 页面上生效。