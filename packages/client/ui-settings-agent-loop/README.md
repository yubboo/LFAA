# client/ui-settings-agent-loop

本包呈现 Agent Loop 预算与运行参数设置。`AgentLoopSettingsGroup` 接收现有 `aiRuntime`、当前可见模型账户和受控更新回调；字段由设置容器传入并保存，不在此包缓存用户设置或执行 Agent。

沙箱模式、请求/工具调用安全上限和默认 `aiRuntime` 值均复用 `lfaa-util-values` 唯一合同。执行、委派、模型调用预算、Permission 校验与持久化仍分别归 Agent Loop、Permission Owner 和 Settings Owner；本包只提供 Web UI，不注册第二套运行服务或授权。

消费者：`packages/client/ui-settings/SettingsPage.tsx`。运行位置：LFAA Web 设置中心。构建输出写入仓库根 `dist/packages/client/ui-settings-agent-loop/`。
