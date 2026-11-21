---
description: "Media generation tools: generate and save images, videos, and speech using configured models."
kind: "package"
---

# @lfaa/tool-media

Exposes image, video, and speech generation to the agent and the chat composer.

| Surface | Purpose |
| --- | --- |
| `generate_image` tool | `prompt` (required), `size`, `n`, `seed`, `watermark`, `negativePrompt`, `modelId`, `profileId` |
| `generate_video` / `get_video` | Submit a video task, poll its status, and save the result |
| `generate_speech` | Generate and save speech |
| `ctx.llm.generateImage` | Host-side generation: picks a plan image model, calls the vendor image endpoint, returns base64/URL |
| Output | Files saved to `<workspace>/.lfaa-media/images/<uuid>.png` (or `~/.lfaa/media/images` when no workspace), plus model and elapsed time |

## Model selection

Explicit `profileId`/`modelId` wins; otherwise the active profile if it holds an image model, else the first configured profile with an image model. Missing configuration produces a readable error pointing to Settings → Model management.

## Chat results

Generated media is available for preview and download. Images with recoverable settings can be regenerated, and images in the current chat can be used as references. Generation failures report the provider reason when available. When a direct image-generation request includes uploaded image attachments, the user message retains their session-scoped references in chat history.

Relative image refinements, such as “make it slimmer,” reuse the latest image in the chat. Common appearance requests are expanded into visible edit targets while keeping the referenced subject and other unmentioned details.
