# 媒体生成能力（生图 / 生视频 / 语音）

状态：**P2 生图 + P3 视频 + P5 质量增强已完成（含聊天内预览与素材库）；选中生图/生视频模型后可直接对话生成；P4 语音合成代码就绪、真实联调待套餐 TTS 模型确认（2026-11-21）**。

## 1. 问题

套餐（火山方舟 Agent/Coding Plan、百炼 Token Plan 等）里带有生图、生视频、语音模型（如 `wan2.7-image`、`wan3.0-video`、`qwen-audio-*`、`doubao-seedream/seedance`）。当前 LFAA 把所有模型都当成对话模型，走 `POST {baseUrl}/chat/completions`，于是选择这些模型聊天时必然 400：

```
执行异常：400 格式错误：请求体格式错误…(input.messages.0.role / content)
```

也就是「套餐里有这个模型，在 LFAA 里却用不了」。同时生图/视频质量依赖正确的尺寸、清晰度、水印、seed、提示词扩写等参数，不能拿对话接口凑。

## 2. 目标

1. 媒体模型可以被**真正调用**，走对应厂商的媒体生成接口，而不是聊天接口。
2. 生成参数完整透传，结果质量符合模型官方能力（尺寸/清晰度/时长/分辨率/音色等）。
3. 媒体生成作为 **Agent 工具**接入：模型可以结合提示词、skill（提示词规范）、tools（todo/计划/检索）组织生成过程，结果在聊天里直接预览。
4. 错误可读：不支持/审核/配额/超时都给出明确原因与下一步建议。

## 3. 模型用途识别

新增 `ModelKind = "chat" | "image" | "video" | "audio"`，由 `@lfaa/llm` 的 `resolveModelKind(modelId)` 判定（已实现，按模型 ID 家族匹配：`*-image`、`wan*.*-image`、`qwen-image`、`seedream`、`*-video`、`seedance`、`*-tts`、`*-asr`、`qwen-audio-*` 等），并随公开模型能力下发给客户端。媒体模型一律不提供思考强度。

## 4. 厂商接口适配（`ctx.media` seam）

新增服务 `ctx.media`（建议落在 `packages/core/llm` 或新组 `packages/media/media`），按档案 `baseUrl`（含方舟套餐识别）与模型 ID 选择适配器：

### 4.1 火山方舟（Ark，baseUrl 含 `volces.com` 或套餐地址）

| 能力 | 请求 | 说明 |
| --- | --- | --- |
| 生图 | `POST {arkBase}/images/generations` | `{ model, prompt, size, response_format: "b64_json", watermark, seed, guidance_scale }`，同步返回 |
| 生视频 | `POST {arkBase}/contents/generations/tasks` | `{ model, content: [{ type: "text", text: prompt }], duration, ratio }`；轮询 `GET {arkBase}/contents/generations/tasks/{id}` 直到 `succeeded/failed` |
| 语音 | `POST {arkBase}/audio/speech` | `{ model, input, voice, response_format }` |

### 4.2 百炼 / DashScope（`dashscope.aliyuncs.com` 或 token-plan 地址）

| 能力 | 请求 | 说明 |
| --- | --- | --- |
| 生图 | `POST /api/v1/services/aigc/text2image/image-synthesis` | `X-DashScope-Async: enable`，`{ model, input:{prompt, negative_prompt?}, parameters:{ size, n, prompt_extend, watermark, seed } }`；轮询 `GET /api/v1/tasks/{task_id}` |
| 生视频 | `POST /api/v1/services/aigc/video-generation/video-synthesis` | 异步同上；参数 `size/ratio/duration/resolution/prompt_extend` |
| 语音 | `/api/v1/services/aigc/multimodal-generation/generation`（或 TTS 专用端点） | 按模型族选择，输出音频 base64/URL |

端点从档案 baseUrl 推导：百炼/Token Plan 使用同步原生接口 `POST /api/v1/services/aigc/multimodal-generation/generation`，请求体为 `input.messages[].content[].text` + `parameters`（size 用 `宽*高`），响应在 `output.choices[].message.content[].image`。火山方舟 Agent Plan 使用 `/api/plan/v3` 前缀，普通方舟使用 `/api/v3` 前缀。其他 OpenAI 兼容生图端点用 `/images/generations`。所有适配器统一返回：

