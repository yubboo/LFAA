---
description: "媒体生成工具：用已配置模型生成并保存图片、视频和语音。"
kind: "package"
---

# @lfaa/tool-media

为 Agent 和聊天输入框提供生图、生视频和语音合成。

| 入口 | 作用 |
| --- | --- |
| `generate_image` 工具 | `prompt`（必填）、`size`、`n`、`seed`、`watermark`、`negativePrompt`、`modelId`、`profileId` |
| `generate_video` / `get_video` | 提交视频任务、轮询状态并保存结果 |
| `generate_speech` | 合成语音并保存 |
| `ctx.llm.generateImage` | Host 侧生成：自动选择套餐生图模型，调用厂商图片接口并返回 base64/URL |
| 输出 | 图片保存到 `<工作区>/.lfaa-media/images/<uuid>.png`（未绑定工作区时为 `~/.lfaa/media/images`），并返回模型与耗时 |

## 模型选择

显式 `profileId`/`modelId` 优先；否则当前档案若含生图模型则用它，再否则取第一个含生图模型的档案。没有配置时给出可读错误，指向「设置 → 模型管理」。

## 聊天产物

生成素材支持预览和下载。能够恢复原参数的图片可以再次生成，也可引用当前会话中的图片。生成失败时展示可取得的厂商原因。媒体直连生图请求包含上传图片时，用户消息会保留这些会话附件引用，并在聊天历史中继续展示。

「太丑了，苗条一些」等相对改图要求会自动引用当前会话最近生成的图片，并展开为明确、可见的外观修改目标；编辑保留原图主体和未提及的画面细节。
