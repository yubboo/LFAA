# Agent 开服、Skill 与存储联动修复

本轮先在 `docs/PROMPTS.md` 登记 `LFAA-AGENT-MINECRAFT-STORAGE-REPAIR-20261013` 修复提示词及修改边界，再实现与验证。没有修改 DSH、用户提供的原始 Skill、真实账户/Provider 设置或游戏实例。

## 判断与依据

用户贴出的轨迹已经识别水桶插件服意图、异常版本与确认后的 Paper 1.12.2；不能据此断言模型无法理解自然语言。主要故障在执行结果合同、防重恢复和下载/工具粒度。终端工具已经存在，Java 自动查找、安装和版本核验也已在 Daemon 实现；并非缺少终端或必须让模型逐条手写安装命令。

- Agent Loop 只识别嵌套 `task.status`，而启停/重试工具返回顶层任务。失败任务可能被记为成功写入，随后相同实例操作被成功防重拦截。这一源码缺陷已通过顶层/嵌套状态回归确认。
- 防重第一次发生就中断整轮，模型没有接收反馈后纠正或交付的机会。现在首次返回未派发反馈，持续重复才停止；状态重验工具在另一写操作成功后可以恢复已确认失败，结果未知始终不可重放。
- Paper 原路径依赖镜像并按通用核心规则推导 Java。现在明确 Paper 时只查询官方 Fill v3，读取真实工件、SHA-256 与版本 Java 元数据；省略 build 时选同版本最新 STABLE，不换版本，省略端口时事务分配未登记端口。
- 旧提示词要求顺序查节点、实例、版本、Java、任务和日志。现在模型只补缺少的决策证据，使用一次领域任务执行依赖准备到就绪核验。用户提供的豆包 Skill 已适配成随包、按需、可撤销的 Skill Provider；没有复制固定 `H:/mc/server`、版本断言和独立启动脚本。
- 文件服务已有 A–Z 有界探测。现在首页直接列出真实卷，并合并并发卷探测；设置页可以打开已保存存储根目录，账户私有数据仍由原 App 管理。修复旧库初始化误删从未存在的 `project_storage_locations` 表及漏接 v54 迁移；补齐 Writing 读取 Settings 的依赖声明。

DSH 只读参考为 `H:/deepseek-harness/packages/guard/repeat-tool-reminder/src/index.ts` 及 README：它向模型提供重复提醒。LFAA 保留自己的未知副作用防重与唯一 Permission Owner，没有照搬其执行策略或修改 DSH。

## 设置使用

- `permissions.mode`：请求审批、替我审批、完全访问均沿用原 Permission Owner；没有更改当前用户模式或增加领域强制确认。文件管理仍要求实时超级管理员与 full_access。
- `plugins.enabled`：控制扩展/Registry Skill 的可见使用；新 Skill 不会自行打开开关。Skill Registry 的摘要与正文按需加载，不在每轮注入全套参考手册。
- Provider、模型与 `aiRuntime` 请求/输出/模型请求数/工具调用数、重试与超时沿用保存值，不静默换模型或减少用户思考档位。
- `minecraftRuntime`：默认内存 4096 MB、默认 Java 服务端口 25565、基岩端口 19132、就绪 120 秒、停止 30 秒、下载 1800 秒、安装 900 秒、native 与默认 Paper；运行时消费用户保存值，测试使用隔离的不同值核对任务快照。
- 节点/全局 Minecraft 存储位置及 `LFAA_DATA_DIR` 保持原 Owner。Java 使用目标节点 `environments/java`，实例使用该节点配置目录，Shell 当前目录不作为 data 根目录。
- `project_storage_locations` 的日志/Writing/漫剧生效位置用于设置页浏览联动；general.taskFolder/integratedShell 和现有项目绑定不改变。新增按钮沿用现有外观组件、主题、字体与 Space 换行，不增加外观配置。

## 验证与边界

