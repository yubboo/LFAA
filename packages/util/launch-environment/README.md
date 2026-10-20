# LFAA Launch Environment

`config.homeDirectory` 固定账户/控制数据 Home；`config.dataDirectory` 使用显式部署 `LFAA_DATA_DIR`，否则读取 `<LFAA_HOME>/storages/data-directory.json` 中“项目与存储”的选择，首次默认 `<LFAA_HOME>/data`。启动时 Home 仅初始化数据库、账户文件、会话、凭据和控制配置；Data 根仅初始化业务目录（账户业务文件、游戏、环境、工具、缓存、临时文件、日志、备份、模型与联机配置）。

`config.localComputerUse` 仅在 Windows、本机 CLI 显式 `LFAA_LOCAL_MODE=true` 且 `SERVER_HOST` 为 loopback（localhost/127.0.0.0/8/::1）时为真；CLI `web` 默认设置本机模式。Web 外部监听即使环境标记仍为本机也拒绝 UI 工具。远程生产 Web 不得调用控制端所在机器桌面。

GitHub App 的公开 Client ID 由控制端环境变量 `LFAA_GITHUB_APP_CLIENT_ID` 提供，可选 `LFAA_GITHUB_APP_CLIENT_SECRET` 仅用于远端撤销用户授权。仅向服务端配置读取，不作为浏览器设置、用户 General 偏好或 API 响应返回；两项均缺省时 GitHub 连接明确报告未配置。