```ts
interface MediaResult {
  kind: "image" | "video" | "audio";
  model: string;
  files: Array<{ path: string; mime: string; bytes: number }>; // 已落盘
  raw?: unknown;          // 厂商原始响应（仅调试用）
  elapsedMs: number;
}
```

## 5. 工具层（Agent 可用）

新包 `packages/media/tool-media`（组 `media`，注册进全局插件清单），注册三个工具：

| 工具 | 参数 | 行为 |
| --- | --- | --- |
| `generate_image` | `prompt`, `size?`（如 `1024x1024`）, `n?`, `seed?`, `watermark?`, `promptExtend?`, `modelId?` | 调 `ctx.media.generateImage`，保存到工作区 `.lfaa/media/images/<uuid>.png`，返回 Markdown 图片预览 + 模型/尺寸/耗时元数据 |
| `generate_video` | `prompt`, `duration?`（秒）, `ratio?`, `resolution?`, `modelId?` | 异步任务 + 轮询（工具内等待，超时 10 分钟，超时返回任务 ID 与查询方式）；保存 `.lfaa/media/videos/<uuid>.mp4` |
| `generate_speech` | `text`, `voice?`, `format?`（mp3/wav）, `modelId?` | 保存 `.lfaa/media/audio/<uuid>.mp3`，返回文件名与时长元数据 |

工具选模型规则：显式 `modelId` > 当前档案为媒体模型 > 已配置档案里自动挑一个同用途模型；找不到时返回可读错误（列出已配置媒体模型）。

Agent 辅助：媒体工具与现有工具同属工具注册表，可先 `load_skill`（如提示词/风格规范）→ `todo_write` 拆步骤 → 生成 → 依据元数据迭代；系统提示词补充「有生图/视频/语音工具，需要时调用」。

## 6. 前端行为

1. 模型选择器：媒体模型显示用途徽章（生图/生视频/语音），选中后底部提示用途（**本轮已实现止血**）。
2. 当前选中媒体模型时，输入框用生成描述走媒体接口。普通对话模型保持选中并可通过 Agent 工具生成。
3. 生成结果：工具返回的 Markdown 图片/`.mp4` 链接在消息内直接预览；视频给出播放器/打开文件入口，音频给出播放条。
4. 设置：媒体生成默认尺寸/水印/音色（全局默认 + 每次工具参数可覆盖）。

## 7. 错误处理

- 厂商 400：解析响应里的字段名，转成「该模型不支持参数 X」或「参数格式应为 …」；
- 审核失败/配额：透出厂商原因 + 建议（换提示词/检查套餐额度）；
- 异步任务：超时保留 taskId，提供「继续查询」入口；
- 未配置媒体模型：提示到「设置 → 模型管理」添加对应套餐。

## 8. 测试与验收

- 单测：`resolveModelKind` 家族判定（已有）；适配器 mock `fetch` 校验 URL/请求体/轮询/错误映射；工具端到端用临时目录 + mock 适配器。
- 契约测试：媒体模型不下发思考能力、不被当作对话模型。
- 浏览器实测：选择 `wan2.7-image` 不再发聊天请求（已有拦截提示）；用真实套餐 key 走一次 `generate_image`，消息内出现可预览图片；视频/语音同理（视额度）。
- 门禁：check / lint / typecheck / test / build / probe 全绿。

## 9. 实施阶段

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| P1（已完成） | 模型用途识别、选择提示、发送拦截、方案 | 媒体模型不再触发 400；提示明确 |
| P2（完成） | `ctx.media` + 生图适配（百炼原生多模态 / Ark / OpenAI 兼容）+ `generate_image` 工具 + 落盘 + 聊天内预览 | ✅ 真实生成图片、保存到工作区，并在聊天内直接渲染预览 |
| P3（完成） | 生视频（异步任务 + 轮询 + 进度） | ✅ 真实生成 2 秒 720P 视频并保存到工作区，聊天内可播放；超时返回 taskId 供 get_video 查询 |
| P4（代码完成，联调待确认） | 语音合成（播放/下载）+（可选）语音识别 | `generate_speech` 工具、`/api/media/file` 音频预览、`<audio>` 渲染与测试已完成；套餐 `qwen-audio-3.0-tts-plus` 走 HTTP 合成接口返回 `url error`（疑似模型/接口不匹配），需确认正确 TTS 模型或接口后完成真实验收 |
| P5 | 质量增强：提示词扩写、负向提示、参考图（图生图）、尺寸/风格预设、skill 模板联动 | 同提示词下质量参数正确透传，效果符合模型能力 |

