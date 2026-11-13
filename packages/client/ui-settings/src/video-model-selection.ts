/** 功能：构造设置中心可用的视频模型目标并同步当前选择。
 * 作用：唯一映射远程视频能力目录与已就绪本机视频模型；生成目标继续读取 aiRuntime 权威设置。
 */
import type { AiAccount, LocalModelSummary } from "lfaa-client-connection/src/api.js";

export type VideoModelChoice = {
  key: string;
  mode: "provider" | "local";
  modelId: string;
  accountId?: string;
  label: string;
  title: string;
  capabilityUnverified?: true;
};

export type VideoModelSelectionSettings = {
  videoGenerationMode: "provider" | "local";
  videoGenerationAccountId: string;
  videoGenerationModelId: string;
  videoGenerationLocalModelId: string;
};

function keyFor(mode: VideoModelChoice["mode"], accountId: string | undefined, modelId: string): string {
  return JSON.stringify([mode, accountId ?? "", modelId]);
}

function tierAllows(account: AiAccount, model: AiAccount["models"][number]): boolean {
  return !model.planTiers?.length || !account.options.planTier || account.options.planTier === "unknown"
    || model.planTiers.includes(account.options.planTier as NonNullable<AiAccount["models"][number]["planTiers"]>[number]);
}

export function buildVideoModelChoices(
  accounts: AiAccount[],
  localModels: LocalModelSummary[]
): VideoModelChoice[] {
  const providerChoices: VideoModelChoice[] = accounts
    .filter(account => account.hasSecret && (account.providerId === "doubao" || account.providerId === "ark-agent-plan"))
    .flatMap(account => account.models.flatMap(model => {
      if (model.taskType === "video-generation" && tierAllows(account, model)) return [{
        key: keyFor("provider", account.id, model.id),
        mode: "provider" as const,
        accountId: account.id,
        modelId: model.id,
        label: `${model.name} · ${account.displayName}`,
        title: `${account.displayName} · ${account.providerId} · ${model.id}`
      }];
      // Ordinary Doubao /models responses may omit task metadata. Keep those
      // targets manually selectable for compatibility, but never auto-default them.
      if (account.providerId === "doubao" && model.taskType === undefined) return [{
        key: keyFor("provider", account.id, model.id),
        mode: "provider" as const,
        accountId: account.id,
        modelId: model.id,
        label: `${model.name} · ${account.displayName} · 能力未标注`,
        title: `${account.displayName} · doubao · ${model.id} · Provider 目录未提供视频能力标记`,
        capabilityUnverified: true as const
      }];
      return [];
    }))
    .sort((left, right) => {
      const leftActive = accounts.find(account => account.id === left.accountId)?.active === true;
      const rightActive = accounts.find(account => account.id === right.accountId)?.active === true;
      return Number(rightActive) - Number(leftActive);
    });

  const localChoices: VideoModelChoice[] = localModels
    .filter(model => model.modality === "video" && model.ready)
    .map(model => ({
      key: keyFor("local", undefined, model.id),
      mode: "local",
      modelId: model.id,
      label: `${model.name} · LFAA 本机模型`,
      title: `${model.name} · 本机模型 · 文件完整`
    }));

  return [...providerChoices, ...localChoices];
}

export function findSelectedVideoModelChoice(
  choices: VideoModelChoice[],
  settings: VideoModelSelectionSettings
): VideoModelChoice | undefined {
  if (settings.videoGenerationMode === "local") {
    return choices.find(choice => choice.mode === "local" && choice.modelId === settings.videoGenerationLocalModelId);
  }
  return choices.find(choice => choice.mode === "provider" && choice.accountId === settings.videoGenerationAccountId
    && choice.modelId === settings.videoGenerationModelId);
}

/** Keep a valid user choice; otherwise choose a real candidate in the active mode when possible. */
export function defaultVideoModelChoice(
  choices: VideoModelChoice[],
  settings: VideoModelSelectionSettings
): VideoModelChoice | undefined {
  const selected = findSelectedVideoModelChoice(choices, settings);
  if (selected) return selected;
  const defaultableChoices = choices.filter(choice => !choice.capabilityUnverified);

  const preferredAccountChoice = settings.videoGenerationMode === "provider" && settings.videoGenerationAccountId
    ? defaultableChoices.find(choice => choice.mode === "provider" && choice.accountId === settings.videoGenerationAccountId)
    : undefined;
  if (preferredAccountChoice) return preferredAccountChoice;

  return defaultableChoices.find(choice => choice.mode === settings.videoGenerationMode) ?? defaultableChoices[0];
}

export function applyVideoModelChoice<T extends VideoModelSelectionSettings>(
  settings: T,
  choice: VideoModelChoice
): T {
  return choice.mode === "provider"
    ? { ...settings, videoGenerationMode: "provider", videoGenerationAccountId: choice.accountId!, videoGenerationModelId: choice.modelId }
    : { ...settings, videoGenerationMode: "local", videoGenerationLocalModelId: choice.modelId };
}
