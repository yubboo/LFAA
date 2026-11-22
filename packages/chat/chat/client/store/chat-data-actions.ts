// 数据动作：资料库与存储、常规设置、模型档案、用户规则与长期记忆的读写。
import { fetchJson } from "./chat-http";
import { writeStoredReasoningLevel } from "./chat-preferences";
import { writeLocaleOverride, type GeneralSettingsConfig, type OpenSourcePackageInfo, type ReasoningLevelOption } from "../settings/general-settings-client";
import type {
  LibraryAssetItem,
  LibraryItemCategory,
  LongTermMemoryItem,
  LlmApiProtocolOption,
  ModelCapabilityItem,
  PublicLlmProfileItem,
  RuleDocumentItem,
  StorageConfigState,
  StorageLocationMode,
  StorageMigrationResult,
  StorageStats,
} from "./chat-types";
import type { ChatStorePort } from "./chat-store-port";

export class ChatDataActions {
  constructor(private readonly port: ChatStorePort) {}

  async refreshLibraryAndStorage(projectId?: string | null): Promise<void> {
    const storageQuery = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const [libRes, storageRes] = await Promise.all([
      fetchJson<{ assets: LibraryAssetItem[]; memories: LongTermMemoryItem[] }>("/api/library"),
      fetchJson<{ state: StorageConfigState; stats: StorageStats }>(`/api/storage${storageQuery}`),
    ]);
    this.port.patchState({
      libraryAssets: libRes.assets,
      memories: libRes.memories,
      storageState: storageRes.state,
      storageStats: storageRes.stats,
    });
  }

  async saveLibraryAsset(input: {
    category: LibraryItemCategory;
    title: string;
    fileName: string;
    content: string;
    encoding?: "utf8" | "base64";
    mimeType?: string;
    summary?: string;
    tags?: string[];
    projectId?: string | null;
  }): Promise<LibraryAssetItem> {
    const res = await fetchJson<{ item: LibraryAssetItem }>("/api/library", {
      method: "POST",
      body: JSON.stringify(input),
    });
    await this.refreshLibraryAndStorage(input.projectId);
    return res.item;
  }

  async readLibraryAsset(id: string): Promise<{ item: LibraryAssetItem; isText: boolean; content: string }> {
    return fetchJson(`/api/library/${encodeURIComponent(id)}`);
  }

  async removeLibraryAsset(id: string): Promise<void> {
    await fetchJson(`/api/library/${encodeURIComponent(id)}`, { method: "DELETE" });
    await this.refreshLibraryAndStorage();
  }

  async migrateStorage(input: {
    mode: StorageLocationMode;
    targetPath?: string;
    projectId?: string | null;
  }): Promise<StorageMigrationResult> {
    const res = await fetchJson<StorageMigrationResult>("/api/storage/migrate", {
      method: "POST",
      body: JSON.stringify(input),
    });
    this.port.patchState({
      storageState: res.state,
      storageStats: res.stats,
    });
    await this.port.refreshMeta();
    return res;
  }

  async pickStorageFolder(): Promise<{ cancelled: boolean; path?: string; error?: string }> {
    return fetchJson("/api/workspace/pick-folder", { method: "POST" });
  }

  async openStorageFolderInExplorer(): Promise<{ opened: boolean; path: string; error?: string }> {
    return fetchJson("/api/storage/open-explorer", { method: "POST" });
  }

  async refreshGeneralSettings(): Promise<void> {
    const res = await fetchJson<{ settings: GeneralSettingsConfig }>("/api/chat/general-settings");
    this.port.patchState({ generalSettings: res.settings });
  }

  async updateGeneralSettings(patch: Partial<GeneralSettingsConfig>): Promise<GeneralSettingsConfig> {
    const res = await fetchJson<{ settings: GeneralSettingsConfig }>("/api/chat/general-settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (patch.language) {
      writeLocaleOverride(res.settings.language);
    }
    this.port.patchState({ generalSettings: res.settings });
    return res.settings;
  }

