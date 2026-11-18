# Dev Log 000062 — 完整实现设置中心「常规」页（权限/项目外聊天目录/编辑器/弹出窗口/通知/趣味实验）及全链路联动

- **编号**：000062
- **时间**：2026-11-18 10:06:00 +08:00
- **任务名**：`general-settings-and-linkage`
- **状态**：已完成实现、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 目标与核心功能

完成设置中心左侧菜单 **「常规（`settings:general`）」** 全部 6 个配置分组与 Host/Client 真实联动：

1. **权限**：`默认权限` 与 `完整访问权限`（含风险提示及「了解更多」），与输入栏左下角权限选择器及右侧 Agent 能力栏双向实时同步。
2. **常规**：
   - `项目外聊天文件夹`：动态检测当前操作系统用户实际文档目录并生成 `<MyDocuments>\LFAA`（如实测环境下自动识别为 `D:\Documents\LFAA`，不写死用户名与盘符），支持 `更改` 弹窗重选，并在无项目绑定对话时由 [server.ts](file:///e:/lfaa/apps/web/src/server.ts) 注入作为默认安全工作目录。
   - `默认文件打开位置`、`智能体环境`、`集成终端 Shell`、`语言`、`关闭窗口前确认`、`默认使用完整视图`、`登录时启动`（诚实标注本地 Web 模式提示，不伪造写注册表）、`自动归档不活跃的聊天`、`压缩本地保存的聊天历史记录`、`速度`、`可用推理强度`（多选勾选框）、`首页建议`（实时控制工作区首页推荐卡片显隐）、`打开源许可证`（读取真实依赖列表并弹窗展示）、`插件`。
3. **编辑器**：`纯文本编辑器`、`显示上下文窗口使用情况`（输入栏实时估算 token 提示）、`发送快捷键`（`按 Enter 键` / `按 Ctrl+Enter 键` 实时控制提交行为）、`后续消息处理方式`（`排队` / `引导` 运行中消息提交及队列芯片移除）。
4. **弹出窗口**：`弹出窗口快捷键`（支持按键录制与清除）与 `默认使用独立聊天`。
5. **通知**：`轮次完成通知`、`启用权限通知`、`启用问题通知`、`启用 Dot 通知` 与 `通知提示音`（Web Audio 轻量提示音，在轮次完成或审批请求时触发）。
6. **趣味实验**：`彩纸礼炮`（开关与手动触发庆祝反馈）。

---

## 2. 实际变更清单

- 新增 [general-settings.ts](file:///e:/lfaa/packages/core/chat/src/general-settings.ts)（236 行）：Host 端 `GeneralSettingsStore`（持久化于 `~/.lfaa/general-settings.json`）、`resolveDefaultOutsideProjectFolder` 与 `readBundledOpenSourceLicenses`。
- 修改 [index.ts](file:///e:/lfaa/packages/core/chat/src/index.ts) 与 [http-handler.ts](file:///e:/lfaa/packages/core/chat/src/http-handler.ts)：接入 `ChatPluginConfig`，提供 `GET/PATCH /api/chat/general-settings` 与 `GET /api/chat/licenses`。
- 修改 [server.ts](file:///e:/lfaa/apps/web/src/server.ts)：为 `chatPlugin` 传入 `repoRoot`，并在未绑定项目时将 `outsideProjectFolder` 作为默认工作区根目录注入 `createAgentHttpHandler`。
- 新增 [general-settings-client.ts](file:///e:/lfaa/packages/core/chat/client/general-settings-client.ts)：Client 默认值、`middleTruncatePath` 中间省略路径格式化、语言覆盖持久化与轻量 Web Audio 提示音合成。
- 修改 [chat-types.ts](file:///e:/lfaa/packages/core/chat/client/chat-types.ts)、[chat-store.ts](file:///e:/lfaa/packages/core/chat/client/chat-store.ts) 与 [locales.ts](file:///e:/lfaa/packages/core/chat/client/locales.ts)：补充 `generalSettings` 状态、更新接口、运行中 `submitFollowUp`（排队/引导）与通知音频触发。
- 新增 [GeneralSettingsControls.tsx](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsControls.tsx)（87 行）、[GeneralSettingsView.tsx](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsView.tsx)（175 行）、[GeneralSettingsGeneralGroup.tsx](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsGeneralGroup.tsx)（281 行，< 400 行）、[GeneralSettingsSecondary.tsx](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsSecondary.tsx)（250 行）与 [GeneralSettingsView.module.css](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsView.module.css)（278 行，< 400 行）。
- 修改 [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx) 与 [ChatWorkspace.module.css](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.module.css)：接入 `homeSuggestions`、`sendShortcut`、`followUpMode` 排队芯片与 `showContextUsage` 估算指示。
- 修改 [index.tsx](file:///e:/lfaa/packages/core/chat/client/index.tsx) 与 [settings-catalog.ts](file:///e:/lfaa/packages/ui/layout/client/settings-catalog.ts)：注册并启用 `settings:general`（`implemented: true`），并在卸载时清理。
- 修改 [chat-lifecycle.test.ts](file:///e:/lfaa/packages/core/chat/tests/chat-lifecycle.test.ts)：补充 `settings:general` 生命周期及 Host 常规设置与许可证 API 单测。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` | **35/35 通过**（`duration_ms 1681.9328`） |
| TypeScript 类型检查 | `pnpm run typecheck`（12 个 tsconfig） | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 443ms`） |
| 内置浏览器实测 | `browser` 子代理实测 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0/50） |

- 内置浏览器实测验证亮点：
  1. `项目外聊天文件夹` 自动识别出当前系统实际文档目录 `D:\Documents\LFAA`。
  2. `打开源许可证` 弹窗列出真实依赖版本（`react`、`vite`、`typescript` 等）。
  3. 切换 `完整访问权限` 实时联动工作区左下角权限胶囊为 `完全访问`，切回 `默认权限` 恢复为 `请求批准`。
  4. 关闭 `首页建议` 后工作区首页推荐芯片即时隐藏，重开后恢复显示。
  5. 最终状态截图已核验 [final_step_20.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/cbed8d39-98dc-418a-9f00-baa01e30e398/final_step_20.png)；后台 `pnpm lfaa web`（`task-1013`）持续运行中；未执行 `git commit` / `git push`。
