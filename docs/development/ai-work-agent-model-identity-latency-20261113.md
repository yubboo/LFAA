# LFAA AI Work 当前模型身份与请求延迟（2026-11-13）

<a id="lfaa-ai-work-agent-model-identity-latency-20261113"></a>

## 用户目标、入口与 Owner

- 用户报告两个实际问题：询问“你现在是什么模型？”时 Agent 多次读取设置目录且回答迟缓；发送“你好”后等待约 24 秒仍没有可见正文。需要分清请求配置、Agent 工具循环、Provider 响应与界面状态，避免把推测当作“假模型/死循环”结论。
- 入口：AI Work `/work` → Session Controller → Agent Loop `executeAiTurn` → 当前 Settings/ModelResolver 选中的 Provider 和模型 → `lfaa-llm` 流 → Session Owner 持久化公开响应和运行记录。
- Settings Owner 持有当前账户、Provider、模型目录和思考偏好；Agent Loop 持有请求上下文、工具可见范围及循环；LLM Owner 持有 Provider 协议、请求参数及响应流；Session Owner 持有运行证据。不得复制设置、权限或工具执行规则。
- 当前截图对应的本机脱敏运行记录（UTC）：身份问题使用 `ark-agent-plan / glm-5.3-flash`，3 次模型请求、2 次成功的 `lfaa_settings_list` 调用，总时长约 43 秒；问候使用同一路由，只有 1 次模型请求、0 次工具调用，请求到完整响应约 28.6 秒。两者每次都提供 106 个工具定义，估算输入分别约 19.6k/17.8k tokens，其中工具定义约 14.3k tokens。该证据证明 LFAA 按配置路由并得到响应，但既有记录没有保存 Provider 实际回报的模型 ID，不能据此独立证明上游最终服务型号。

## 设置、数据与权限

- 不新增或重置设置，不切换 Provider/模型，不改 `permissions.mode`、AI Runtime 预算或保存的推理偏好。
- 每个主模型请求把当前实际选中的 `providerId/modelId` 作为服务端请求路由元数据提供给模型；标明它代表 LFAA 提交的路由目标，不冒充 Provider 上游回报的真实型号。用户询问当前配置模型时，优先使用该事实，不为重复查证调用设置目录。
- Settings 读写工具继续由 Settings Owner 持有并通过现有 `lfaa_tools_list` / `lfaa_tools_load` 按需发现；同时检查注册工具的首轮 Schema 是否过量，优先复用同一目录机制延迟发送领域工具合同，不绕过认证、校验、Permission Owner 或禁用真实能力。
- 按官方资料修复当前路由模型的真实推理参数元数据。历史 `glm-5.3-flash` 请求记录为 `reasoningParameter=null`、`reasoningValue=null`；官方模型说明支持 `reasoning_effort=low/high/max` 且默认 `max`。保留“默认”偏好为不传字段；用户主动选档后才把有效档位发给 Provider，不根据其它模型名称推断能力。

## 允许、禁止与验收

- 允许：补齐真实当前模型路由上下文；通过既有目录按需发现 Settings/领域工具 Schema；把官方有依据的模型思考能力接入方舟套餐目录；增加隔离 Provider 回归并维护受影响包 README、任务合同和索引。
- 禁止：调用真实 Provider 或触发实际用量；根据问候词写死本地回复/业务分支；降低模型思考设置、缩短用户输出设置、扩大/缩小 Permission 范围；声称当前真实上游型号已核验；读取或输出凭据。
- 验收：合成 Provider 可看到本轮实际 `providerId/modelId` 及“不需为此读取设置目录”的可信上下文；首轮只带少量常驻工具 Schema，模型仍可经搜索与精确加载得到同一真实合同；普通工具仍按原权限执行；GLM-5.3-Flash 目录暴露官方 `low/high/max` 与默认 `max`，实际选档经设置保存和模型请求组装进入 `reasoning_effort`，旧账户里过期的空能力快照不会覆盖当前官方目录。
- 运行定向 Agent/Tools/Settings 回归、相关包构建、Client 类型检查/Web 构建与 `git diff --check`。不重启用户正在运行的服务、不发送真实 Provider 请求；历史问候的单请求延迟不能据此声称已修复 Provider 速度，真实上游耗时仍待实际账户验证。

## 实施与证据

代码和合成回归完成。身份查询现在可从服务端上下文直接获知本轮 `providerId/modelId`，不会只为确认本轮路由而重复读取设置；已登记 Registry 工具默认经现有目录按需暴露，隔离装配观察到首轮 12 个工具 Schema、8,870 bytes，后续仍可精确加载 Minecraft 工具合同。针对性 Agent/Tools/Settings 回归 39/39 通过；Settings、Values、Tools、Agent Loop、Prompt、Tool Skill、Capability Installs、Client 构建、全仓类型检查、Web/Control Plane 构建及 `git diff --check` 通过。合成请求链路 P50 67.111 ms、P95 76.418 ms，不含真实 Provider 网络耗时。

模型能力方面，方舟套餐目录原先把模型思考能力都记为 `null`。根据 [GLM-5.3-Flash 官方模型卡](https://huggingface.co/zai-org/GLM-5.3-Flash) 和 [方舟 Chat API](https://docs.volcengine.com/docs/ark/chat-api?lang=zh)，现为 GLM-5.3-Flash 登记真实 `reasoning_effort=low/high/max`，官方默认 `max`；保留用户的“默认”选择为不发送该字段，显式选择档位才发送。旧的空快照不会覆盖该官方能力。未确认的其它模型继续显示未知、不构造档位。

运行证据限定：历史记录显示问候只发起 1 次 `ark-agent-plan / glm-5.3-flash` 请求、0 次工具调用，总耗时约 28.6 秒，因此该次慢响应不是 Agent 工具循环；身份查询则有 3 次模型请求和 2 次 Settings 读取。截图和当前 `/work` 只读页面显示当前选中模型已是 `doubao-seed-2.0-mini`，但目录未提供可验证的思考档位。当前 Web 页面观察到的是既有进程 PID 25988，未重启服务，也未调用真实 Provider；运行记录没有 Provider 回报的 `model` 字段。故本轮没有验证上游实际服务型号、真实网络延迟是否改善、GLM 的生产请求是否接受新参数，或输出质量是否达到预期。Web 构建指纹与当前源码一致不代表既有进程已加载新构建；新 UI 与真实账户验收待服务重载后进行。`pnpm run check:workspace` 另有 6 项既存文档/清单问题，与本任务无关。
