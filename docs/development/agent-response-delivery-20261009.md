# Agent 最终答复交付修复（2026-10-09）

## 目标、实际证据与入口

修复用户提供的 LFAA Web 实际会话：该轮启动于 17:02，已向 DeepSeek 发出 12 次请求，最后消息状态为 `error`，Run 结束为 `interrupted`。会话快照证明实际保存的 AI Runtime 值仍是旧默认 `maxOutputTokens=2048`、`maxModelRequests=12`、`maxToolCalls=24`；最后一个 Provider 响应以工具调用结束，后续因请求次数上限没有生成最终答复。另有一个请求在 `finish_reason=length` 后以相同参数重试，重复消耗 Provider 请求。

同一轮的 `lfaa_read_file` 与 `lfaa_list_directory` 均因真实数据库约束 `ai_host_tasks.timeout_seconds BETWEEN 1 AND 1800` 拒绝了 Daemon 请求；当前执行器与新建数据库约定 `0` 表示不设超时，旧 SQLite 表结构没有随既有 v32 表重建迁移更新。

- 入口：Web/桌面 Profile → Agent Run → Provider SSE 与工具循环 → Session 持久化/SSE → AI Work 消息。
- Provider 请求、流解析归 `packages/llm/llm`；请求循环/失败终态归 `packages/core/agent-loop`；消息投影和实时显示归 `packages/client/connection`、`packages/client/ui-chat`。
- `aiRuntime.maxOutputTokens`、`maxModelRequests`、`maxToolCalls` 的默认、持久化和验证归 `packages/util/values` 与 `packages/settings/settings`。
- Daemon 任务表结构归 `packages/storage/storage-sqlite`；通用文件任务由既有 Daemon Owner 执行。

## 设置与数据范围

- 新账户 `aiRuntime.maxOutputTokens=0` 表示跟随所选模型目录明确声明的单次输出上限；目录没有输出能力元数据时，不发送上限字段，遵循 Provider 对该型号的默认行为。正数表示用户显式输出上限；已验证的模型输出上限始终约束请求。不得使用全局固定值截断 16k/256k/1m 型号。快速策略最多 1024；推理参数与输出长度分开。沿用 `aiRuntime.speed`、`maxOutputTokens`、`maxModelRequests`、`maxToolCalls`、`requestRetries` 和当前模型推理档位，不新增设置。
- 对未标记过的旧 AI Runtime 设置，仅当旧默认指纹完整匹配 `balanced / 2048 / 12 / 24` 时，将其迁移到跟随模型输出能力及不限请求/工具预算。带自定义值的数据原样保留；迁移版本持久化后，用户之后可再次保存任何合法值。
- SQLite v49 仅将既有 `ai_host_tasks.timeout_seconds` 检查从 `1..1800` 改为 `0..1800`，保留全部列、记录、索引、外键及 `0` 表示不限时的既有执行语义；旧版文件存储退役入口也调用 v49，避免再次激活 SQLite 时回退在 v48。
- 保持 `请求审批`、`替我审批`、`完全访问` 三种模式及 Permission Owner；不更改用户项目路径、节点、模型凭据或其他账户偏好，不重放已完成的工具调用。

## 验收

- 对 `finish_reason=length` 验证不以相同上下文/输出上限重试；用户只看到真实文本及明确的长度诊断，隐藏推理不出现在消息或日志。
- 对用户主动保留的非零模型请求上限验证工具不越界执行，并在助手消息中看到清楚的“尚未完成”终态说明；取消状态不追加错误文案。
- 用完整隔离 Web Harness 验证默认/旧默认迁移、自定义预算保留、用户后续自定义值不会被再次迁移、最终文本 delta 与持久化消息一致。
- 用隔离旧 SQLite v48 表验证 v49 迁移保留记录和索引、外键检查通过，并成功插入 `timeout_seconds=0` 的通用 Daemon 文件任务。
- 用隔离 Provider 模型目录验证 1m 上下文/256k 输出时发送 256k；输出元数据未知时省略上限字段；用户可显式设 1m，且有验证模型上限时仍会被该上限约束。
- 运行 Agent/LLM/Settings/SQLite 定向回归、类型检查、相关包与正式 Web/Control Plane 根目录构建、`check:workspace` 与差异检查。真实 Provider、浏览器流式渲染、活动 Daemon 的旧库在线迁移状态分开报告。

## 设置中心配置

- 读取并继续使用上述 `aiRuntime` 设置及已激活 Provider 的模型输出能力元数据；输出长度上限仍由用户设置和所选模型能力共同决定。
- 不改主题、字体、界面外观、权限模式或用户项目/节点选择。

## 实施与验收记录

- 已修复：Provider 明确返回 finish_reason=length 时停止同参重试；请求预算、截断及其他失败均写入助手消息的明确未完成终态，已有流式文本保留；SQLite v49 重建旧 Daemon 任务表以允许 0 超时并保留记录/索引/外键。输出默认值已按用户后续反馈修正为跟随模型能力。
- 设置中心：复用 aiRuntime.speed、maxOutputTokens、maxModelRequests、maxToolCalls、requestRetries 和模型目录的输出能力；没有新增设置项。设置页补充输出限制可能包含推理 token、截断后不重试的说明。
- 已修正本轮最初的 16384 固定默认：设置中心以 0 表示自动，Provider 模型目录有明确输出上限元数据时按该型号能力请求；未提供时不猜值并省略字段；用户正数仅作为偏好上限，不能超过已验证模型能力。旧版完整默认指纹迁移至自动模式，自定义设置不重置。
- 验证通过：隔离完整 Web Harness（含流式最终文本、失败 delta、迁移自定义值保护、长度截断不重试、预算耗尽不派发工具、模型目录 256k/用户 1m/未知能力跟随 Provider 默认、v48→v49 记录/索引/外键与 timeout=0）；设置/项目文件/Agent/文件存储/电脑操控定向回归；pnpm run typecheck；pnpm run check:workspace（177 包）；pnpm run build:harness（176 包）；pnpm run build:control-plane；pnpm run build:web；最终 `git diff --check`。Web 构建仍报告一个既有超过 500 kB 的代码块提示。
- 运行环境检查：端口 3000 的原服务为 PID 19208，数据库仍为 v48；重启前检查未发现排队/运行中的 Daemon 任务或运行/安装中的 Minecraft 实例。进程重启命令被执行策略拒绝，命令未执行；没有绕过策略终止进程。因此上述 Control Plane/Web 新构建尚未加载，真实数据库尚未迁移。
- 未验收：真实 Provider 回复、真实浏览器流式渲染、当前 Web 服务重启后的 Daemon 文件读取。需在本机服务重启后再核实；编译和合成 Provider 证据不等于实机验收。本次没有新增轮询、订阅或定时器，也未测实际浏览器帧时间。
