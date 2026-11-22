// 厂商媒体模型候选与档案查找，供模型发布和生成适配器共用。
import { ARK_AGENT_VIDEO_MODELS, getArkPlanKind } from "../ark-plan";
import { normalizeModelCapability, resolveModelCapabilities, resolveModelKind } from "../capabilities";
import type { LlmProfile, ModelCapabilityInfo, ModelKind } from "../types";
import type { MediaImageInput, MediaVideoInput } from "./media";

/** 套餐目录 / 同步结果声明的用途优先于模型 ID 推断；历史数据未声明用途时返回 undefined。 */
function declaredModelKind(profile: LlmProfile, modelId: string): ModelKind | undefined {
  const declared = profile.availableModels?.find((model) => model.id === modelId)?.modelKind;
  return declared && declared !== "chat" ? declared : undefined;
}

/** 某模型在指定档案里的真实用途：先信目录声明，再按模型 ID 家族兜底。 */
function profileModelKind(profile: LlmProfile, modelId: string): ModelKind {
  return declaredModelKind(profile, modelId) ?? resolveModelKind(modelId);
}

/**
 * 纯文字生成时，参考生视频（r2v）/ 图生视频（i2v）缺少 input.media，厂商必然拒绝。
 * 同套餐存在对应的 t2v 时改用它；没有对应模型时保留原选择，让厂商返回真实原因。
 */
function textToVideoSibling(profile: LlmProfile, modelId: string): string | undefined {
  const match = /^(.*)-(?:r2v|i2v)$/iu.exec(modelId.trim());
  if (!match) return undefined;
  const sibling = `${match[1]}-t2v`;
  const exists = profile.availableModels?.some((model) => model.id === sibling)
    || knownMediaModels(profile).some((model) => model.id === sibling);
  return exists ? sibling : undefined;
}

/** 纯文字回退时优先实测画质更好的 Wan 3.0（同提示词下细节与码率明显优于 HappyHorse t2v）。 */
const PREFERRED_TEXT_VIDEO = ["wan3.0-video"] as const;

/** 参考/图生视频缺素材时选一个纯文字视频模型：先看套餐里是否有更强的 Wan 3.0，再回退同家族 t2v。 */
function preferredTextToVideo(profile: LlmProfile, modelId: string): string | undefined {
  if (!/-(?:r2v|i2v)$/iu.test(modelId.trim())) return undefined;
  const available = new Set(knownMediaModels(profile).map((model) => model.id));
  return PREFERRED_TEXT_VIDEO.find((id) => available.has(id)) ?? textToVideoSibling(profile, modelId);
}

/** 官方套餐的候选模型。已选与已同步模型优先，档位与额度由原套餐接口核验。 */
export function knownMediaModels(profile: LlmProfile): ModelCapabilityInfo[] {
  const catalog = (profile.availableModels ?? []).map((model) => normalizeModelCapability(model, profile.kind));
  const defaults = /^https:\/\/token-plan\.cn-beijing\.maas\.aliyuncs\.com(?:\/|$)/u.test(profile.baseUrl)
    ? ["wan2.7-image", "wan3.0-video"]
    // 方舟 Agent Plan 的生图 Seedream 按套餐目录补齐；Seedance 只在 Large / Max 档位展示。
    : getArkPlanKind(profile.baseUrl) === "agent"
      ? [
          "doubao-seedream-5.0-flash",
          ...(profile.agentPlanTier === "large" || profile.agentPlanTier === "max" ? ARK_AGENT_VIDEO_MODELS : []),
        ]
      : [];
  return [...catalog, ...defaults.filter((id) => !catalog.some((model) => model.id === id))
    .map((id) => resolveModelCapabilities(id, profile.kind))];
}

/** 已配置档案里可用的视频套餐与模型，供 Agent 跨套餐前向用户说明并征询同意。 */
export interface VideoProfileOption {
  profileId: string;
  profileName: string;
  models: string[];
}

/** 列出所有带视频模型的已配置档案；没有视频模型的档案不返回。 */
export function listVideoProfileOptions(profiles: readonly LlmProfile[]): VideoProfileOption[] {
  return profiles.flatMap((profile) => {
    if (!profile.apiKey.trim() && profile.kind !== "ollama") return [];
    const models = knownMediaModels(profile)
      .filter((model) => profileModelKind(profile, model.id) === "video")
      .map((model) => model.id);
    return models.length > 0 ? [{ profileId: profile.id, profileName: profile.name, models }] : [];
  });
}

