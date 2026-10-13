# AI 漫剧大模型图片生成合同

## 目标与运行入口

为 AI 漫剧已有分镜画布接入真实大模型出图。用户在设置中心选择已保存的 OpenAI 或豆包/火山方舟模型账户和该账户模型目录中的图片模型 ID；在镜头卡片填写画面描述并点击“生成图片”。后端向所选服务商的固定官方 Images API 发送一次请求，生成图片回到画布并保存在本机对应漫剧项目文件夹。每张镜头仅保留一个当前生成图，重生成替换旧图。

## Owner、配置与数据

- Provider 请求协议归 `packages/llm/llm`；只允许 `openai` 和 `doubao` 两个已确认服务商及其固定 HTTPS 官方接口，不接受客户端 endpoint、任意 URL、模型能力猜测或静默换模型。
- 加密 API Key 仍由 Settings/Credentials Owner 持有；为 `lfaa-ai-video` 登记读取已保存 AI 账户凭据的明确消费资格。服务端按当前用户、账户 ID、允许的 Provider、保存的模型目录及 AI 漫剧设置重新校验，密钥不离开后端。
- 图像账户 ID、图片模型 ID 复用现有 `ai-runtime` 账户设置和设置页面；仅允许 OpenAI/豆包账户。沿用 `requestTimeoutSeconds`、外观主题/字体/字号/颜色/对比度和 `reducedMotion`；不增设 API Key 表单、Provider URL、外观配置或权限流程，不覆盖已有用户值。
- `packages/video/ai-video` 是唯一项目与素材 Owner；图片二进制放在 `<LFAA_DATA_DIR>/users/<账户 SHA-256>/projects/aivideo/<项目 UUID>/assets/`，`project.json` 仅保存素材 ID 与 MIME 类型，不接受客户端磁盘路径。复用 UUID 路径边界、符号链接拒绝、私有目录保护、`atomicWriteBytes`、`atomicWrite`、写锁和账户隔离。
- 图片响应限制为可识别的 PNG/JPEG/WebP 且单图有界；按账户累计素材总量有上限。模型请求失败、响应过大/格式错误、账户删除、项目更新冲突或本地写入失败时返回真实错误，不显示成功占位图；新文件未能登记进项目时清理未引用文件。删除项目时继续删除该项目目录及素材。
- 图片提示词仅取已保存镜头的画面与动作描述。画布有未保存改动时禁用生成，避免把屏幕上未持久化文本误当成项目内容。镜头描述明确标为出图提示词。

## 修改范围

允许修改：`packages/util/values/src/settings-contract.ts`、`packages/settings/settings/src/service.ts` 与校验、Settings 凭据消费登记、`packages/client/ui-settings/src/SettingsPage.tsx`、`packages/llm/llm`、AI Video Owner/Controller/Client Connection/UI、相应 package manifest/Bundle 登记、三个受影响 README、`docs/系统总体架构.md`、`docs/开发计划.md`、`docs/PROMPTS.md` 与本合同。

禁止：连接 ComfyUI 或伪造图片/成功状态；把密钥、任意文件路径或 Provider 请求细节交给浏览器；任意 URL/SSRF、硬编码默认模型替代用户选择、失败后自动换服务商/模型、调用聊天文本模型冒充图片生成；触碰 Writing 或其他既有未提交改动；重启服务、实际触发计费的 Provider 请求、提交或发布。

## 验收与证据

1. 设置中心能选择当前用户保存的 OpenAI/豆包账户及模型目录模型；其他 Provider、无效模型、缺失密钥或其他账户账户 ID 在服务端失败关闭。
2. 镜头卡片只在显式点击后调用图像生成 API；状态、成功图片和错误来自真实后端响应。
3. 生成图片经尺寸与签名校验、原子写入项目 assets，并在项目 JSON 保存引用；HTTP 图片读取认证并限定在当前用户项目、目标镜头实际引用的素材。更新或删除时不会误删别的项目/账户资产；并发版本不匹配时拒绝登记。
4. 运行直接相关包构建、CLI 类型检查、工作区 Gate、静态路径/认证/所有权核查和差异检查。按上级开发指令，本轮不新增或运行测试。
5. 本轮不发送真实 Provider 请求，不触发用户费用；因此模型是否具备图像生成权限、区域/额度/计费、真实图片生成结果、浏览器/桌面呈现和运行中服务加载均须明确标为未验。

## 本轮实施记录

- 已接通设置中心的 OpenAI/豆包账户和模型选择、LLM 官方图像 API、认证后端、逐项目本地素材持久化、素材读取及画布生成/重生成操作。
- `pnpm run typecheck`、8 个直接相关包构建、`pnpm run build:web`、`pnpm run build:control-plane`、`pnpm run check:workspace`、`git diff --check` 均通过；本轮没有运行测试。
- 未向 OpenAI 或火山方舟发送真实请求，未重启服务；当前运行服务加载、模型账户权限/额度、真实图片结果及浏览器/桌面交互未验。
