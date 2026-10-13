# 本机 Web Profile 的 Windows 电脑操控

## 合同

修复“`computerControl.enabled` 开关能开，但 `web` Profile 从未登记 Windows CUA 工具”的装配缺口。Windows CLI `web` 绑定 localhost/127.0.0.0/8/::1 时直接使用现有 in-process CUA Driver 和本机应用目录；远程生产 Web、非回环监听、非 Windows 均不登记桌面工具。Electron desktop 既有 Profile 行为保留。功能继续由账户开关和现有 `permissions.mode` 授权；仅启用设置不自动观察或操作桌面。当前本机电脑工具目录已由 8 项扩展为 9 项：新增基于用户明确 `.exe` 绝对路径的受控启动入口，远程/非回环边界不变。

## Owner/设置/验收

入口为 `pnpm lfaa web`；`lfaa-launch-environment` 是本机监听判定 Owner，Profile Bundle 装配适配器，`lfaa-computer-use` 管真实 Driver/本机应用，Core Tool Registry 与 Session 执行现有授权。复用 `computerControl.enabled`（默认 false）、`permissions.mode`、`plugins.enabled` 和 Provider/App 范围，无新增设置或 CSS。验收须确认 web loopback 有九项工具、非回环/远程服务无工具，computerControl 默认关闭且审批/取消/观察闭环不变。真实用户 Provider 和物理桌面需独立实测。