/** 从已配置档案里选出生图档案与模型：显式 profileId/modelId 优先，其次当前档案，最后任一含图像模型的档案。 */
export function selectImageProfile(
  profiles: readonly LlmProfile[],
  activeProfileId: string,
  input: Pick<MediaImageInput, "profileId" | "modelId"> & { referenceImages?: string[] },
): { profile: LlmProfile; modelId: string } {
  const isImage = (profile: LlmProfile, modelId: string) => profileModelKind(profile, modelId) === "image";
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
    if (isImage(profile, profile.model) && !hasReference) return profile.model;
    const candidates = [profile.model, ...knownMediaModels(profile).map((model) => model.id)]
      .filter((modelId) => isImage(profile, modelId))
      .sort((a, b) => rank(a) - rank(b));
    return candidates[0];
  };
  if (input.profileId) {
    const profile = profiles.find((item) => item.id === input.profileId);
    if (!profile) throw new Error(`找不到模型配置：${input.profileId}`);
    const modelId = input.modelId?.trim() || bestImageModelOf(profile);
    if (!modelId || !isImage(profile, modelId)) throw new Error("该模型配置不是生图模型，请选择带生图模型的套餐或接口。");
    return { profile, modelId };
  }
  const explicit = input.modelId?.trim();
  const candidates = profiles.filter((profile) => profile.apiKey.trim() && (explicit
    ? isImage(profile, explicit) && (profile.model === explicit || knownMediaModels(profile).some((item) => item.id === explicit))
    : Boolean(bestImageModelOf(profile))));
  if (candidates.length === 0) {
    throw new Error("还没有配置生图模型：请在「设置 → 模型管理」中添加包含生图模型（如 wan2.7-image、seedream）的套餐或接口。");
  }
  const profile = candidates.find((item) => item.id === activeProfileId) ?? candidates[0]!;
  const modelId = input.modelId?.trim() || bestImageModelOf(profile)!;
  if (!isImage(profile, modelId)) throw new Error("该模型不是生图模型，请换一个图像模型。");
  return { profile, modelId };
}

/** 选出生视频档案与模型：显式优先，其次含视频模型的档案。 */
export function selectVideoProfile(
  profiles: readonly LlmProfile[],
  activeProfileId: string,
  input: Pick<MediaVideoInput, "profileId" | "modelId">,
): { profile: LlmProfile; modelId: string } {
  const isVideo = (profile: LlmProfile, modelId: string) => profileModelKind(profile, modelId) === "video";
  const videoModelOf = (profile: LlmProfile): string | undefined =>
    (isVideo(profile, profile.model) ? profile.model : undefined)
    ?? knownMediaModels(profile).find((model) => isVideo(profile, model.id))?.id;
  if (input.profileId) {
    const profile = profiles.find((item) => item.id === input.profileId);
    if (!profile) throw new Error(`找不到模型配置：${input.profileId}`);
    const modelId = input.modelId?.trim() || videoModelOf(profile);
    if (!modelId || !isVideo(profile, modelId)) throw new Error("该模型配置不是视频生成模型，请选择带视频模型的套餐。");
    return { profile, modelId: preferredTextToVideo(profile, modelId) ?? modelId };
  }
  const explicit = input.modelId?.trim();
  const candidates = profiles.filter((profile) => profile.apiKey.trim() && (explicit
    ? isVideo(profile, explicit) && (profile.model === explicit || knownMediaModels(profile).some((item) => item.id === explicit))
    : Boolean(videoModelOf(profile))));
  if (candidates.length === 0) throw new Error("还没有配置视频生成模型：请在「设置 → 模型管理」中添加包含视频模型的套餐。");
  const profile = candidates.find((item) => item.id === activeProfileId) ?? candidates[0]!;
  const modelId = input.modelId?.trim() || videoModelOf(profile)!;
  if (!isVideo(profile, modelId)) throw new Error("该模型不是视频生成模型，请换一个视频模型。");
  return { profile, modelId: preferredTextToVideo(profile, modelId) ?? modelId };
}
