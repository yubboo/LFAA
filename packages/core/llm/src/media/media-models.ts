// 厂商媒体模型候选与档案查找，供模型发布和生成适配器共用。
import { getArkPlanKind } from "../ark-plan";
import { normalizeModelCapability, resolveModelCapabilities, resolveModelKind } from "../capabilities";
import type { LlmProfile, ModelCapabilityInfo } from "../types";
import type { MediaImageInput, MediaVideoInput } from "./media";

/** 官方套餐的候选模型。已选与已同步模型优先，档位与额度由原套餐接口核验。 */
export function knownMediaModels(profile: LlmProfile): ModelCapabilityInfo[] {
  const catalog = (profile.availableModels ?? []).map((model) => normalizeModelCapability(model, profile.kind));
  const defaults = /^https:\/\/token-plan\.cn-beijing\.maas\.aliyuncs\.com(?:\/|$)/u.test(profile.baseUrl)
    ? ["wan2.7-image", "wan3.0-video"]
    : getArkPlanKind(profile.baseUrl) === "agent" ? ["doubao-seedream-5.0-flash", "doubao-seedance-2.0-mini"] : [];
  return [...catalog, ...defaults.filter((id) => !catalog.some((model) => model.id === id))
    .map((id) => resolveModelCapabilities(id, profile.kind))];
}

/** 从已配置档案里选出生图档案与模型：显式 profileId/modelId 优先，其次当前档案，最后任一含图像模型的档案。 */
export function selectImageProfile(
  profiles: readonly LlmProfile[],
  activeProfileId: string,
  input: Pick<MediaImageInput, "profileId" | "modelId"> & { referenceImages?: string[] },
): { profile: LlmProfile; modelId: string } {
  const isImage = (modelId: string) => resolveModelKind(modelId) === "image";
  // 文本生图模型优先：明确含 qwen-image / wanx / seedream / text2image 的模型排在首位，
  // 编辑类（edit / image-to-image）只作兜底，避免把需要参考图的模型当纯文生图用。
  const hasReference = (input.referenceImages?.length ?? 0) > 0;
  const rank = (modelId: string): number => {
    const id = modelId.toLowerCase();
    // 图生图时编辑/参考图模型优先，纯文生图模型次之。
    if (hasReference && /edit|image-to-image|img2img|wan2\.7-image/u.test(id)) return 0;
    if (/qwen-image|wanx|seedream|text2image|text-to-image|flux|sdxl|kolors/u.test(id)) return hasReference ? 1 : 0;
    if (/edit|image-to-image|img2img/u.test(id)) return hasReference ? 0 : 2;
    return 1;
  };
  const bestImageModelOf = (profile: LlmProfile): string | undefined => {
    if (isImage(profile.model) && !hasReference) return profile.model;
    const candidates = [profile.model, ...knownMediaModels(profile).map((model) => model.id)]
      .filter((modelId) => isImage(modelId))
      .sort((a, b) => rank(a) - rank(b));
    return candidates[0];
  };
  if (input.profileId) {
    const profile = profiles.find((item) => item.id === input.profileId);
    if (!profile) throw new Error(`找不到模型配置：${input.profileId}`);
    const modelId = input.modelId?.trim() || bestImageModelOf(profile);
    if (!modelId || !isImage(modelId)) throw new Error("该模型配置不是生图模型，请选择带生图模型的套餐或接口。");
    return { profile, modelId };
  }
  const explicit = input.modelId?.trim();
  const candidates = profiles.filter((profile) => profile.apiKey.trim() && (explicit
    ? isImage(explicit) && (profile.model === explicit || knownMediaModels(profile).some((item) => item.id === explicit))
    : Boolean(bestImageModelOf(profile))));
  if (candidates.length === 0) {
    throw new Error("还没有配置生图模型：请在「设置 → 模型管理」中添加包含生图模型（如 wan2.7-image、seedream）的套餐或接口。");
  }
  const profile = candidates.find((item) => item.id === activeProfileId) ?? candidates[0]!;
  const modelId = input.modelId?.trim() || bestImageModelOf(profile)!;
  if (!isImage(modelId)) throw new Error("该模型不是生图模型，请换一个图像模型。");
  return { profile, modelId };
}

/** 选出生视频档案与模型：显式优先，其次含视频模型的档案。 */
export function selectVideoProfile(
  profiles: readonly LlmProfile[],
  activeProfileId: string,
  input: Pick<MediaVideoInput, "profileId" | "modelId">,
): { profile: LlmProfile; modelId: string } {
  const isVideo = (modelId: string) => resolveModelKind(modelId) === "video";
  const videoModelOf = (profile: LlmProfile): string | undefined =>
    (isVideo(profile.model) ? profile.model : undefined)
    ?? knownMediaModels(profile).find((model) => isVideo(model.id))?.id;
  if (input.profileId) {
    const profile = profiles.find((item) => item.id === input.profileId);
    if (!profile) throw new Error(`找不到模型配置：${input.profileId}`);
    const modelId = input.modelId?.trim() || videoModelOf(profile);
    if (!modelId || !isVideo(modelId)) throw new Error("该模型配置不是视频生成模型，请选择带视频模型的套餐。");
    return { profile, modelId };
  }
  const explicit = input.modelId?.trim();
  const candidates = profiles.filter((profile) => profile.apiKey.trim() && (explicit
    ? isVideo(explicit) && (profile.model === explicit || knownMediaModels(profile).some((item) => item.id === explicit))
    : Boolean(videoModelOf(profile))));
  if (candidates.length === 0) throw new Error("还没有配置视频生成模型：请在「设置 → 模型管理」中添加包含视频模型的套餐。");
  const profile = candidates.find((item) => item.id === activeProfileId) ?? candidates[0]!;
  return { profile, modelId: input.modelId?.trim() || videoModelOf(profile)! };
}
