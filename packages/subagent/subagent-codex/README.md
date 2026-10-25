# lfaa-subagent-codex

将本机已安装的 Codex CLI 注册为外部子代理驱动。外部调用只能由既有 `lfaa_delegate_subagent` 风险合同启动；必须处于本机完全权限模式，模型配置由该 CLI 自身负责。

CLI 进程从最小白名单环境启动；Run 取消或超时先调用 `lfaaWin32Process` 终止进程树，再在 Owner 未能终止时尝试停止直接子进程。缺少进程树 Owner 时拒绝启动。取消竞态、回退与 Owner 传递回归见 `apps/cli/tests/subagent-process-control.test.mjs`。
