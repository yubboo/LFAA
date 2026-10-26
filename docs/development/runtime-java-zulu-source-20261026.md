# LFAA-RUNTIME-JAVA-ZULU-SOURCE-20261026

## 目标

让 LFAA 小鱼能依据用户给出的 Java 发行源（包括 `https://d10.injdk.cn/openjdk/`）和核心的 Java 主版本要求，选择已登记发行版，并通过 Runtime Owner 将其安装到目标运行环境的受管存储位置。修复“工具只允许固定 Temurin 下载源，因此无法使用用户指定的 Zulu 包”的能力缺口；浏览器打不开来源页时，Agent 仍可选用 Runtime Owner 已登记的发行版元数据完成同主版本安装，不依赖任意 URL 或网页操作成功。

验收以截图中的 Windows x64 Zulu JDK `17.0.19` 为具体输入；如果该具体版本已经不再由官方元数据提供，必须如实失败并说明可用范围，不改装其他版本冒充成功。

## 入口、Owner、配置与边界

- Web `/work` 的 LFAA Agent 负责理解用户目标并选择工具；`packages/games/tool-runtime` 暴露模型合同，`packages/games/runtime-manager` 排队并归属真实任务。
- `packages/host/runtime-environment` 是唯一 Java 发行版元数据、工件校验、解压、安装和版本验证 Owner；本机和目标 Daemon 共用该执行器。`packages/games/minecraft` 仍负责核心要求、显式 Java 运行时 ID 和部署。
- 沿用 `permissions.mode`、`minecraftRuntime.minecraftDownloadTimeoutSeconds` 及当前设置中心/节点数据根派生的运行环境、下载缓存与临时目录；不新增或修改持久化设置，不改变用户偏好。
- 只支持代码登记的厂商发行版；不得让模型提交任意下载 URL 或自报摘要。每次安装校验官方 HTTPS 元数据、目标平台/架构、主版本、包名、SHA-256 和安装后真实 Java 版本。浏览器/网页故障不得触发权限绕行或虚构能力。
- 不接受新实例 EULA/核心许可、不修改现有实例/端口、不直接由 Codex 下载或安装；实际 Java 安装和模组服启动须由 LFAA Agent 调用 Owner。已有 Paper 实例与其受管 Java 必须保留。

## 验收条件

- `runtime_operation` 可表达默认 Temurin 与显式 Zulu 选择、Java 主版本及可选精确版本；旧调用省略发行版时继续兼容。
- 截图中的 Zulu 文件名可通过 Azul 官方元数据精确解析到对应工件和 SHA-256；对其他版本/平台/架构、错误 UUID/包名/摘要/跳转、取消、损坏 ZIP 或安装版本不符均拒绝提升为可用环境。
- 工件仅进入目标设备配置的下载缓存，安装目录在该设备配置的 Java 运行环境目录内；Agent 可从真实工具回执取到稳定 Java runtimeId，并把它显式传给 Minecraft 部署工具。
- 模型源选择保持动态；页面访问失败时，Agent 可以继续使用登记的可信发行版接口，不将临时网页错误当作 Java 已下载或节点已在线。
- 运行目标回归、运行环境/Runtime 工具及 Minecraft 合同直接相关回归、受影响包构建、Control Plane/Web 构建、类型检查和差异检查。实际目标节点下载/安装/启动由 LFAA Agent 后续实测；静态和隔离测试不能替代节点验收。

## 当前运行环境证据（2026-10-26）

- 本次 `/work` Agent 使用的 LFAA Web 进程以 `--no-local-daemon` 运行，故已登记节点 `WIN-20250328BHE` 离线；Daemon 对本机无托管模式的拒绝属于实际运行入口限制，不得当作节点安装成功。
- LFAA Runtime Manager 原工具合同没有发行版字段；共享执行器 Java 安装只调用 Adoptium Temurin 元数据。官方 Azul Metadata API 的 Zulu 包列表与详情提供包名、平台、版本、下载链接及 SHA-256；只读查询已确认 `zulu17.66.19-ca-jdk17.0.19-win_x64.zip` 对应 Java `17.0.19`，详情 SHA-256 可供校验。
- 用户截图中的 `signal is aborted without reason` 与 EULA 站点不可访问尚未在 LFAA Browser Owner 源码中定位到对应错误或建立本地复现；本合同不先修改 Browser Owner。Agent 必须在页面失败后使用已登记能力继续判断，并准确报告真实执行结果。

## 实施与验证记录

- Runtime 工具现可传入已登记的 `distribution: "zulu"` 和可选精确版本；Runtime Manager 把它与当前账户设置中心中的下载时限、目标环境存储一并写入真实运行任务。共享执行器只从 Azul Metadata API 匹配 Windows x64 GA Zulu JDK ZIP，再校验包详情、HTTPS CDN 来源、SHA-256、体积和安装后的完整版本，并返回设备可复用的 `zulu-<major>` 运行时 ID。
- 定向运行环境回归覆盖 `17.0.19` 解析、受管目录安装、Runtime Manager 任务负载及不可信工件拒绝；与 AI Work 恢复回归合跑 18/18 通过。Host/Client 类型检查、Web、Control Plane 构建和 `git diff --check` 通过。
- 真实目标节点仍离线（本次 Web 入口使用 `--no-local-daemon`）；截图所示 LFAA 会话随后收到用户“先停下，不做任何更动”的选择。没有实际下载/安装 Java，也没有部署或启动模组服；这些运行结果仍待目标节点恢复且用户在 LFAA Agent 对话中继续后续操作后验证。
