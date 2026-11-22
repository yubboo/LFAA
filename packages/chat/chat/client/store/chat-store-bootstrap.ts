// 聊天 Store 的启动与刷新编排：并发拉取会话、模型、规则、记忆、资料库与存储快照，再一次性写入状态。
// 与 Store 类分开，保持核心壳只负责状态与动作分派。
import type { GeneralSettingsConfig } from "../settings/general-settings-client";
import { fetchJson } from "./chat-http";
import { writeStoredSessionId } from "./chat-preferences";
import type {
  ChatSessionAttention,
  ChatSessionDetail,
  ChatSessionItem,
  ChatStoreSnapshot,
  LibraryAssetItem,
  LongTermMemoryItem,
  PublicLlmProfileItem,
  RuleDocumentItem,
  StorageConfigState,
  StorageStats,
} from "./chat-types";

/** 启动引导需要的 Store 能力。 */
export interface ChatStoreBootstrapHost {
  getState(): ChatStoreSnapshot;
  patchState(patch: Partial<ChatStoreSnapshot>): void;
  /** 恢复上次仍在后台运行的会话。 */
  resumeRun(sessionId: string): Promise<void>;
  /** 同步后台运行与待处理徽标。 */
  syncBackground(sessionIds: string[], attention: ChatSessionAttention[]): void;
}

/** 首次进入工作台时拉取初始快照；失败时只记录错误，不阻塞界面。 */
export async function hydrateChatStore(host: ChatStoreBootstrapHost): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const [sessRes, activeRes, attentionRes, llmRes, rulesRes, memRes, trustRes, libRes, storageRes, generalRes] = await Promise.all([
      fetchJson<{ sessions: ChatSessionItem[] }>("/api/chat/sessions"),
      fetchJson<{ sessionIds: string[] }>("/api/agent/active-sessions").catch(() => ({ sessionIds: [] })),
      fetchJson<{ items: ChatSessionAttention[] }>("/api/agent/attention").catch(() => ({ items: [] })),
      fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>("/api/llm/profiles"),
      fetchJson<{ documents: RuleDocumentItem[] }>("/api/rules"),
      fetchJson<{ memories: LongTermMemoryItem[] }>("/api/memory"),
      fetchJson<{ counts: Record<string, number> }>("/api/agent/trust").catch(() => ({ counts: {} })),
      fetchJson<{ assets: LibraryAssetItem[] }>("/api/library").catch(() => ({ assets: [] })),
      fetchJson<{ state: StorageConfigState; stats: StorageStats }>("/api/storage").catch(() => null),
      fetchJson<{ settings: GeneralSettingsConfig }>("/api/chat/general-settings").catch(() => null),
    ]);
    const currentId = host.getState().activeSessionId;
    const targetId = currentId && sessRes.sessions.some((session) => session.id === currentId) ? currentId : null;
    let activeSession: ChatSessionDetail | null = null;
    if (targetId) {
      const detail = await fetchJson<{ session: ChatSessionDetail }>(`/api/chat/sessions/${encodeURIComponent(targetId)}`).catch(() => null);
      if (detail?.session) {
        activeSession = detail.session;
      } else {
        writeStoredSessionId(null);
      }
    }
    host.patchState({
      loaded: true,
      sessions: sessRes.sessions,
      activeSessionId: targetId,
      activeSession,
      smartTrustCounts: trustRes.counts,
      activeProfileId: llmRes.activeProfileId,
      profiles: llmRes.profiles,
      rules: rulesRes.documents,
      memories: memRes.memories,
      libraryAssets: libRes.assets,
      ...(storageRes ? { storageState: storageRes.state, storageStats: storageRes.stats } : {}),
      ...(generalRes ? { generalSettings: generalRes.settings } : {}),
    });
    if (targetId) {
      void host.resumeRun(targetId);
    }
    // 刷新后仍有 Agent 在后台运行的会话继续显示转圈；待确认/待回答也会恢复成侧栏徽标。
    host.syncBackground(activeRes.sessionIds, attentionRes.items);
  } catch (error) {
    host.patchState({
      loaded: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

/** 重新拉取列表与配置元数据，用于项目切换或外部变更后的轻量刷新。 */
export async function refreshChatMeta(
  host: Pick<ChatStoreBootstrapHost, "patchState">,
  projectPath?: string,
): Promise<void> {
  const query = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : "";
  const [sessRes, llmRes, rulesRes, memRes, trustRes, libRes, storageRes] = await Promise.all([
    fetchJson<{ sessions: ChatSessionItem[] }>("/api/chat/sessions"),
    fetchJson<{ activeProfileId: string; profiles: PublicLlmProfileItem[] }>("/api/llm/profiles"),
    fetchJson<{ documents: RuleDocumentItem[] }>(`/api/rules${query}`),
    fetchJson<{ memories: LongTermMemoryItem[] }>("/api/memory"),
    fetchJson<{ counts: Record<string, number> }>("/api/agent/trust").catch(() => ({ counts: {} })),
    fetchJson<{ assets: LibraryAssetItem[] }>("/api/library").catch(() => ({ assets: [] })),
    fetchJson<{ state: StorageConfigState; stats: StorageStats }>("/api/storage").catch(() => null),
  ]);
  host.patchState({
    sessions: sessRes.sessions,
    smartTrustCounts: trustRes.counts,
    activeProfileId: llmRes.activeProfileId,
    profiles: llmRes.profiles,
    rules: rulesRes.documents,
    memories: memRes.memories,
    libraryAssets: libRes.assets,
    ...(storageRes ? { storageState: storageRes.state, storageStats: storageRes.stats } : {}),
  });
}