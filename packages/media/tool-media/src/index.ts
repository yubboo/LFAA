// @lfaa/tool-media：把套餐里的生图模型包装成 generate_image 工具，生成图片保存到工作区并返回路径。
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import { buildMediaFileUrl, writeMediaMetadata } from "./media-http";
import { fallbackImageSize, resolveImagePlan } from "./image-ratio";
export { buildMediaFileUrl, createMediaHttpHandler, createMediaLibraryHttpHandler, findSessionImagePath, mediaMetadataPath } from "./media-http";
export { createMediaThumbHttpHandler, mediaThumbCacheName, type MediaThumbHttpOptions } from "./media-thumb";
export { createMediaGenerateHttpHandler, createMediaPlanHttpHandler, isRefinementPrompt, type MediaGenerateOptions, type MediaSource } from "./media-direct";
export {
  DEFAULT_IMAGE_RATIO, buildRatioHint, detectImageRatio, fallbackImageSize, resolveImagePlan, sizeToRatio,
  type ImageAspectRatio, type ImagePlan,
} from "./image-ratio";
import "@lfaa/tools";
import "@lfaa/llm";

/** 生图工具的入参。 */
export interface GenerateImageArgs {
  prompt: string;
  style?: string;
  size?: string;
  n?: number;
  seed?: number;
  watermark?: boolean;
  negativePrompt?: string;
  modelId?: string;
  profileId?: string;
}

/** 生成结果：落盘文件与模型信息。 */
export interface GeneratedImageFile {
  path: string;
  bytes: number;
}

/** 选择输出目录：优先当前工作区，未绑定工作区时放 ~/.lfaa/media。 */
export function resolveMediaOutputDir(workspaceRoots: readonly string[], kind = "images"): string {
  const root = workspaceRoots[0]?.trim();
  return root ? join(root, ".lfaa-media", kind) : join(homedir(), ".lfaa", "media", kind);
}

/** 把图片字写入输出目录，返回文件路径与大小。 */
export async function saveImageBytes(dir: string, bytes: Buffer, mime = "image/png"): Promise<GeneratedImageFile> {
  if (bytes.length === 0) throw new Error("生图接口返回的图片数据为空。");
  await mkdir(dir, { recursive: true });
  const ext = mime.includes("jpeg") ? "jpg"
    : mime.includes("webp") ? "webp"
      : mime.includes("mp4") ? "mp4"
        : mime.includes("webm") ? "webm"
          : mime.includes("mpeg") || mime.includes("mp3") ? "mp3"
            : "png";
  const path = join(dir, `${randomUUID()}.${ext}`);
  await writeFile(path, bytes);
  return { path, bytes: bytes.length };
}

/** 把 base64 图片写入输出目录，返回文件路径与大小。 */
export async function saveBase64Image(dir: string, b64: string, mime = "image/png"): Promise<GeneratedImageFile> {
  return saveImageBytes(dir, Buffer.from(b64, "base64"), mime);
}

/** 下载厂商返回的临时图片 URL 并落盘；失败时返回 undefined（由调用方回退成链接）。 */
export async function downloadImage(url: string): Promise<{ bytes: Buffer; mime: string } | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return undefined;
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    return { bytes: Buffer.from(await response.arrayBuffer()), mime };
  } catch {
    return undefined;
  }
}

