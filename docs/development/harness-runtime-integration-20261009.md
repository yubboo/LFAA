# LFAA Harness 运行链修复记录

日期：2026-10-09。当前工作副本：H:/LFAA1。DSH 参考源码：H:/deepseek-harness。本轮保留原有未提交工作，不修改真实账户、凭据与运行数据。

## 结论与范围

此前修复记录能证明目录、模块和类型存在，无法证明产品运行入口已经使用它们。此次沿实际入口检查：Profile → Cordis 装配 → Agent Run → 当前工具目录 → Permission Owner → 领域/节点执行器 → 真实结果 → 下一次模型判断。

发现并修复的实际缺口包括：插件默认导出无效；Skill 注册表没有进入模型目录与加载工具；子 Agent 创建新根任务，丢失继承范围与模型选择；定时任务只广播事件，没有创建 Run 也记录成功；压缩未进入实际请求且持久化使用旧数组索引；图片读取只回元数据；控制端直接文件读取与远端项目位置混淆；完整发布包缺少 Office Skill 资源；领域提示与执行器存在第二套授权规则。

这份交付不把 177 个包的文件数量或构建成功当作 DSH 全部能力已对齐。真实 Provider、Windows 桌面和远程节点的用户任务验收仍须单独完成。

## 唯一操作授权规则

| 模式 | 本轮统一语义 |
| --- | --- |
| 请求审批 | 未授权的写入与高风险动作等待本次明确批准。 |
| 替我审批 | 同一账户、App、工具版本、风险和目标范围累计两次明确批准后自动记忆，匹配动作后续自动执行；用户可撤销。 |
| 完全访问 | 在当前用户目标范围直接执行，不增加逐项审批。 |

累计两次记忆与撤销重置已在当前 Permission Owner 实现，本轮复用并回归，不另造授权器。移除 Minecraft EULA/核心许可独立人工门槛、控制台 stop/restart 黑名单、写作强制另去界面应用、应用启动禁止使用通用 Shell 发现以及 Office Skill 禁止发现现有渲染器的规则。领域工具可以建议更合适的方法，但不再建立另一套审批。

账户认证、数据归属、有效参数、并发摘要冲突与真实执行状态仍由对应 Owner 验证；它们不新增用户批准步骤，也不假装未接入能力已存在。只讨论或要求先审阅的用户目标不会被扩大为保存、发布或其他动作。

## 对照 DSH 的实际接线

| DSH 参考 | LFAA 改动与证据 |
| --- | --- |
| packages/skill/skill、skill-filesystem、tool-skill | 当前账户目录 → Provider 摘要 → 模型选择加载正文；自定义目录、重名优先级、缓存隔离与失效进入实际入口。 |
| packages/subagent/subagent-in-process-driver、tool-subagent | 子 Run 共用父任务委派接缝，继承项目、工具范围、共享数量/深度、拒绝状态和取消；指定保存模型账户真正生效。 |
| packages/schedule/schedule/src/client.ts | 到点交付创建真实 Agent Run，保存 Run ID；无消费者必须失败，失败退避。 |
| packages/compaction/compaction-basic、compaction/tool-pairing | 摘要使用同一模型请求器及预算；长任务可压缩，工具对闭合，当前轮持久消息不因压缩丢失。 |
| 文件/Shell/终端执行接缝 | 通用文件工具只翻译参数，真实读写走目标 Daemon；Shell 和终端具有实际服务、位置说明、参数、取消及清理。 |

登记表保存工具合同与插件元数据，模型根据目标选择工具和判断结果。应用发现已有 Windows 登记、开始菜单、PATH、Steam 与有界便携查找，本轮补齐未命中后的通用发现路径和查询核实 EXE 的使用说明。产品实现未加入 PCL 专用流程。键盘工具新增真实 pid/windowId 目标，观察回传窗口清单，避免始终向审批页面所在前景窗口输入。

## 设置中心

| 配置 | 默认值/使用方式 |
| --- | --- |
| permissions.mode | ask；三个模式统一控制所有副作用。保留账户已有值。 |
| plugins.enabled / mcpServers / prompts | 沿用已有开关、服务与提示词；关闭扩展时不偷偷开启。 |
| plugins.skillDirectories（新增） | []；最多 16 个账户自定义绝对目录。设置 UI、本地草稿、校验、持久化与实际 Provider 同步接入。 |
| aiRuntime.autoCompaction（新增） | true；控制实际请求前的自动摘要。 |
| aiRuntime.contextWindowTokens（新增） | 32768；模型目录未知窗口时使用，4096～2000000。模型已知窗口优先。 |
| aiRuntime.maxModelRequests / maxToolCalls | 新账户默认 0＝不限次数，已有非零偏好保留；UI 和服务端都接受 0。 |
| aiRuntime.subagentAccountId / maxSubagents / maxDelegationDepth | 沿用空账户回退、4、2；实际继承、模型选择与共享预算读取这些设置。 |
| aiRuntime.requestTimeoutSeconds / requestRetries / retryDelaySeconds / maxOutputTokens | 沿用 90 秒、1、1 秒、2048；普通请求及摘要共用运行器设置。 |
| aiRuntime.commandTimeoutSeconds | 0＝不限时；Shell 读取账户设置，PowerShell 执行器不再把显式 0 改回默认超时。 |
| general.taskFolder / integratedShell | 沿用空目录与 system；Daemon Shell/终端按对应位置使用，不把远端项目路径解释成本机目录。 |
| computerControl.enabled | 沿用 false；用户开启的本机能力依照同一权限模式运行。 |
| personalization.memoryEnabled / memoryFromToolChats | 保留原偏好；后台调度与子任务不擅自写入长期记忆。 |
| appearance 全部适用设置 | 新配置使用既有 Settings 控件和共享外观；未新增 CSS 变量或重置主题、字体、壁纸等偏好。 |

