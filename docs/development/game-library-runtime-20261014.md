# 游戏库与运行环境开发、浏览器验收

当前合同：`LFAA-GAME-LIBRARY-RUNTIME-20261014`。用户要求按任务书实施，并在实际浏览器验收，发现问题继续修复重验。

## 代码审计与实施边界

当前入口为 React 共享 Client、Cordis/Profile 控制端、独立 Daemon；业务元数据由 SQLite/Storage Domain 保存，Session 轨迹由 JSONL 保存。应用中心在 `H:/LFAA1/packages/client/ui-layout/src/Workbench.tsx`，业务路由由 `H:/LFAA1/packages/client/ui-renderer/src/App.tsx` 与 ApplicationWorkspace 组合。Minecraft/SteamCMD 的 App ID、API、任务和已有数据继续保留；游戏库作为一级组合入口，不另造账户、会话或服务端实现。

Java 当前已经支持实际版本探测、PATH/JAVA_HOME/托管目录/用户路径发现、Temurin 官方摘要安装、注册/移除路径、受管卸载和运行实例保护。控制逻辑混在 Minecraft service 的 Java 方法，执行逻辑混在 Daemon，任务为 Minecraft 的 java-install，缺少独立环境首页、独立存储位置和不依赖 Daemon 的本机管理。环境复用必须基于节点真实回报，不能把 PATH 上没有 Java 当作没有托管 Java。

Minecraft 的自动 provision、核心适配器、官方工件校验、原生参数数组启动、日志就绪和本机监听、三种权限、专业 Skill、子 Agent 委派均已有真实入口。简单开服不强制主/子 Agent重复推理。当前 Node/Daemon 运行范围为 Windows x64；Linux 路径/执行与未接入核心不得仅凭任务书示例标为可用。SteamCMD 当前环境安装/更新/命令/配置已接入，游戏实例安装/运行等未接入部分需继续如实标识。

历史浏览器基线（上轮，不能冒充本轮已验收）：真实 deepseek-flash、完全访问、Paper 1.12.2 与 Java 11，旧文件恢复用时 4分57秒/26个工具决策批次/38次工具调用/958809输入19030输出 tokens；修复后新会话复用已安装资源开服21秒，6次工具调用，82192输入1724输出 tokens。核心日志 Done、本机25566监听。新建下载、其他权限、远端和其他平台未被这条复用用例覆盖。

用户已澄清任务书 EULA 冲突：继续统一三种权限，完全访问可直接接受，其他模式经 Permission Owner；已有记录保留。

## 阶段状态

| 阶段 | 状态 | 验证 |
|---|---|---|
| 项目审计与合同 | 已登记，继续沿实现核对依赖 | 已阅读入口/领域/设置/权限/执行源码 |
| 游戏库三卡片与原路由接入 | 待实施 | 未运行 |
| RuntimeManager 与本机/节点执行 | 待实施 | 未运行 |
| 存储设置、手动草稿返回、AI 工具 | 待实施 | 未运行 |
| 取消/恢复/去重与 Skill | 待实施 | 未运行 |
| 回归/构建/Gate | 待实施 | 未运行 |
| 真实浏览器复验 | 待实施 | 未运行 |

## 文件、设置与验收记录

后续随实际实现补齐；不以设计方案替代完成。
