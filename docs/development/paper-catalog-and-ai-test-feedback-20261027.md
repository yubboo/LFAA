# LFAA-PAPER-CATALOG-AND-AI-TEST-FEEDBACK-20261027

<a id="lfaa-paper-catalog-and-ai-test-feedback-20261027"></a>

## 用户目标与证据

修复用户提供的两个界面问题：

1. DeepSeek 配置页把“官方模型目录读取成功”和“真实模型测试返回 HTTP 402”同时呈现，成功文案容易被误读为模型请求已通过；并且通用错误文案把 402 说成检查模型/参数。附件日志显示目录探测 HTTP 200，独立的 `/api/settings/ai/test-model` 失败（控制端包装为 422，Provider 错误码为 402）。DeepSeek 官方错误表定义 402 为余额不足、422 为无效参数。目录可读不等于真实模型可用，错误提示按真实 Provider 状态分类。
2. Minecraft 部署页在 PaperMC 官方版本目录不可用时，仍可能从 FastMirror 返回 Paper 版本；但 Paper 构建/工件 Owner 明确只接受 PaperMC 官方来源，所列版本随后无法继续查构建。附件日志显示 `/api/minecraft/cores/Paper/versions/26.3/builds` 返回 502，页面报告 `fill.papermc.io` 连接失败。

## 入口、Owner 与设置

- AI 配置入口：`/settings?section=ai` 的系统 Provider 配置弹窗；`packages/client/ui-settings` 负责展示，`packages/settings/settings` 持有目录、真实模型请求及凭据，`packages/llm/llm` 按 Provider 合同发起请求，`packages/api/settings-controller` 提供认证路由。
- Minecraft 入口：`/games/minecraft/deployment`；`packages/client/ui-layout` 消费认证后的核心/版本/构建 API，`packages/api/minecraft-controller` 路由到 `packages/games/minecraft`。`core-sources.ts` 是唯一来源和可部署性事实 Owner。明确选择 Paper 时必须使用 PaperMC 官方版本、构建及工件，不静默降级到镜像。
- 使用既有 Settings：AI Provider、账户、模型目录及思考设置仍来自 Settings Owner；Minecraft 的默认核心、内存、端口和执行模式继续读取 `minecraftRuntime` 设置。无需新增或修改设置，不改变凭据、权限、用户偏好或业务数据。

## 允许范围与分批验收

- B1（AI 状态反馈）：将成功提示准确表述为目录读取成功；DeepSeek HTTP 402 映射为余额不足提示；模型/思考设置变化时清除与旧选择关联的测试错误和结果。失败模型请求继续显示真实 Provider 错误，不能伪装成功。使用模拟响应验证 402 映射，不发起真实计费请求。
- B2（Paper 来源一致性）：官方 Paper 目录请求失败时，不将 FastMirror 返回的 Paper 作为可选择的 Paper 条目；保留可用的其他核心及真实来源失败提示。客户端快照仅用于首屏展示，每次进入部署页仍重新读取目录；刷新结果缺少当前核心或目录请求失败时，清掉失效核心/版本和缓存，暂停对应构建请求。官方源恢复时继续显示官方目录，并保持原 PaperMC 构建与工件校验。
- 禁止增加镜像静默回退、虚构模型/目录状态、自动切换 Provider/模型、修改用户配置或权限、保存真实密钥、接受 Minecraft EULA、部署/启停实例、重启既有服务，及改动无关工作树文件。

## 验收条件

- Paper 官方目录失败且 FastMirror 仍返回 Paper 时，返回目录不暴露该 Paper 项，其他来源可用的核心继续返回，错误说明保留；官方目录成功时 Paper 仍来自官方版本清单。客户端缓存重新校验，失效选择不再触发旧版本构建请求。使用隔离网络响应夹具覆盖服务端来源分支，并通过桌面与窄视口内置浏览器检查实际部署页。
- AI 配置真实请求失败后，页面明确区分目录读取状态和真实模型请求结果；切换模型或思考力度后旧失败提示/通过结果消失；未触发真实 Provider 请求及账户写入。
- 运行 `minecraft-multicore.test.mjs` 和可实施的 AI Client 类型/页面回归；构建 Minecraft、ui-settings、Web 与适用的 Control Plane。内置浏览器检查实际页面及相关视口，记录页面交互、截图证据和服务/账户限制；不把源码、构建或网络探测等同真实 Provider、Minecraft 远端目录或游戏实例验收。
- 记录性能静态检查、运行入口与指纹、所有变更文件、既有设置、验证实际结果以及未测范围。

