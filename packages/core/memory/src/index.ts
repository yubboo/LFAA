// @lfaa/memory Host 侧 Cordis 服务：统一对外提供短期会话记忆、长期事实记忆、资料库资产/产物及存储迁移服务。
import { dirname, join, resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import { AssetLibraryStore } from "@lfaa/storage";
import { LongTermMemoryStore } from "./longterm-store";
import { MemorySettingsStore } from "./memory-settings";
import { SessionMemoryStore } from "@lfaa/session";
import {
  getDefaultDataRoot,
  getFixedSessionsDir,
  normalizeCustomDataPath,
  StorageManager,
  VAULT_DIRS,
  VAULT_FILES,
} from "@lfaa/storage";
import type {
  AddMemoryInput,
  ChatMessageRecord,
  ChatSessionRecord,
  ChatSessionSummary,
  CreateSessionInput,
  LibraryAssetItem,
  LibraryItemCategory,
  ListMemoriesOptions,
  MemoryEntry,
  MemoryKind,
  MemorySettings,
  MemoryStats,
  RecallMemoriesOptions,
  SaveLibraryAssetInput,
  StorageConfigState,
  StorageLocationMode,
  StorageMigrationResult,
  StorageStats,
  UpdateSessionInput,
} from "./types";

export * from "./types";
export { normalizeMemoryEntry, resolveArchivePath } from "./longterm-store";
export { DEFAULT_MEMORY_SETTINGS, normalizeMemorySettings } from "./memory-settings";
export { contentKey, textSimilarity, tokenize } from "./memory-ranking";
export type { PendingQuestion, SessionWorktree, UserClarification } from "@lfaa/session";
export {
  buildRunSummaryEntry,
  collectHistoryDigest,
  collectStepDigest,
  formatHistoryDigest,
  normalizeTodoList,
  rollSessionSummary,
  type HistoryDigest,
} from "@lfaa/session";
export { createMemoryHttpHandler } from "./http-handler";
export {
  getCurrentUserHomeDir,
  getDefaultDataRoot,
  getDefaultLfaaHome,
  getFixedSessionsDir,
  normalizeCustomDataPath,
  VAULT_DIRS,
  VAULT_FILES,
} from "@lfaa/storage";

/** 允许应用及测试配置资料目录和存储路径。 */
export interface MemoryPluginConfig {
  sessionsDir?: string;
  memoryFilePath?: string;
  memorySettingsFilePath?: string;
  dataRoot?: string;
  storageConfigFilePath?: string;
  recommendedProjectDataRoot?: string;
  legacyHomeDir?: string;
}

// Host 侧记忆与资产库服务：持久化会话、长期记忆、Agent 产物与本地资产，并支持无损迁移根目录。
export class MemoryService extends Service {
  private readonly sessionStore: SessionMemoryStore;
  private readonly longTermStore: LongTermMemoryStore;
  private readonly settingsStore: MemorySettingsStore;
  private readonly assetStore: AssetLibraryStore;
  private readonly storageManager: StorageManager;
  private readonly isolatedMode: boolean;
  private readyPromise: Promise<void> | null = null;
  private memorySettings: MemorySettings | null = null;

  constructor(ctx: Context, config: MemoryPluginConfig = {}) {
    super(ctx, "memory");
    this.isolatedMode = Boolean(config.sessionsDir || config.memoryFilePath);
    const fallbackRoot = config.dataRoot ? resolve(config.dataRoot) : getDefaultDataRoot();
    const fixedSessionsDir = config.sessionsDir
      ? resolve(config.sessionsDir)
      : config.legacyHomeDir
        ? join(resolve(config.legacyHomeDir), "sessions")
        : getFixedSessionsDir();
    this.storageManager = new StorageManager({
      configFilePath: config.storageConfigFilePath,
      defaultDataRoot: config.dataRoot ?? getDefaultDataRoot(),
      recommendedProjectDataRoot: config.recommendedProjectDataRoot,
      legacyHomeDir: config.legacyHomeDir,
      sessionsRoot: fixedSessionsDir,
    });
    const memoryFilePath = config.memoryFilePath ? resolve(config.memoryFilePath) : join(fallbackRoot, VAULT_FILES.longTermMemory);
    this.sessionStore = new SessionMemoryStore(fixedSessionsDir);
    this.longTermStore = new LongTermMemoryStore(memoryFilePath);
    // 隔离模式（测试/子进程）把设置放在临时资料目录，避免写入真实用户主目录。
    const settingsPath = config.memorySettingsFilePath
      ?? (this.isolatedMode ? join(dirname(memoryFilePath), "memory-settings.json") : undefined);
    this.settingsStore = new MemorySettingsStore(settingsPath);
    this.assetStore = new AssetLibraryStore(fallbackRoot);
  }

  private async ensureReady(): Promise<void> {
    if (!this.memorySettings) {
      this.memorySettings = await this.settingsStore.get();
      this.longTermStore.setMaxEntries(this.memorySettings.maxEntries);
    }
    if (this.isolatedMode) return;
    if (!this.readyPromise) {
      this.readyPromise = this.storageManager.ensureInitialized().then((state) => {
        this.applyDataRoot(state.dataRoot);
      });
    }
    await this.readyPromise;
  }

  private applyDataRoot(dataRoot: string): void {
    // 历史会话固定保存在 ~/.lfaa/sessions 不随 dataRoot 迁移；仅资料库与长期记忆跟随 dataRoot 切换。
    this.longTermStore.setFilePath(join(dataRoot, VAULT_FILES.longTermMemory));
    this.assetStore.setDataRoot(dataRoot);
  }

  async listSessions(options?: { includeArchived?: boolean; projectId?: string | null }): Promise<ChatSessionSummary[]> {
    await this.ensureReady();
    return this.sessionStore.list(options);
  }

  async countSessionsByProject(includeArchived = false): Promise<Record<string, number>> {
    await this.ensureReady();
    const sessions = await this.sessionStore.list({ includeArchived });
    const counts: Record<string, number> = {};
    for (const item of sessions) {
      if (!item.projectId) continue;
      counts[item.projectId] = (counts[item.projectId] ?? 0) + 1;
    }
    return counts;
  }

  async getSession(sessionId: string): Promise<ChatSessionRecord | null> {
    await this.ensureReady();
    return this.sessionStore.get(sessionId);
  }

  async createSession(input?: CreateSessionInput): Promise<ChatSessionRecord> {
    await this.ensureReady();
    return this.sessionStore.create(input);
  }

  async updateSession(sessionId: string, patch: UpdateSessionInput): Promise<ChatSessionRecord | null> {
    await this.ensureReady();
    return this.sessionStore.update(sessionId, patch);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    await this.ensureReady();
    return this.sessionStore.delete(sessionId);
  }

  /** 应用启动时结算上次退出遗留的流式消息与临时文件。 */
  async reconcileInterruptedRuns(): Promise<{ sessions: number; messages: number; tmpRemoved: number }> {
    await this.ensureReady();
    return this.sessionStore.reconcileInterruptedRuns();
  }

  async forkSession(sessionId: string): Promise<ChatSessionRecord | null> {
    await this.ensureReady();
    return this.sessionStore.fork(sessionId);
  }

  async appendMessage(sessionId: string, message: ChatMessageRecord): Promise<ChatSessionRecord> {
    await this.ensureReady();
    return this.sessionStore.appendMessage(sessionId, message);
  }

  async updateMessage(
    sessionId: string,
    messageId: string,
    patch: Partial<ChatMessageRecord>,
  ): Promise<ChatSessionRecord> {
    await this.ensureReady();
    return this.sessionStore.updateMessage(sessionId, messageId, patch);
  }

  async buildContextMessages(
    sessionId: string,
    options?: { maxRecentMessages?: number; maxChars?: number },
  ): Promise<{ summaryNote?: string; recentMessages: ChatMessageRecord[] }> {
    await this.ensureReady();
    return this.sessionStore.buildContextMessages(sessionId, options);
  }

  async listLongTermMemories(options?: ListMemoriesOptions): Promise<MemoryEntry[]> {
    await this.ensureReady();
    return this.longTermStore.list(options);
  }

  async addMemory(input: AddMemoryInput): Promise<MemoryEntry> {
    await this.ensureReady();
    return this.longTermStore.add(input);
  }

  async updateMemory(
    memoryId: string,
    patch: { content?: string; kind?: MemoryKind; tags?: string[] },
  ): Promise<MemoryEntry | null> {
    await this.ensureReady();
    return this.longTermStore.updateEntry(memoryId, patch);
  }

  async removeMemory(memoryId: string): Promise<boolean> {
    await this.ensureReady();
    return this.longTermStore.remove(memoryId);
  }

  async recallRelevantMemories(options: RecallMemoriesOptions): Promise<MemoryEntry[]> {
    await this.ensureReady();
    const settings = await this.getMemorySettings();
    return this.longTermStore.recall({
      ...options,
      limit: options.limit ?? settings.recallLimit,
      budgetChars: options.budgetChars ?? settings.recallBudgetChars,
    });
  }

  /** 结束一次 crew 运行时归档 run 记忆：提炼一条 team 记忆后清空 run 条目。 */
  async archiveRunMemories(runId: string, sessionId: string): Promise<number> {
    await this.ensureReady();
    return this.longTermStore.archiveRunMemories(runId, sessionId);
  }
  async getMemoryStats(): Promise<MemoryStats> {
    await this.ensureReady();
    return this.longTermStore.stats();
  }

  async getMemorySettings(): Promise<MemorySettings> {
    await this.ensureReady();
    return this.memorySettings ?? this.settingsStore.get();
  }

  async updateMemorySettings(patch: Partial<MemorySettings>): Promise<MemorySettings> {
    await this.ensureReady();
    const next = await this.settingsStore.update(patch);
    this.memorySettings = next;
    this.longTermStore.setMaxEntries(next.maxEntries);
    return next;
  }

  async listLibraryAssets(options?: {
    category?: LibraryItemCategory | undefined;
    projectId?: string | null | undefined;
    query?: string | undefined;
  }): Promise<LibraryAssetItem[]> {
    await this.ensureReady();
    return this.assetStore.list(options);
  }

  async saveLibraryAsset(input: SaveLibraryAssetInput): Promise<LibraryAssetItem> {
    await this.ensureReady();
    return this.assetStore.save(input);
  }

  async readLibraryAsset(id: string): Promise<{ item: LibraryAssetItem; isText: boolean; content: string } | null> {
    await this.ensureReady();
    return this.assetStore.readContent(id);
  }

  async removeLibraryAsset(id: string): Promise<boolean> {
    await this.ensureReady();
    return this.assetStore.remove(id);
  }

  async getStorageState(projectRoot?: string): Promise<StorageConfigState> {
    await this.ensureReady();
    return this.storageManager.getState(projectRoot);
  }

  async getStorageStats(): Promise<StorageStats> {
    await this.ensureReady();
    return this.storageManager.getStats();
  }

  async migrateStorage(options: {
    targetPath: string;
    mode: StorageLocationMode;
    projectRoot?: string | undefined;
  }): Promise<StorageMigrationResult> {
    await this.ensureReady();
    const result = await this.storageManager.migrate(options);
    this.applyDataRoot(result.toRoot);
    return result;
  }
}

/** 注册本机会话、长期记忆、资料与存储位置管理服务。 */
export function memoryPlugin(context: Context, config: MemoryPluginConfig = {}): void {
  new MemoryService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    memory: MemoryService;
  }
}
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default memoryPlugin;
