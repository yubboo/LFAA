# 联机服务 API

仅代理到 `lfaa-game-connectivity` Owner。用户 API 从会话取得账户 ID；游戏目标由注册的 App 适配器回查，普通账户不能提交任意节点/端口。Daemon 路由清单/状态使用既有绑定到节点 ID 的 Bearer 身份，不返回给浏览器。

该 Controller 不持有路由、Provider 密钥或游戏实例状态，也不提供进程执行接口。

EasyTier 安装端点只允许管理员为在线 Windows x64 节点提交发布清单中的固定任务；任务由 Connectivity Owner 保存在 `LFAA_DATA_DIR/connectivity/easytier-install-tasks.json`，认证 Daemon 通过节点绑定的领取/完成路由操作任务。任务清单和单条状态只返回创建账户自己的摘要，不返回任务正文、执行路径或 Daemon 输出流。
