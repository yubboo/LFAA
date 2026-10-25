# 本机托管节点工具

让 Agent 看到并受控启停**启动器托管的本机节点（Daemon）**。

- 只读取启动器注入的 `lfaaLocalDaemonSupervisor`（`apps/cli/bin/lfaa.mjs` 在 `boot()` 之后提供）；本包不派生进程、不读任意 pid、不写设置或节点数据。
- 没有托管面（独立控制端、`--no-local-daemon`、远程部署）时，`daemon_local_start/stop/restart` 明确失败并说明原因，不退回 `Shell` 或其它命令。
- `daemon_local_status` 同时返回当前账户可见节点清单，便于模型区分“节点未启动”和“节点已断开”。
- 风险：`status` 只读；`start` 为写入；`stop`/`restart` 为危险操作，统一经过 `permissions.mode` 与 Permission Owner。
- 启动/重启回执不代表团已在线；模型必须再次读取状态或按节点真实回报核对。

构建输出：根 `dist/packages/host/tool-daemon/`。直接回归：`apps/cli/tests/daemon-tools.test.mjs`。
