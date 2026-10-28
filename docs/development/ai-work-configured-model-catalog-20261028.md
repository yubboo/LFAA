# LFAA-AI-WORK-CONFIGURED-MODEL-CATALOG-20261028

<a id="lfaa-ai-work-configured-model-catalog-20261028"></a>

## 目标、Owner 与设置

- 修复 `/work` 模型切换器只展示当前活动 AI 账户模型目录的问题。完整列出设置中心返回的所有可用账户与目录模型；选择模型时同步更新该账户的活动模型及账户选择，使后续请求实际使用所选 Provider 与模型。
- Owner：`packages/settings/settings` 持有 AI 账户、Provider 官方模型目录、加密凭据、账户 scope 与活动模型持久化；`packages/api/settings-controller` 持有认证后的账户选择路由；`packages/client/connection` 只透传公开账户/模型合同；`packages/client/ui-chat` 持有 `/work` 模型选择器。Agent Runtime 与 LLM 继续按 Settings Owner 的有效账户、模型和思考配置发起请求。
- 设置：沿用已保存账户的 `providerId`、`scope`、`modelId`、`models`、`reasoningMode`；切换账户/模型通过既有 Settings 权限边界保存。思考档位继续和账户 `reasoning_mode` 共用；`aiRuntime.speed` 与 `aiRuntime.contextWindowTokens` 继续作为全局输出长度策略及上下文兜底，不复制模型参数。外观继续读取共享 Appearance 令牌，不新增或重置设置。
- 官方信息只使用 Settings Owner 已校验并保存的 Provider 目录元数据：原始名称/调用 ID、目录提供的上下文和输出上限、任务/模态与带可信来源的思考参数、版本标签及官方目录附注。目录未提供的值不按模型名或品牌推测；界面明确说明元数据缺项。

## 允许、禁止与验收

- 允许：在切换器按账户汇总现有官方模型目录；显示账户名、Provider、模型原始名称/版本标签/ID及目录确实提供的能力；搜索所有已配置账户的模型；按有界批次渲染完整目录；通过 Settings Owner 认证路由切换账户/模型，保留账户与模型各自已验证的思考参数和权限校验。
- 禁止：新增 Provider/模型目录或模型能力硬编码；根据名称虚构上下文、输出限制、输入模态、任务类型、思考档位/默认值；跨账户复用凭据；客户端直接改账户配置；选择时静默降级/自动换模；重置 `aiRuntime` 或 Appearance 用户偏好；让目录返回的非对话模型伪装为 Agent 文本模型。
- B1：为仅显示活动账户目录的回归建立失败用例；验证模型选项覆盖系统账户与当前用户账户的可用模型目录、账号/模型相同 ID 不混淆、目录元数据缺失时不造数、Known non-chat capability 不进入 AI Work 文本模型选择，并验证选择目标账户/模型后持久化值与有效账户解析一致。运行相关的 Settings/API/Client 类型与构建。
- B2：正式 Web 服务加载最新源码后，在 ChatGPT 内置浏览器 `/work` 检查桌面和窄/短视口：所有现存账户组可搜索/浏览，长目录按“继续加载”逐段可达，所选/当前账户可分辨，元数据显示可信字段或明确缺失说明；只做只读交互，不修改真实账户或触发真实 Provider 请求。记录截图及未覆盖的跨账户持久化实测边界。
- 最终核对构建指纹、`git diff --check`、受影响 README、任务索引和逐文件责任。不得把静态/构建证据说成浏览器、真实 Provider 或偏好持久化验收。

## 实施记录

- 已修复：模型选择器读取 Settings Owner 返回的全部可见账户目录，按有效账户优先展示账户分组；名称、版本、调用 ID 和目录明确返回的能力随账户区分，支持跨账户搜索与每批 60 项继续加载。没有目录证据的上下文、输出上限、用途、模态或思考参数明确标为未提供；不把非聊天模型列为 Agent 文本模型。
- 已修复：选择其他账户/模型通过认证的 Settings Controller 路由；服务端沿用目录刷新与真实模型调用校验，并以事务同时保存所选账户及模型。选择系统账户会清除当前用户的个人 Plan 覆盖，使有效账户解析与界面选择一致；账户 scope/权限仍由既有检查控制。
- 回归：`ai-model-thinking-controls.test.mjs` 7/7 通过，覆盖多账户同 ID、有效账户优先级、非聊天/套餐过滤、官方字段完整保留及缺少元数据不猜测。受影响 Settings、API、Connection、模型 UI 与 Chat UI 包构建通过；Client/Host TypeScript 检查通过；Control Plane 与正式 Web 构建通过，Web 转换 3897 个模块。`git diff --check` 通过，Web/Host 构建指纹分别返回 `[]`。构建提示既有超过 500 kB 的代码块。
- 实页验收：已在 ChatGPT 内置浏览器打开 `http://127.0.0.1:3000/work`。页面检测到服务运行期间正式 Web 文件已更新，并显示保护提示“LFAA 需要重新启动”，未进入工作台或模型目录。用户授权重启；本机执行策略阻止结束已确认属于本 checkout 的 Web PID 6412（`blocked by policy`），因此未重启服务，没有改变真实模型/账户设置，也没有把桌面、窄屏或短屏界面验收记为通过。等待本机允许安全重启后再完成实页与视口检查。
