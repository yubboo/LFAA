# lfaa-subagent-codex

Codex CLI 驱动目前登记为不可运行：尚未将每个 CLI 工具动作接入 LFAA Permission Owner。Manager 会向能力目录返回 `available: false` 和原因，并在派发前失败关闭；接入动作级授权、预算和取消合同后再启用。

当前保留直接 CLI 适配器源码仅供后续迁移，不能从模型工具调用。它此前用最小白名单环境与 `lfaaWin32Process` 管理子进程；目录绑定回归见 `apps/cli/tests/subagent-external-workspace.test.mjs`，进程生命周期回归见 `apps/cli/tests/subagent-process-control.test.mjs`。