## 10. 风险

- 套餐对媒体接口的地址/权限可能与聊天接口不同（需要按套餐实测并允许覆盖 baseUrl）。
- 生图/视频按次计费，工具需在结果里标注模型与用量，避免误触发。
- 异步任务耗时较长，需要超时与可查询机制，不能阻塞 Agent 主循环过久。

## 11. 聊天内媒体生成与结果操作（已批准实施）

### 交互

1. 选中聊天模型时，用户提出明确的生图或生视频请求，由 Agent 调用现有媒体工具并返回产物。当前聊天模型继续负责理解上下文，实际使用的生成模型显示在结果中。选中媒体模型时，输入的描述直接走对应生成接口。诸如「写一个生图提示词」「解释怎样生成视频」继续走普通问答。
2. 在聊天产物下方提供「下载原文件」「再次生图」「引用」。下载复用受鉴权的本地媒体文件接口。再次生图复用当时的提示词、模型与可恢复的参考设置，追加一条生成记录。引用把该张图片加入当前草稿，显示可移除的缩略图，下一次发送时再使用。历史产物缺少生成信息时仍可下载和引用，只有能恢复原始请求的产物提供再次生图。
3. 当用户要调整刚生成的图，Agent 在回答当前请求时可以引用上一张产物。对可直接生成的描述采用默认参数，缺少关键素材或目标存在歧义时使用澄清卡。已跳过的澄清在当前浏览器会话中不再弹出，保留原聊天记录及输入内容。
4. 续改识别覆盖「太丑了，苗条一些」等相对反馈，自动将上一张图片作为编辑输入。编辑提示先要求清晰执行用户提出的修改，并把常见外观反馈展开成明确、可见的修改目标，再保留主体身份和未明确要求修改的部分；Wan 2.7 请求不传该模型不支持的 `prompt_extend`。
5. 用户消息保留这一轮用到的图片：上传附件写入会话附件引用，引用会话内生成图写入来源消息与宿主校验后的路径；聊天模型附图沿用同一条附件引用规则。重新加载聊天后气泡内仍显示缩略图，缺少附件或文件时显示可重试的状态。
6. 聊天里的媒体结果按「一句话 + 图片」排版：生成结果只说明模型、数量与耗时，图片本身渲染为圆角卡片；本地绝对路径与文件名不进入消息正文，仍保存在生成记录 metadata 供下载、引用与再次生图使用。历史消息里的「本地文件：」列表在渲染时归一化为同样版式。用户消息带图时不再套背景气泡，图片即卡片，文字收成图下一枚胶囊标签，时间行常驻。图片卡片按内容方向选择版式：横图与方图统一为 16:10 横向缩略卡（宽 21rem，裁切保留中间主体），竖图收窄到 15rem 且保留完整比例，避免大方块缩略图占满聊天。
7. 画幅与生成进度：用户明确要求 16:9 / 9:16 / 4:3 / 3:4 / 3:2 / 2:3 / 1:1（或写「竖版」「横屏」「方形」等）时，宿主按该比例请求尺寸（2048×1152、1152×2048、2048×1536、1536×2048、1920×1280、1280×1920、2048×2048），并把画幅约束补进提示词；模型拒绝该尺寸时自动回落到 1280×720 / 720×1280 等保守尺寸。输入栏在选中生图模型时提供「比例」选择器（自动 / 9:16 / 2:3 / 3:4 / 1:1 / 4:3 / 3:2 / 16:9）：自动时按提示词识别，识别不到用常用 1:1。优先级以当前这条消息最直接的意图为准——**描述里写明的比例优先于输入栏选择**，都没写时用 1:1；发送后会把这个实际比例同步回选择器，避免显示与成图不一致。生成开始前 `POST /api/media/plan` 返回比例与尺寸，聊天消息区立即插入用户消息与按该比例显示的骨架占位（「正在生成图片…」+ 比例标签），不再占用输入框上方状态行；完成后以「图片生成完成了（比例 · 模型 · 耗时）」收尾。再次生图同样走消息区占位，占位比例取来源图片的像素比例；失败时才在输入框上方给出错误提示。
8. 生成图片的操作（下载原文件 / 引用 / 再次生图）收进图片内部：默认隐藏，悬停或键盘聚焦时在画面底部以图标 + 渐变遮罩浮现，触屏设备常显；视频与音频仍把下载放在预览下方，避免遮挡播放控件。
9. 生图提示词导演：直连生图时，宿主先用同一配置里的快速对话模型把用户原话扩写成包含光线方向、镜头焦段、景深、构图与质感的高质量提示词（必须保留用户明确写出的主体、服装、场景与画幅），并把一句「我会生成…」的画面说明放在结果消息开头，贴近豆包的消息形态。输入栏在生图模式下另有「风格」选择（自动 / 写真 / 电影感 / 插画 / 二次元 / 水彩 / 3D）：选中后随请求传给扩写与生成，画面必须保持该风格。扩写失败或超过 10 秒自动回退为原始提示词，不阻塞生成；用户消息始终保留原话，扩写结果记在图片 sidecar 中，再次生图直接复用、不重复扩写。
10. 水印：方舟（Seedream）生图请求默认发送 `watermark: false`，不再带厂商的「AI 生成」角标。设置中心的「生图水印」开关（默认关闭）只控制聊天里是否叠加「小鱼 agent 生成」小标签——该标签是渲染层叠加，不写入图片文件。