## 实施记录

- **B1 AI 反馈**：`packages/client/ui-settings/src/SettingsPage.tsx` 将绿色成功提示限定为“模型目录读取成功”，说明其不证明真实推理成功；切换模型或思考方式时清空旧测试结果/错误。`packages/settings/settings/src/service.ts` 将 DeepSeek HTTP 402 映射为余额不足，其他状态保留现有分类；`packages/settings/settings/README.md` 记录 402/422 差异。`apps/cli/tests/ai-provider-model-errors.test.mjs` 用合成 key 与模拟 HTTP 响应验证目录读取和推理错误，未调用真实 Provider。
- **B2 Paper 目录**：`packages/games/minecraft/src/core-sources.ts` 在 PaperMC 官方目录不可用时从可选目录剔除镜像 Paper；`apps/cli/tests/minecraft-multicore.test.mjs` 覆盖目录失败/恢复分支。实页验收发现客户端永久复用快照并保留失效草稿；`packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx` 改为快照首屏展示后每次进入都重新读目录，目录失败清空旧目录缓存，当前核心失效时清空核心/版本并停止其构建读取；`packages/client/ui-minecraft/README.md` 记录该缓存合同。
- **配置与文件**：未新增或改动设置中心配置；继续使用 Settings Owner 的 Provider/账户/模型设置和 `minecraftRuntime` 默认核心/内存/端口/执行模式。变更文件共 9 个：上述 7 个源码/包说明文件、`apps/cli/tests/ai-provider-model-errors.test.mjs`、本合同，以及 `docs/PROMPTS.md` 索引记录（索引不计入前述 9 个实现与测试文件）。
- **回归/构建**：`minecraft-multicore.test.mjs` 与 `ai-provider-model-errors.test.mjs` 合计 12/12 通过；`lfaa-settings`、`lfaa-client-ui-settings`、`lfaa-client-ui-minecraft`、`lfaa-games-minecraft`、Web、Control Plane 构建通过；`git diff --check` 通过。另有既有 `ai-model-catalog-refresh.test.mjs` 断言仍匹配旧文案“系统模型配置”，与当前实现“模型配置”不符，先前运行失败；该断言不在本轮修改范围。Web 构建含 TypeScript 检查。
- **内置浏览器**：从当前 checkout 启动 Web，`/api/health` 返回 200。`/games/minecraft/deployment` 在 1280×720 和 390×844 均无横向溢出；实页重新读取并展示真实目录，PaperMC 目录当前可读、68 个版本，部署页因无在线多核心节点不可派发。该次实页没有复现 Paper 目录故障，因此官方目录失败分支以隔离回归夹具验证；测试不执行部署、不接受 EULA。`/settings?section=ai` 在 1280×720 和 390×844 打开 DeepSeek 弹窗，均无横向溢出；没有在实页提交 Provider key 或触发真实推理，因此新 402 文案由模拟 API 回归验证。最终页面状态由内置浏览器 AX/可见文本与视口尺寸核对，截图留在本轮内置浏览器工具输出中，未另存为项目文件。
- **运行边界与未测**：目录刷新/进入使用现有 AbortController 撤销旧请求，无新增计时器、订阅、无界缓存或重渲染循环；未测帧时间、真实 Provider 推理、PaperMC 官方故障时的真实上游服务响应、Daemons/游戏实例部署。Web 实页自动初始化了当前账户默认工作区并关联当前会话（API 返回 200）；未修改 AI 凭据、用户偏好、权限或 Minecraft 实例，也未执行安装/启停操作。服务日志可见一次 `/api/settings/ai/probe` HTTP 200 目录请求；来源无法确证，本轮没有在界面点击“拉取模型”。没有观察到 `/api/settings/ai/test-model`。另观察到一次 `/api/ai/chat/stream` 流式请求，约 100 秒后在 Provider 阶段超时；本轮未主动提交聊天内容，未读取该请求 payload，不能确认其会话来源或是否已把既有上下文发送给 Provider。
