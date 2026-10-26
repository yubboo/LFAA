# RuntimeManager

运行环境的控制 Owner：统一目标设备、真实环境发现、兼容选择、安装/注册/校验/卸载任务与依赖检查。共享执行实现位于 `host/runtime-environment`，控制端本机适配器独立于 Daemon；远端只通过认证节点任务通道执行，不把控制端路径或进程用到远端。

手动游戏库与 `runtime_*` AI 工具使用同一服务。环境、下载缓存与临时目录从目标设备唯一 data 根派生为 environments、cache、tmp，不再提供独立根覆盖；旧保存的环境位置只用于发现/读取已安装环境，不自动搬迁。原存储写入 API 返回明确退役信息，设置页只读展示节点位置。任务由 Jobs 持久化，取消等待执行器确认，租约过期标记未知，不重放可能已发生的操作。Minecraft/SteamCMD 保留业务 Owner；旧 Minecraft Java API 兼容路径仅用于既有调用者，迁移完成后移除，不作为游戏库新入口。

权限仍只有请求审批、替我审批、完全访问。EULA 由 Minecraft 与同一 Permission Owner处理，运行环境工具不能伪造接受记录。Java 工具可由模型选择已登记的 Temurin 或 Zulu；Zulu 可指定精确版本，工件链接与 SHA-256 只取自厂商官方 HTTPS 元数据。工具不接受任意下载 URL 或模型自报摘要。下载遵守部署环境代理和 NO_PROXY，不更改全局网络或关闭证书验证。

本机 Java 发现可在 Daemon 不在线时执行。当前托管安装为 Windows x64；其他平台只呈现已接入的实际操作，Linux/远端实机验证须单独报告。构建仅写根 `dist/packages/games/runtime-manager`。

游戏库共享环境页分为 Java、SteamCMD、Microsoft Visual C++、DirectX，SteamCMD 安装仍调用原有 SteamCMD Owner 和设置；Microsoft 分类提供真实检测及签名安装包下载。节点检测回执有界保留至再次检测，离线不宣称可用，已下载不等于已安装。对应服务器是 Minecraft 记录的只读投影，只表示配置要求，不表示该 Java 已安装或正在使用；跳转继续经原 App 入口。