旧客户端保存 plugins/ai-runtime 时与当前配置合并，避免未提交的新字段被默认值擦除。未修改用户正在使用的数据或配置。

## 性能、资源和结果边界

- Skill 摘要与正文分开；目录有界，正文最多 512 KiB，摘要只读前 16 KiB；缓存有界并按账户/目录键隔离。监听根有界、失效可重扫、初始化有超时、卸载撤销句柄和等待。
- 子 Agent 完成记录淘汰，70 次连续完成后不再被旧 64 项永久卡住；退出/取消撤销订阅。
- 调度持有单个计时器，每轮最多 100 个到期任务，不重叠派发；卸载等待当前派发。交付成功只证明 Run 已创建，业务任务是否完成以该 Run 的最终状态为准。
- 终端输出有界，进程退出淘汰会话，Run/插件结束关闭进程。当前使用管道 Shell，无 PTY，全屏交互仍不受支持。
- 图像以真实图像块发给模型，会话历史不保存 base64；节点任务回执仍按现有任务存储策略保存有界结果。
- 窗口清单最多 128 项；精确窗口目标已验证传给 SDK，尚未在真实 Windows 桌面验证焦点恢复。没有把替身验证当作真实输入成功。
- 未测浏览器帧时间、交互流畅度或远程设备性能，不能据类型检查/构建宣称“丝滑”。

## 验证

最终验证在本轮实际执行，结果如下：

| 命令/核对 | 结果与证据 |
| --- | --- |
| pnpm install --offline --ignore-scripts | 183 个 workspace project 依赖接线成功；无联网下载。保留依赖弃用警告。 |
| node node_modules/typescript/bin/tsc --noEmit -p tsconfig.host.json | 最终通过，退出 0。 |
| node node_modules/typescript/bin/tsc --noEmit -p tsconfig.client.json | 最终通过，退出 0。 |
| pnpm run build | 最终退出 0；176 个非测试支持能力包、Web、控制端与 CLI 运行目录全部完成。输出为根 dist/packages、dist/apps/web、dist/apps/control-plane、dist/npm/lfaa。Web 保留既有大分块提示，未声称加载性能通过。 |
| CLI 顺序回归（完整命令见下） | 24/24 通过，最终运行 45.75 秒。 |
| node --test scripts/tests/compiled-web-startup.test.mjs | 1/1 通过，2.49 秒；正式编译入口、真实 HTTP 认证、Skill 根/压缩设置读写与正常退出。 |
| node scripts/check-workspace.mjs | 通过：177 包，当前 CLI 版本 0.0.8，类型映射/依赖/文档一致。未做版本升级或发布。 |
| node scripts/runtime-build-state.mjs web | 返回空数组；Web/Host 产物指纹与当前源码一致。 |
| 控制端与 CLI 组装资源核对 | Office 三份 SKILL.md 和 check_office.py 在两棵运行树中均存在且逐字节与源码一致；CLI 无 workspace: 运行依赖。 |

CLI 最终命令（在 H:/LFAA1/apps/cli 执行）：

    node --import tsx --import ./register-package-loader.mjs --test --test-concurrency=1 tests/general-agent-capabilities.test.mjs tests/execution-control.test.mjs tests/agent-runtime.test.mjs tests/writing-edit-proposals.test.mjs tests/computer-use.test.mjs tests/harness-agent-api.test.mjs tests/harness-runtime-wiring.test.mjs tests/workspace-projects.test.mjs

完整 Profile 回归使用合成 SSE Provider，但启动、服务装配、模型请求构造、Run、权限、账户存储及节点文件队列/执行器均为产品真实实现；节点领取和完成由隔离夹具驱动，桌面 SDK 使用 Driver 替身。覆盖 Skill 摘要与加载、账户隔离、子模型与继承范围/深度、70 次完成淘汰、摘要及持久化、工具对闭合、14 次连续模型请求、真实图片块与历史脱敏、文件摘要冲突/目录越界、调度 Run 回执、三种权限与写作应用、终端清理。不能把合成 Provider 通过说成顶尖模型的自然语言理解已经实机验收。

定位过程出现过失败：旧插件导出、模型 UUID 过严校验、计划工具越出继承范围、旧预算断言、js-yaml 打包声明冲突、缺少 Office assets；均修复后重跑。并发执行两个重负载夹具时曾触发 15 秒等待超时，改为 30 秒有界等待并以顺序完整回归通过，不将该次失败计为通过。workspace 文档检查最初拒绝机器绝对链接，改为绝对路径标签与仓库相对链接后通过。

workspace-preflight 当前不存在，未运行该名称的 Gate；未制造替代命令冒充。

## 未覆盖与交付

没有用真实 Provider 发起付费模型请求，没有启动用户的 PCL、Minecraft 实例或 Office 程序；未在真实浏览器操作新设置控件，未测真实窗口焦点。外部 CLI 驱动依赖实际安装与其账户设置；远端节点无法直接使用控制端宿主的资源路径，仍须目标节点真实能力与资源交付，不宣称全平台运行时都已随包具备。

本轮未重启用户原有 Control Plane/Daemon，正在运行的进程不会自动获得全部修复；构建版隔离启动的结果与原有进程分开记录。未发布、未创建提交，也未改动 DSH 源码。

完整改动文件绝对路径与职责见 [85 个文件清单](harness-runtime-integration-files-20261009.md)。
