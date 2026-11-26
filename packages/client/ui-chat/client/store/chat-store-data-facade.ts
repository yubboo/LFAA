// 会话数据动作门面：把资料库、存储、模型配置、规则与长期记忆的委托从主 Store 拆出，保持单一职责。
import type { ChatDataActions } from "./chat-data-actions";
import type { GeneralSettingsConfig, OpenSourcePackageInfo, ReasoningLevelOption } from "../shared/general-settings";
import type {
  LibraryAssetItem,
  MemoryKindItem,
  ModelCapabilityItem,
  PublicLlmProfileItem,
  StorageLocationMode,
  StorageMigrationResult,
} from "./chat-types";

/** 供 ChatClientStore 继承的数据动作门面；只做委托，不持有状态。 */
export abstract class ChatDataFacade {
  protected abstract readonly dataActions: ChatDataActions;

  refreshLibraryAndStorage(projectId?: string | null): Promise<void> {
    return this.dataActions.refreshLibraryAndStorage(projectId);
  }

  saveLibraryAsset(input: Parameters<ChatDataActions["saveLibraryAsset"]>[0]): Promise<LibraryAssetItem> {
    return this.dataActions.saveLibraryAsset(input);
  }

  readLibraryAsset(id: string): Promise<{ item: LibraryAssetItem; isText: boolean; content: string }> {
    return this.dataActions.readLibraryAsset(id);
  }

  removeLibraryAsset(id: string): Promise<void> {
    return this.dataActions.removeLibraryAsset(id);
  }

  migrateStorage(input: {
    mode: StorageLocationMode;
    targetPath?: string;
    projectId?: string | null;
  }): Promise<StorageMigrationResult> {
    return this.dataActions.migrateStorage(input);
  }

  pickStorageFolder(): Promise<{ cancelled: boolean; path?: string; error?: string }> {
    return this.dataActions.pickStorageFolder();
  }

  openStorageFolderInExplorer(): Promise<{ opened: boolean; path: string; error?: string }> {
    return this.dataActions.openStorageFolderInExplorer();
  }

  refreshGeneralSettings(): Promise<void> {
    return this.dataActions.refreshGeneralSettings();
  }

  updateGeneralSettings(patch: Partial<GeneralSettingsConfig>): Promise<GeneralSettingsConfig> {
    return this.dataActions.updateGeneralSettings(patch);
  }

  getOpenSourceLicenses(): Promise<OpenSourcePackageInfo[]> {
    return this.dataActions.getOpenSourceLicenses();
  }

  setActiveProfile(profileId: string): Promise<void> {
    return this.dataActions.setActiveProfile(profileId);
  }

  setReasoningLevel(level: ReasoningLevelOption): void {
    this.dataActions.setReasoningLevel(level);
  }

  saveLlmProfile(input: Parameters<ChatDataActions["saveLlmProfile"]>[0]): Promise<PublicLlmProfileItem | null> {
    return this.dataActions.saveLlmProfile(input);
  }

  deleteLlmProfile(profileId: string): Promise<void> {
    return this.dataActions.deleteLlmProfile(profileId);
  }

  testLlmProfile(profileId: string): Promise<{ ok: boolean; model: string; replyPreview: string }> {
    return this.dataActions.testLlmProfile(profileId);
  }

  fetchRemoteModels(input: Parameters<ChatDataActions["fetchRemoteModels"]>[0]): Promise<ModelCapabilityItem[]> {
    return this.dataActions.fetchRemoteModels(input);
  }

  selectBrandModel(profileId: string, model: string): Promise<void> {
    return this.dataActions.selectBrandModel(profileId, model);
  }

  saveUserRules(content: string): Promise<void> {
    return this.dataActions.saveUserRules(content);
  }

  addLongTermMemory(input: {
    content: string;
    scope: "global" | "project";
    projectId?: string | null;
    kind?: MemoryKindItem;
  }): Promise<void> {
    return this.dataActions.addLongTermMemory(input);
  }

  updateLongTermMemory(
    memoryId: string,
    patch: { content?: string; kind?: MemoryKindItem; tags?: string[] },
  ): Promise<void> {
    return this.dataActions.updateLongTermMemory(memoryId, patch);
  }

  removeLongTermMemory(memoryId: string): Promise<void> {
    return this.dataActions.removeLongTermMemory(memoryId);
  }
}