/** 媒体工具插件：注册 generate_image；依赖工具注册表与模型服务。 */
export function mediaToolsPlugin(ctx: Context): void {
  ctx.effect(() => {
    const dispose = ctx.tools.registerTool({
      moduleName: "@lfaa/tool-media",
      name: "generate_image",
      title: "生成图片",
      description: "调用已配置套餐里的生图模型生成图片并保存到工作区；传 referenceImages 时按参考图做图生图/编辑。prompt 里出现 16:9、9:16、4:3、3:4、竖版、横屏、方形等比例要求时会自动按该比例生成；未指定时用常用比例 1:1。参数：prompt（必填）、referenceImages（本地路径或 URL 数组）、style、size（如 1024x1024，显式给定时优先）、n、seed、watermark、negativePrompt、modelId、profileId。结果里的 ![](...) 预览链接请原样保留在回复中，用户就能直接看到图片。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "生图提示词，描述画面主体、风格、光线、构图等" },
          style: { type: "string", description: "风格预设：cinematic 电影感 / photo 摄影 / illustration 插画 / anime 动画 / 3d / watercolor 水彩" },
          referenceImages: { type: "array", items: { type: "string" }, description: "参考图（图生图/编辑）：本地绝对路径或 http(s) URL，最多 3 张，用于按参考图改风格/改内容" },
          size: { type: "string", description: "图片尺寸，如 1024x1024 / 1280x720；用户明确要求比例时以 ratio 为准" },
          ratio: { type: "string", enum: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], description: "画幅比例；用户在输入栏或描述里明确要求时填写，未要求则留空" },
          n: { type: "number", description: "生成张数，1-4" },
          seed: { type: "number", description: "随机种子，复现同一画面时使用" },
          watermark: { type: "boolean", description: "是否带水印（默认按厂商默认）" },
          negativePrompt: { type: "string", description: "不希望出现的元素" },
          modelId: { type: "string", description: "指定生图模型 ID（默认用当前/第一个生图模型）" },
          profileId: { type: "string", description: "指定模型配置 ID（默认自动选择）" },
        },
        required: ["prompt"],
      },
      execute: async (args, context) => {
        const prompt = String(args.prompt ?? "").trim();
        if (!prompt) return { ok: false, output: "缺少生图提示词 prompt。", summary: "缺少 prompt" };
        // 画幅：输入栏或提示词明确要求比例就照做（尺寸 + 构图提示），没说就沿用常用默认比例。
        const requestedRatio = typeof args.ratio === "string" ? args.ratio.trim() : "";
        const plan = resolveImagePlan(prompt, requestedRatio);
        const explicitSize = typeof args.size === "string" ? args.size.trim() : "";
        // 用户明确说了比例时以比例为准（Agent 传入的 size 不覆盖用户要求）；否则 size 参数优先。
        const size = plan.explicit ? plan.size : (explicitSize || plan.size);
        const requestPrompt = plan.explicit && plan.hint ? `${prompt}\n\n${plan.hint}` : prompt;
        const negativePrompt = typeof args.negativePrompt === "string" ? args.negativePrompt.trim() : undefined;
        const style = typeof args.style === "string" ? args.style.trim() : "";
        const referenceImages = Array.isArray(args.referenceImages)
          ? args.referenceImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
          : [];
        const request = {
          prompt: requestPrompt,
          ...(style ? { style } : {}),
          ...(referenceImages.length > 0 ? { referenceImages } : {}),
          ...(size ? { size } : {}),
          ...(typeof args.n === "number" ? { n: args.n } : {}),
          ...(typeof args.seed === "number" ? { seed: args.seed } : {}),
          ...(typeof args.watermark === "boolean" ? { watermark: args.watermark } : {}),
          ...(negativePrompt ? { negativePrompt } : {}),
          ...(typeof args.modelId === "string" && args.modelId.trim() ? { modelId: args.modelId.trim() } : {}),
          ...(typeof args.profileId === "string" && args.profileId.trim() ? { profileId: args.profileId.trim() } : {}),
        };
        let result;
        try {
          result = await ctx.llm.generateImage(request);
        } catch (error) {
          // 个别模型只接受固定分辨率：尺寸被拒时改用该比例的保守尺寸重试一次，比例仍保持不变。
          const message = error instanceof Error ? error.message : String(error);
          if (!size || !/size|尺寸|分辨率|resolution|dimension|parameter|参数|width|height/iu.test(message)) throw error;
          result = await ctx.llm.generateImage({ ...request, size: fallbackImageSize(plan.ratio) });
        }
        const replayPaths = referenceImages.filter((reference) => !reference.startsWith("data:"));
        const replayAttachments = Array.isArray(args.replayAttachmentIds)
          ? args.replayAttachmentIds.filter((id): id is string => typeof id === "string").slice(0, 3) : [];
        const canReplay = replayPaths.length + replayAttachments.length === referenceImages.length;
        const dir = resolveMediaOutputDir(context.workspaceRoots);
        const saved: GeneratedImageFile[] = [];
        const urls: string[] = [];
        for (const image of result.images) {
          let file: GeneratedImageFile | undefined;
          if (image.b64) {
            file = await saveBase64Image(dir, image.b64, image.mime);
          } else if (image.url) {
            // 厂商返回的是 24 小时内有效的临时 URL：立即下载落盘，失败时保留链接提示。
            const downloaded = await downloadImage(image.url);
            if (downloaded) file = await saveImageBytes(dir, downloaded.bytes, downloaded.mime);
            else urls.push(image.url);
          }
          if (file) {
            saved.push(file);
            await writeMediaMetadata(file.path, {
              kind: "image",
              prompt,
              model: result.model,
              extra: {
                size: size ?? "",
                ...(style ? { style } : {}),
                ...(referenceImages.length > 0 ? { referenceImages: referenceImages.length } : {}),
                ...(canReplay ? { replay: {
                  ...(result.profileId ? { profileId: result.profileId } : {}),
                  ...(typeof args.n === "number" ? { n: args.n } : {}),
                  ...(typeof args.watermark === "boolean" ? { watermark: args.watermark } : {}),
                  ...(negativePrompt ? { negativePrompt } : {}),
                  ...(replayPaths.length ? { replayPaths } : {}),
                  ...(replayAttachments.length ? { attachmentIds: replayAttachments } : {}),
                } } : {}),
              },
            });
          }
        }
        if (saved.length === 0 && urls.length === 0) {
          return { ok: false, output: "生图接口没有返回可保存的图片。", summary: "没有图片" };
        }
        // 结果正文按「完成提示 → 图片」排版：图片本身会渲染成卡片，路径与文件名留在 metadata 里。
        const total = saved.length + urls.length;
        const seconds = Math.round(result.elapsedMs / 1000);
        const lines = [
          total > 1
            ? `图片生成完成了，共 ${total} 张（${plan.ratio} · ${result.model} · 耗时 ${seconds} 秒）。`
            : `图片生成完成了（${plan.ratio} · ${result.model} · 耗时 ${seconds} 秒）。`,
          ...saved.map((file) => `![${result.model} 生成图片](${buildMediaFileUrl(file.path)})`),
          ...urls.map((url) => `临时链接（24 小时内有效）：${url}`),
        ];
        return {
          ok: true,
          output: lines.join("\n\n"),
          summary: `${total} 张图片`,
          metadata: {
            model: result.model,
            ratio: plan.ratio,
            files: saved.map((file) => file.path),
            ...(urls.length > 0 ? { urls } : {}),
          },
        };
      },
    });
    const disposeVideo = ctx.tools.registerTool({
      moduleName: "@lfaa/tool-media",
      name: "generate_video",
      title: "生成视频",
      description: "调用已配置套餐里的视频模型生成短视频并保存到工作区。参数：prompt（必填）、duration（秒，2-15）、resolution（720P/1080P）、ratio、seed、watermark、negativePrompt、modelId、profileId、waitSeconds（默认 240）。结果里的 ![](...) 预览链接请原样保留在回复中。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "视频提示词：画面、镜头、动作、风格" },
          duration: { type: "number", description: "时长（秒），2-15，默认 2，按秒计费" },
          resolution: { type: "string", description: "720P 或 1080P，默认 720P" },
          ratio: { type: "string", description: "16:9 / 9:16 / 1:1 / 4:3 / 3:4" },
          seed: { type: "number", description: "随机种子" },
          watermark: { type: "boolean", description: "是否加水印" },
          negativePrompt: { type: "string", description: "不希望出现的内容" },
          modelId: { type: "string", description: "指定视频模型 ID" },
          profileId: { type: "string", description: "指定模型配置 ID" },
          waitSeconds: { type: "number", description: "轮询等待秒数，默认 240；超时返回 taskId 供 get_video 查询" },
        },
        required: ["prompt"],
      },
      execute: async (args, context) => {
        const prompt = String(args.prompt ?? "").trim();
        if (!prompt) return { ok: false, output: "缺少视频提示词 prompt。", summary: "缺少 prompt" };
        const waitSeconds = typeof args.waitSeconds === "number" ? Math.max(10, Math.min(args.waitSeconds, 900)) : 240;
        const result = await ctx.llm.generateVideo({
          prompt,
          ...(typeof args.duration === "number" ? { duration: args.duration } : {}),
          ...(typeof args.resolution === "string" ? { resolution: args.resolution } : {}),
          ...(typeof args.ratio === "string" ? { ratio: args.ratio } : {}),
          ...(typeof args.seed === "number" ? { seed: args.seed } : {}),
          ...(typeof args.watermark === "boolean" ? { watermark: args.watermark } : {}),
          ...(typeof args.negativePrompt === "string" && args.negativePrompt.trim() ? { negativePrompt: args.negativePrompt.trim() } : {}),
          ...(typeof args.modelId === "string" && args.modelId.trim() ? { modelId: args.modelId.trim() } : {}),
          ...(typeof args.profileId === "string" && args.profileId.trim() ? { profileId: args.profileId.trim() } : {}),
          waitMs: waitSeconds * 1000,
        });
        if (result.status === "FAILED" || result.status === "CANCELED" || result.status === "UNKNOWN") {
          return { ok: false, output: `视频生成失败（${result.status}）：${result.message ?? "厂商未返回原因"}`, summary: "视频生成失败", metadata: { taskId: result.taskId } };
        }
        if (!result.videoUrl) {
          return {
            ok: true,
            output: `视频任务已提交（taskId=${result.taskId}），当前状态 ${result.status}，仍在生成中。稍后用 get_video 工具按 taskId 查询。`,
            summary: "视频生成中",
            metadata: { taskId: result.taskId, status: result.status },
          };
        }
        const dir = resolveMediaOutputDir(context.workspaceRoots, "videos");
        const downloaded = await downloadImage(result.videoUrl);
        if (!downloaded) {
          return { ok: true, output: `视频已生成（临时链接 24 小时有效）：${result.videoUrl}`, summary: "视频生成完成（未落盘）" };
        }
        const saved = await saveImageBytes(dir, downloaded.bytes, "video/mp4");
        await writeMediaMetadata(saved.path, { kind: "video", prompt, model: result.model });
        return {
          ok: true,
          output: `已用 ${result.model} 生成视频（耗时 ${Math.round(result.elapsedMs / 1000)} 秒）。\n\n![${result.model} 生成视频](${buildMediaFileUrl(saved.path)})`,
          summary: "1 个视频",
          metadata: { model: result.model, files: [saved.path], taskId: result.taskId },
        };
      },
    });
    const disposeGetVideo = ctx.tools.registerTool({
      moduleName: "@lfaa/tool-media",
      name: "get_video",
      title: "查询视频生成任务",
      description: "按 taskId 查询视频生成任务状态；成功时下载视频到工作区并返回路径。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "generate_video 返回的 taskId" },
          modelId: { type: "string", description: "可选：指定视频模型 ID" },
          profileId: { type: "string", description: "可选：指定模型配置 ID" },
        },
        required: ["taskId"],
      },
      execute: async (args, context) => {
        const taskId = String(args.taskId ?? "").trim();
        if (!taskId) return { ok: false, output: "缺少 taskId。", summary: "缺少 taskId" };
        const result = await ctx.llm.getVideoTask({
          taskId,
          ...(typeof args.modelId === "string" && args.modelId.trim() ? { modelId: args.modelId.trim() } : {}),
          ...(typeof args.profileId === "string" && args.profileId.trim() ? { profileId: args.profileId.trim() } : {}),
        });
        if (result.status !== "SUCCEEDED" || !result.videoUrl) {
          return {
            ok: result.status !== "FAILED" && result.status !== "CANCELED" && result.status !== "UNKNOWN",
            output: `视频任务 ${taskId} 状态：${result.status}${result.message ? `（${result.message}）` : ""}`,
            summary: `状态 ${result.status}`,
            metadata: { taskId, status: result.status },
          };
        }
        const downloaded = await downloadImage(result.videoUrl);
        if (!downloaded) return { ok: true, output: `视频已生成：${result.videoUrl}`, summary: "视频生成完成（未落盘）" };
        const dir = resolveMediaOutputDir(context.workspaceRoots, "videos");
        const saved = await saveImageBytes(dir, downloaded.bytes, "video/mp4");
        return {
          ok: true,
          output: `视频已就绪。\n\n![生成视频](${buildMediaFileUrl(saved.path)})`,
          summary: "1 个视频",
          metadata: { files: [saved.path], taskId },
        };
      },
    });
    const disposeSpeech = ctx.tools.registerTool({
      moduleName: "@lfaa/tool-media",
      name: "generate_speech",
      title: "生成语音",
      description: "调用已配置套餐里的 TTS 模型把文本转成语音并保存到工作区。参数：text（必填，≤600 字）、voice（音色，默认 Cherry）、languageType（Chinese/English 等）、modelId、profileId。结果里的 ![](...) 预览链接请原样保留在回复中。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "要合成的文本，最多 600 字符" },
          voice: { type: "string", description: "音色名，例如 Cherry、Ethan" },
          languageType: { type: "string", description: "语言：Chinese / English / Auto 等" },
          modelId: { type: "string", description: "指定 TTS 模型 ID" },
          profileId: { type: "string", description: "指定模型配置 ID" },
        },
        required: ["text"],
      },
      execute: async (args, context) => {
        const text = String(args.text ?? "").trim();
        if (!text) return { ok: false, output: "缺少合成文本 text。", summary: "缺少 text" };
        const result = await ctx.llm.generateAudio({
          text,
          ...(typeof args.voice === "string" && args.voice.trim() ? { voice: args.voice.trim() } : {}),
          ...(typeof args.languageType === "string" && args.languageType.trim() ? { languageType: args.languageType.trim() } : {}),
          ...(typeof args.modelId === "string" && args.modelId.trim() ? { modelId: args.modelId.trim() } : {}),
          ...(typeof args.profileId === "string" && args.profileId.trim() ? { profileId: args.profileId.trim() } : {}),
        });
        const dir = resolveMediaOutputDir(context.workspaceRoots, "audio");
        let saved: GeneratedImageFile | undefined;
        if (result.audioBase64) {
          saved = await saveImageBytes(dir, Buffer.from(result.audioBase64, "base64"), "audio/mpeg");
        } else if (result.audioUrl) {
          const downloaded = await downloadImage(result.audioUrl);
          if (downloaded) {
            const mime = downloaded.mime.startsWith("audio/") ? downloaded.mime : "audio/mpeg";
            saved = await saveImageBytes(dir, downloaded.bytes, mime);
          } else {
            return { ok: true, output: `语音已生成（临时链接 24 小时有效）：${result.audioUrl}`, summary: "语音完成（未落盘）" };
          }
        }
        if (!saved) return { ok: false, output: "语音合成没有返回可保存的音频。", summary: "没有音频" };
        await writeMediaMetadata(saved.path, { kind: "audio", prompt: text, model: result.model });
        return {
          ok: true,
          output: `已用 ${result.model} 生成语音（${result.characters ?? text.length} 字符，耗时 ${Math.round(result.elapsedMs / 1000)} 秒）。\n\n![生成语音](${buildMediaFileUrl(saved.path)})`,
          summary: "1 段语音",
          metadata: { model: result.model, files: [saved.path] },
        };
      },
    });
    return () => {
      dispose();
      disposeVideo();
      disposeGetVideo();
      disposeSpeech();
    };
  });
}

mediaToolsPlugin.inject = ["tools", "llm"] as const;

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default mediaToolsPlugin;