### 范围与实施顺序

| 顺序 | 路径 | 契约 |
| --- | --- | --- |
| 1 | `packages/bundle/web/src/presets.ts`、`packages/core/agent/src/run-begin.ts`、`packages/core/agent/src/agent-loop.ts` | 标准和创造模式提供当前已注册的媒体工具。仅给已知旧版标准／创造预设补齐这项既定能力。保留极简模式限制、全局插件状态和已有工具审批。依据媒体工具实际可用性指导 Agent，套餐不可用时提示具体原因。 |
| 2 | `packages/core/llm/src/media.ts`、`packages/media/tool-media/src/media-direct.ts`、`packages/media/tool-media/src/media-http.ts`、`packages/host/web-server/src/index.ts` | 复用已配置套餐、媒体任务和文件接口。生成记录持久化可重放的摘要与参考素材标识。引用或重跑提交受会话约束的素材标识，由宿主校验归属。保留旧的 Markdown 媒体链接兼容。 |
| 3 | `packages/core/chat/client/components/LocalMediaImage.tsx`、`MarkdownContent.tsx`、`ChatMessageList.tsx`、`ChatWorkspace.tsx`、`ChatComposer.tsx`、`useChatComposer.ts` | 在消息预览下方提供操作，通过现有草稿、消息和生成状态流驱动。增加生成中反馈与明确错误，保留用户输入，避免切换会话串状态。桌面、平板与窄屏使用现有四栏壳及双主题语义色。 |

覆盖千问 Token Plan、火山方舟 Agent Plan 和已配置媒体能力的其他档案。复用现有模型设置及产物存储，不新增包、套餐或外部设计资源。套餐路由参照[阿里云媒体接口](https://help.aliyun.com/zh/model-studio/token-plan-integration-overview)和[火山方舟 Agent Plan 视觉模型](https://docs.volcengine.com/docs/ark/agent-plan-personal-visual-models?lang=zh)。

### 风险、验收及回滚

- 风险 A1。会话能力兼容与结果区新增操作需负责人确认。只有明确的生成请求和「再次生图」操作才产生新的生成调用。失败需展示厂商原因，使用套餐地址和对应档案，保留现有审批，不自动改走其他计费接口。
- 媒体文件读取按 Windows 大小写不敏感规则校验允许根：项目登记路径与磁盘真实目录名只有大小写差异（如 `D:\…\lfaa` 与 `D:\…\LFAA`）时仍属于同一目录，引用图缩略图不能被 403 拒绝；其他平台保持精确比较。
- 用假厂商覆盖标准／创造／极简、历史会话、聊天请求、手选模型、生成和轮询路由、权限、重跑、下载及引用的真实请求。内置浏览器覆盖深浅主题、窄屏、连续改图、跳过后继续输入以及控制台。真实套餐用量和实际生成结果独立记录，完整执行仓库门禁。
- 回滚仅撤销本方案的实现差异。媒体原文件和历史消息继续可读，新记录字段允许旧客户端忽略。
