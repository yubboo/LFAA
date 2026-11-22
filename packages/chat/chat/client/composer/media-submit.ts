// 媒体直连提交：把输入栏草稿、图片附件与选定画幅整理成生成请求，供选中媒体模型时复用。
import type { ChatClientStore } from "../store/chat-store";
import type { ComposerAttachment } from "./composer-context";
import { collectImageAttachmentIds } from "./composer-attachments";
import type { MediaRatioChoice, MediaStyleChoice } from "@lfaa/tool-media/client";

const IMAGE_PATH_RE = /\.(?:png|jpe?g|webp|bmp|tiff?|gif)$/iu;

/** 只把图片附件参与生图：上传文件走附件 id，会话内引用图带来源消息，本地路径直接作为参考图。 */
export async function submitMediaGeneration(args: {
  store: ChatClientStore;
  kind: "image" | "video" | "audio";
  prompt: string;
  attachments: ComposerAttachment[];
  profile: { id: string; model?: string | undefined } | null | undefined;
  ratio: MediaRatioChoice;
  /** 用户选定的画面风格；auto 时不传，交给模型与提示词导演。 */
  style?: MediaStyleChoice;
}): Promise<{ ok: boolean; error?: string; ratio?: string }> {
  const imageAttachments = args.kind === "image" ? args.attachments : [];
  const imageAttachmentIds = collectImageAttachmentIds(imageAttachments);
  const imageFiles = imageAttachments.flatMap((item) => item.imageFile && !item.attachmentId ? [item.imageFile] : []);
  const referenceSources = imageAttachments.flatMap((item) => item.mediaSource
    ? [{ messageId: item.mediaSource.messageId, path: item.mediaSource.path }] : []);
  const imagePaths = imageAttachments.filter((item) => !item.mediaSource)
    .map((item) => item.path)
    .filter((path): path is string => typeof path === "string" && IMAGE_PATH_RE.test(path));
  return args.store.generateMediaFromPrompt({
    kind: args.kind,
    prompt: args.prompt,
    ...(args.ratio !== "auto" ? { ratio: args.ratio } : {}),
    ...(args.style && args.style !== "auto" ? { style: args.style } : {}),
    ...(args.profile?.model ? { modelId: args.profile.model } : {}),
    ...(args.profile?.id ? { profileId: args.profile.id } : {}),
    ...(imageAttachmentIds.length > 0 ? { attachmentIds: imageAttachmentIds } : {}),
    ...(imageFiles.length > 0 ? { imageFiles } : {}),
    ...(referenceSources.length > 0 ? { referenceSources } : {}),
    ...(imagePaths.length > 0 ? { referenceImages: imagePaths } : {}),
  });
}