- 8 个直接回归文件一组 35/35 通过：Agent、三权限模式、Minecraft 领域/执行器/Skill、系统文件库、完整 Web Profile/API、Writing 本地正文。另有存储回归 7 项在前次整组通过，修复过时旧库夹具后剩余 1 项定向通过。此前失败与对应修复均保留在本轮工具记录中，没有降低生产校验。
- Client/Host 类型检查、12 个相关能力包构建、Web 构建、Control Plane 隔离构建、`check:workspace` 与最终 `git diff --check` 通过。构建只写根 dist。Web 仍有既有大 chunk 提示。
- 正式 Web Profile 在隔离数据和随机回环端口启动，通过真实认证 API；实际加载新 Skill、读取并保存默认项目存储位置。模型回复/节点执行用合成夹具，因此不代表真实 Provider 或真实 Minecraft 验收。
- 只读实测：PaperMC 1.12.2 / build 1620 元数据、官方工件 URL、SHA-256 和最低 Java 8 可取得；Adoptium Java 8 Windows x64 JRE 元数据可取得。本机可用盘符为 C、D、E、H，与有界探测一致。PaperMC 下载协议依据[官方文档](https://docs.papermc.io/misc/downloads-service/)。
- 工作量证据：省去单独选择 build 的模型往返，Java/核心/配置/元数据/启动留在一次领域任务内；域明确时不等待全部核心来源。防重纠正夹具为 3 次模型请求/1 次真实夹具写入；明确失败→修复→重试夹具为 4 次请求/3 次夹具工具执行。卷发现最多 26 个根探测，20 秒缓存与并发合并；不扫描卷内容。
- 未运行：真实 Provider 开服/实际 token 与耗时对比、真实 Java ZIP 下载解压与 Minecraft 启动、玩家/公网连接、桌面/远程机器、短屏/手机和帧时间。浏览器库存无可用标签且连接报告失败，未据构建宣称网页点击已验收。没有开启证书绕过、修改系统 PATH、迁移真实目录或重启用户服务。
- `workspace-preflight` 在当前脚本中不存在，未运行；使用实际 `check:workspace`，不冒充旧 Gate。网络、上游工件、版本歧义与节点状态仍可能阻塞；不能承诺任何输入都永远无错。
- 两处本轮失败测试残留为 `H:/LFAA1/dist/.tmp/system-files-test-SXCmJo` 与 `C:/Users/yu/AppData/Local/Temp/lfaa-multicore-YKNcZI`。已核对目录位置和本轮创建时间，但自动审批审查拦截递归清理，仅返回 `blocked by policy`，未执行删除；没有清理同名前缀的历史目录。

## 本轮文件与职责

### 浏览器实测续接（2026-10-13）

用户要求在当前 LFAA 的 Minecraft AI Work 发出一句话并验收。已停止偏离目标的隔离 Java 下载，正式构建并启动当前项目 Web/本机 Daemon，由用户登录现有账户。当前真实设置为 deepseek-flash、完全访问，项目已有 Java 11/21。

首次浏览器输入“帮我开一个 Paper 1.12.2 我的世界服务器，优先复用项目里已有的 Java 环境和同版本实例。”：模型识别现有实例后启动，遇到旧手工元数据错误转义导致的 JSON 解析失败；之后多轮混用 PowerShell/cmd、摸索目录，旧部署重试返回 400，最终新建部署并开始重复下载 Java 8。3 分 35 秒时任务仍未完成；点击停止 Agent 后，仅停止等待，Minecraft 领域队列继续执行（现行明确合同），因此停止了本轮自行启动且没有运行 Java 游戏进程的验收 Web/Daemon。此轮明确未通过，不以脚本或构建结果代替。

修复：Paper Fill 分支复用既有插件核心 Java 推荐规则（官方表中 1.12–1.16.4 推荐 Java 11），不再直接使用最低字节码 8；节点 Shell 支持单次明确选择、默认仍服从设置，回报 Shell/工作目录；Minecraft 节点工具给出 Java 与 Shell，管理员实例详情给出真实数据根/登记存储位置；Daemon 区分损坏 JSON 与缺失文件。同时修复隔离运行发现的不存在路径助手，使用既有安全路径 Owner。没有手工修复真实实例来冒充 Agent 自主恢复。直接回归 agent-runtime 与 minecraft-multicore 共 12/12 通过；正式入口重验结果待补。

下列为本轮修改/新增文件。开始前已有的 database.ts 与 logger.ts 改动保持原样；pnpm-lock.yaml 保留原有差异，只补本轮工作区依赖。

| 绝对路径 | 职责与改动 |
|---|---|
| H:/LFAA1/packages/core/agent-loop/src/tool-outcome.ts | 统一真实执行结果分类 |
| H:/LFAA1/packages/core/agent-loop/src/execute-turn.ts | 防重纠正、状态重验恢复、活动/Session 一致 |
| H:/LFAA1/packages/core/tools/src/business-tools.ts | 开服可选构建、定向 Paper 目录、恢复标记、实例端口 |
| H:/LFAA1/packages/games/minecraft/src/core-sources.ts | Paper 官方目录、工件与 Java 元数据 |
| H:/LFAA1/packages/games/minecraft/src/deployment-service.ts | 可选构建和事务分配端口 |
| H:/LFAA1/packages/games/minecraft/src/setup-skill.ts | 随包 Skill Provider 与撤销 |
| H:/LFAA1/packages/games/minecraft/assets/minecraft-server-setup/SKILL.md | 豆包开服资料的 LFAA 适配版 |
| H:/LFAA1/packages/games/minecraft/src/index.ts | 领域插件注册 Skill |
| H:/LFAA1/packages/games/minecraft/src/minecraft-prompt-library.ts | 按缺少证据选择工具、一次部署指引 |
| H:/LFAA1/packages/games/minecraft/package.json | 声明 Skill Registry 依赖 |
| H:/LFAA1/packages/api/minecraft-controller/src/index.ts | API 同步可选 build 合同 |
| H:/LFAA1/packages/bundle/base/cordis.patch.yml | 正式装配等待 Skill 服务 |
| H:/LFAA1/packages/host/daemon/src/minecraft-provisioner.mjs | 验证 Paper 官方工件来源 |
| H:/LFAA1/packages/host/daemon/src/daemon.mjs | Java 准备失败诊断、安全存储助手接线与损坏 JSON 诊断 |
| H:/LFAA1/packages/shell/tool-shell/src/index.ts | 明确单次 Shell、保留设置默认与回报执行上下文 |
| H:/LFAA1/packages/shell/tool-shell/README.md | 节点 Shell 参数和默认设置合同 |
| H:/LFAA1/packages/client/connection/src/file-manager-location.ts | 账户限定的已保存位置映射与浏览交接 |
| H:/LFAA1/packages/client/ui-settings/src/SettingsPage.tsx | 生效目录和全部磁盘浏览入口 |
| H:/LFAA1/packages/client/ui-sidebar-files/src/FileManagerPage.tsx | 消费浏览目标并保留请求清理/缓存隔离 |
| H:/LFAA1/packages/fs/fs/src/library.ts | 首页真实卷与并发发现合并 |
| H:/LFAA1/packages/storage/storage-domain/src/migration.ts | 新配置域与旧表退役分离，完成 v54 接线 |
| H:/LFAA1/packages/document/writing/package.json | 补齐现有 Settings 读取依赖 |
| H:/LFAA1/pnpm-lock.yaml | Minecraft/Writing 工作区依赖锁定 |
| H:/LFAA1/apps/cli/tests/agent-runtime.test.mjs | 结果分类、防重继续、修复后重试、当前版本断言 |
| H:/LFAA1/apps/cli/tests/general-agent-capabilities.test.mjs | 审批活动回答后不重复提交决定 |
| H:/LFAA1/apps/cli/tests/minecraft-multicore.test.mjs | 官方工件、默认构建和端口冲突 |
| H:/LFAA1/apps/cli/tests/minecraft-provisioner.test.mjs | 一次准备 Java/核心/完整元数据后启动 |
| H:/LFAA1/apps/cli/tests/minecraft-setup-skill.test.mjs | 真实 Skill 资源读取与卸载 |
| H:/LFAA1/apps/cli/tests/system-file-library.test.mjs | 卷入口、存储映射及安全边界；隔离数据移出源码范围 |
| H:/LFAA1/apps/cli/tests/harness-agent-api.test.mjs | 正式 Profile 装配 Skill 与认证存储 API |
| H:/LFAA1/apps/cli/tests/file-storage.test.mjs | 当前 v54 及真实旧表列夹具迁移 |
| H:/LFAA1/packages/core/agent-loop/README.md | 循环结果及防重恢复合同 |
| H:/LFAA1/packages/games/minecraft/README.md | 来源、自动构建/端口、Skill 和许可合同 |
| H:/LFAA1/packages/host/daemon/README.md | 实际 Java/工件执行与未实测边界 |
| H:/LFAA1/packages/document/writing/README.md | 存储设置依赖说明 |
| H:/LFAA1/packages/client/connection/README.md | 设置/文件浏览交接职责 |
| H:/LFAA1/packages/settings/README.md | 配置域与文件联动职责 |
| H:/LFAA1/docs/PROMPTS.md | 先登记修复提示词、合同和用户 Skill 追加范围 |
| H:/LFAA1/docs/系统总体架构.md | 当前来源、循环和运行职责事实 |
| H:/LFAA1/docs/开发计划.md | 本轮状态及验收边界 |
| H:/LFAA1/docs/development/agent-minecraft-storage-repair-20261013.md | 本报告与完整交付清单 |
