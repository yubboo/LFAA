# LFAA Launch Environment

`config.localComputerUse` 仅在 Windows、本机 CLI 显式 `LFAA_LOCAL_MODE=true` 且 `SERVER_HOST` 为 loopback（localhost/127.0.0.0/8/::1）时为真；CLI `web` 默认设置本机模式。Web 外部监听即使环境标记仍为本机也拒绝 UI 工具。远程生产 Web 不得调用控制端所在机器桌面。
