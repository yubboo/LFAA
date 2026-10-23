# SteamCMD 工具适配 Owner

持有 SteamCMD 节点查询、工具安装/校验和 Steam Dedicated Server 配置/任务工具适配。Dedicated Server 业务事实与节点任务仍归 `games/steamcmd`。

公共合同：保留 `steamcmd_list_nodes` 和 `steamcmd_run_task`，新增 `steamcmd_list_servers`、`steamcmd_create_server`、`steamcmd_server_task`。服务端安装按已发布 Dedicated Server Tool AppID 调用同一 SteamCMD Owner；创建工具要求显式 EULA 接受参数，启动/停止经原任务队列和 Permission Owner。

运行位置：Control Plane 的 Cordis 插件或内部合同库，由 base Bundle 装配；不运行在浏览器，不将凭据或节点进程带入客户端。依赖以本包 package.json 为准，真实消费者见生成包清单的静态证据。源码/装配声明与现场运行验收分别记录。

设置：复用 plugins.enabled（第三方扩展）、plugins.skillDirectories（Skill 来源）、permissions.mode、Provider/模型及 aiRuntime 的输出/请求/上下文/工具/委派预算，以及 SteamCMD `installMode`、工具目录和游戏目录节点设置。没有新增设置或默认值，不重置用户偏好。内置方法不因第三方开关关闭而成为虚假不可用，用户内容仍受原范围与开关约束。

安全与数据：目录/方法不构成授权；真实动作经过原 Permission、参数、账户、作品/项目/节点和领域事务。加载不执行外部文档指令，不自动重放未知副作用。注册随所属 Fiber 撤销，异步正文加载前后检查登记，Run 工具选择不进入全局状态；子任务只继承父 Run 提供的范围。

构建输出：根 dist/packages/games/tool-steamcmd/。直接回归见 apps/cli/tests/package-owner-lazy-capabilities.test.mjs、harness-runtime-wiring.test.mjs 与各领域长期测试；具体已运行结果见本轮任务合同及交付报告，不能据包存在宣称 Provider/桌面/远端已实测。

支持边界来自 Steamworks [Dedicated Server 分发说明](https://partner.steamgames.com/doc/sdk/uploading/distributing_gs?l=english)：客户端商店 AppID 与专用服务端 Tool AppID 不可互相推断；兼容性及匿名下载仍需针对目标 Tool AppID 实际验证。