  async getOpenSourceLicenses(): Promise<OpenSourcePackageInfo[]> {
    const res = await fetchJson<{ packages: OpenSourcePackageInfo[] }>("/api/chat/licenses");
    return res.packages;
  }

  async setActiveProfile(profileId: string): Promise<void> {
    await fetchJson("/api/llm/active", { method: "POST", body: JSON.stringify({ profileId }) });
    this.port.patchState({ activeProfileId: profileId });
  }

  setReasoningLevel(level: ReasoningLevelOption): void {
    writeStoredReasoningLevel(level);
    this.port.patchState({ reasoningLevel: level });
  }

  async saveLlmProfile(input: {
    id?: string;
    providerId?: string;
    name: string;
    kind: PublicLlmProfileItem["kind"];
    apiProtocol?: LlmApiProtocolOption;
    baseUrl: string;
    model: string;
    apiKey?: string;
    availableModels?: ModelCapabilityItem[];
    agentPlanTier?: "small" | "medium" | "large" | "max";
    contextWindowTokens?: number;
    inputPricePerMillion?: number;
    outputPricePerMillion?: number;
    cachedInputPricePerMillion?: number;
    activate?: boolean;
  }): Promise<PublicLlmProfileItem | null> {
    const res = await fetchJson<{ profile?: PublicLlmProfileItem; activeProfileId: string; profiles: PublicLlmProfileItem[] }>("/api/llm/profiles", {
      method: "POST",
      body: JSON.stringify(input),
    });
    this.port.patchState({ activeProfileId: res.activeProfileId, profiles: res.profiles });
    if (input.activate && res.profile?.id) {
      await this.setActiveProfile(res.profile.id);
    }
    return res.profile ?? null;
  }

  async deleteLlmProfile(profileId: string): Promise<void> {
    const res = await fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>(
      `/api/llm/profiles/${encodeURIComponent(profileId)}`,
      { method: "DELETE" },
    );
    this.port.patchState({ activeProfileId: res.activeProfileId, profiles: res.profiles });
  }

  async testLlmProfile(profileId: string): Promise<{ ok: boolean; model: string; replyPreview: string }> {
    return fetchJson("/api/llm/test", { method: "POST", body: JSON.stringify({ profileId }) });
  }

  // 同步模型能力后用 Host 返回的公开档案刷新界面状态。
  async fetchRemoteModels(input: {
    profileId?: string;
    kind?: PublicLlmProfileItem["kind"];
    apiProtocol?: LlmApiProtocolOption;
    baseUrl?: string;
    apiKey?: string;
  }): Promise<ModelCapabilityItem[]> {
    const res = await fetchJson<{
      models: ModelCapabilityItem[];
      activeProfileId: string;
      profiles: PublicLlmProfileItem[];
    }>("/api/llm/models", {
      method: "POST",
      body: JSON.stringify(input),
    });
    this.port.patchState({ activeProfileId: res.activeProfileId, profiles: res.profiles });
    return res.models;
  }

  async selectBrandModel(profileId: string, model: string): Promise<void> {
    const res = await fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>(
      "/api/llm/select-model",
      {
        method: "POST",
        body: JSON.stringify({ profileId, model }),
      },
    );
    this.port.patchState({ activeProfileId: res.activeProfileId, profiles: res.profiles });
  }

  async saveUserRules(content: string): Promise<void> {
    const res = await fetchJson<{ documents: RuleDocumentItem[] }>("/api/rules/user", {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    this.port.patchState({ rules: res.documents });
  }

  async addLongTermMemory(input: { content: string; scope: "global" | "project"; projectId?: string | null }): Promise<void> {
    await fetchJson("/api/memory", { method: "POST", body: JSON.stringify(input) });
    await this.port.refreshMeta();
  }

  async removeLongTermMemory(memoryId: string): Promise<void> {
    await fetchJson(`/api/memory/${encodeURIComponent(memoryId)}`, { method: "DELETE" });
    await this.port.refreshMeta();
  }
}