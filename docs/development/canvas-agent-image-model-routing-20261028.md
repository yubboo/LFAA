# LFAA 画布 Agent 图片模型发现与选择（2026-10-28）

<a id="lfaa-canvas-agent-image-model-routing-20261028"></a>

## 目标、Owner 与现状

- 用户问题：已配置火山方舟 Agent Plan 席位及官方图像模型，但小鱼不知道如何发现/选择，画布生成却被共享的本机生图模式拦截，报本机 MOSS 未接通。
- 目标：让画布 Agent 可读取当前账户真实可用的图片模型选项，并在单次画布生成中选择账户/模型；未指定时继续使用设置中心的默认远程图片账户/模型。Agent Plan 只允许目录中登记的 `taskType=image-generation` 且与套餐档位匹配的模型。
- Owner：`packages/settings/settings` 拥有账户、模型目录、套餐档位与设置持久化；`packages/credentials/credentials` 拥有凭据解析；`packages/llm/llm` 拥有实际 Provider 协议；`packages/canvas/canvas-generation` 拥有画布生成目标校验与生成编排；`packages/canvas/tool-canvas` 拥有模型可见工具合同；`packages/client/ui-settings` 拥有 AI 与模型的设置呈现；`packages/api/canvas-controller` 负责认证、参数校验与服务端错误映射；项目与素材仍归 Canvas Owner。
- 设置盘点：复用 `aiRuntime.imageGenerationMode`（默认 `provider`）、`imageGenerationAccountId` / `imageGenerationModelId`（默认空）、`imageGenerationLocalModelId`（默认空）、`requestTimeoutSeconds`。Settings Owner 持久化并按账户隔离，客户端在 AI 与模型页映射；本任务不新增/重置偏好。画布按其已接通能力使用远程 Provider；本机/远程引擎模式只控制 AI 漫剧生成。Agent 的单次账户/模型选择不写回设置。
- 数据与权限：目录工具只返回当前账户可用的账户/模型标识与公开能力元数据，不含密钥或本机路径。生成仍绑定当前 App/账户/项目，参考素材只从当前项目读取；写入继续走 Canvas Owner 的 `expectedUpdatedAt`。模型生成保持 `dangerous` 风险并使用唯一 Permission Owner；目录读取为只读。

## 范围与验收

- 允许：新增只读的画布图片模型目录工具；给 `canvas_generate_image` 增加可选的账户/模型目标；在生成 Owner 验证账户归属、模型目录、Agent Plan 图像任务类型和档位后，通过 LLM Owner 请求服务商；解释设置页中 AI 漫剧引擎与画布远程模型选择的不同作用。
- 禁止：根据模型名猜测能力或档位；自动换账户/模型或修改用户默认偏好；绕开密钥 Owner、用户账户范围、Permission Owner、项目素材边界或并发校验；新增本机 MOSS 画布适配或假生成结果。
- 默认目标：如果 Agent 未传单次目标，使用设置中心 `imageGenerationAccountId` / `imageGenerationModelId`；画布不会因 AI 漫剧选择本机模式而报 MOSS 未接通。若默认远程目标缺失，Agent 可先读取目录，并且只在模型有真实选择依据时使用列出的账户/模型；没有可用候选或目标无效时明确报告设置问题。
- 验收：工具返回当前用户有权使用的已配置 Agent Plan 图像模型，隐藏密钥；显式选择必须是同一用户账户真实模型目录项，Plan 还须通过图像任务类型和套餐档位校验；不写回用户设置；无效/越权选择不发起 Provider 请求；运行受影响包的构建/类型检查与差异检查。界面改动须先构建并在 ChatGPT 内置浏览器对正式路由验收，覆盖桌面及窄/短视口；真实计费 Provider 请求只在用户另行要求时进行。

## 实施与验收记录

- 已实施：`canvas-generation` 新增不含凭据的图片模型目录与单次目标校验；画布 Agent 新增 `canvas_list_image_models`，并可把目录选项传给 `canvas_generate_image`；Control Plane 严格校验目标结构；Settings Owner 校验所选图片账户、模型目录与 Agent Plan 档位；设置页始终展示远程默认图片账户/模型，明确该 `imageGenerationMode` 仅控制 AI 漫剧。本轮没有修改用户账户、模型选择或默认设置。
- 变更文件与职责：`packages/canvas/canvas-generation/src/index.ts`（目录与生成 Owner）；`packages/canvas/tool-canvas/src/index.ts`（Agent 工具合同）；`packages/api/canvas-controller/src/index.ts`（认证 API 参数边界）；`packages/settings/settings/src/agent-settings.ts`（Agent 设置写入校验）；`packages/client/ui-settings/src/SettingsPage.tsx`（设置呈现）；上述 5 个包的 `README.md`（Owner/合同说明）；`docs/系统总体架构.md`（系统能力边界）；`docs/PROMPTS.md` 与本合同（任务登记/验收记录）。
- 构建与静态核对：`pnpm run typecheck`、`pnpm run build:control-plane`、`pnpm run build:web` 通过；`packages/canvas/canvas-generation`、`packages/canvas/tool-canvas`、`packages/api/canvas-controller`、`packages/settings/settings`、`packages/client/ui-settings` 的包构建通过；`git diff --check` 通过；`node scripts/runtime-build-state.mjs web` 与 `host` 均返回 `[]`。当前 Web 重启后 `/api/health` 返回 `status=ok`、`persistence=ready`。
- 正式 Web 实页：ChatGPT 内置浏览器在 `/settings?section=ai` 验收；桌面默认视口实测 1423×1244，确认 AI Plan Provider 已配置、个人 Agent Plan 目录公开列出 Seedream 5.0 Pro/Flash 图像能力；图片模型账户下拉列出“我的火山方舟 Agent Plan”。420×800 手机视口确认远程账户/模型选择控件纵向可达，无可见横向溢出；820×900 窄分栏也完成实页查看。只展开并关闭了账户下拉，没有选择账户、保存设置或生成图片；临时视口已恢复。
- 未实测：没有通过 Agent 实际调用 `canvas_list_image_models`，没有发起文本模型或图片 Provider 请求，也没有计费生图；因此模型目录实际工具返回与最终 Provider 生图成功率仍未端到端证明。真实图片生成仍需要用户已保存有效凭据、Plan 当前套餐/档位可用，并由 Permission Owner 按账户权限模式处理。
