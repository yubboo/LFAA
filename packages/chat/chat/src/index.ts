// @lfaa/chat Host 侧 Cordis 服务：基于 @lfaa/memory 暴露聊天会话 CRUD、项目维度统计与本机语音转写。
// 内置 Git 与代码审查逻辑在 @lfaa/review，本服务只保留对话、通用设置与语音搜索能力。
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/memory";
import type {
  ChatSessionRecord,
  ChatSessionSummary,
  CreateSessionInput,
  UpdateSessionInput,
} from "@lfaa/memory";

import { mkdir } from "node:fs/promises";
import {
  GeneralSettingsStore,
  readBundledOpenSourceLicenses,
  resolveDefaultOutsideProjectFolder,
  resolveDefaultProjectsFolder,
  type GeneralSettingsConfig,
  type OpenSourcePackageInfo,
} from "@lfaa/settings";
import { searchSessionRecords, type ChatSearchResponse } from "./session-search";
import { transcribeWavAudio, type SpeechTranscribeResult } from "./speech-service";

export { createChatHttpHandler } from "./http-handler";
export {
  GeneralSettingsStore,
  getGeneralSettingsFilePath,
  resolveDefaultOutsideProjectFolder,
  resolveDefaultProjectsFolder,
  type GeneralSettingsConfig,
  type OpenSourcePackageInfo,
} from "@lfaa/settings";
export { assertValidWavBuffer, transcribeWavAudio, type SpeechTranscribeResult } from "./speech-service";
export { searchSessionRecords, type ChatSearchResponse, type ChatSearchResult } from "./session-search";

/** 提供会话与通用设置所需的 Host 路径及可注入依赖。 */
export interface ChatPluginConfig {
  generalSettingsFilePath?: string;
  repoRoot?: string;
}
export type {
  AgentLoopPhase,
  AgentStepStatus,
  AgentStepTrace,
  ChatMessageRecord,
  ChatSessionRecord,
  ChatSessionSummary,
} from "@lfaa/memory";

/** 编排会话、语音与通用设置，为聊天与工作台 RPC 提供 Host 入口。 */
export class ChatService extends Service {
  static inject = ["memory"];
  private readonly generalSettingsStore: GeneralSettingsStore;
  private readonly repoRoot: string;

  constructor(ctx: Context, config: ChatPluginConfig = {}) {
    super(ctx, "chat");
    this.generalSettingsStore = new GeneralSettingsStore(config.generalSettingsFilePath);
    this.repoRoot = config.repoRoot ?? process.cwd();
    // 启动即确保默认工作区（<系统文档>/lfaa/default-workspace）与默认项目目录存在：
    // 首次「项目外新聊天」和「按名称新建项目」都有明确落点；创建失败不影响后续使用。
    void this.generalSettingsStore.get()
      .then(async (settings) => {
        await mkdir(settings.outsideProjectFolder, { recursive: true }).catch(() => {});
        await mkdir(settings.defaultProjectsFolder, { recursive: true }).catch(() => {});
      })
      .catch(() => {});
  }

  listSessions(options?: { includeArchived?: boolean; projectId?: string | null }): Promise<ChatSessionSummary[]> {
    return this.ctx.memory.listSessions(options);
  }

  countByProject(includeArchived = false): Promise<Record<string, number>> {
    return this.ctx.memory.countSessionsByProject(includeArchived);
  }

  getSession(sessionId: string): Promise<ChatSessionRecord | null> {
    return this.ctx.memory.getSession(sessionId);
  }

  /** 搜索全部本地会话（含归档）的标题与消息正文；按需读取，查询为空时返回空结果。 */
  async searchSessions(query: string): Promise<ChatSearchResponse> {
    if (!query.trim()) return { results: [], truncated: false };
    const summaries = await this.ctx.memory.listSessions({ includeArchived: true });
    const records = (await Promise.all(summaries.map((summary) => this.ctx.memory.getSession(summary.id))))
      .filter((record): record is ChatSessionRecord => Boolean(record));
    return searchSessionRecords(records, query);
  }

  createSession(input?: CreateSessionInput): Promise<ChatSessionRecord> {
    return this.ctx.memory.createSession(input);
  }

  updateSession(sessionId: string, patch: UpdateSessionInput): Promise<ChatSessionRecord | null> {
    return this.ctx.memory.updateSession(sessionId, patch);
  }

  deleteSession(sessionId: string): Promise<boolean> {
    return this.ctx.memory.deleteSession(sessionId);
  }

  forkSession(sessionId: string): Promise<ChatSessionRecord | null> {
    return this.ctx.memory.forkSession(sessionId);
  }

  // 通过本机离线语音引擎将浏览器捕获的 WAV 音频转写为文本，避免外网语音服务不可达报错。
  transcribeAudio(wavBuffer: Buffer, lang?: string): Promise<SpeechTranscribeResult> {
    return transcribeWavAudio(wavBuffer, lang);
  }

  getGeneralSettings(): Promise<GeneralSettingsConfig> {
    return this.generalSettingsStore.get();
  }

  async updateGeneralSettings(patch: Partial<GeneralSettingsConfig>): Promise<GeneralSettingsConfig> {
    const next = await this.generalSettingsStore.update(patch);
    if (patch.outsideProjectFolder) {
      await mkdir(next.outsideProjectFolder, { recursive: true }).catch(() => {});
    }
    if (patch.defaultProjectsFolder) {
      await mkdir(next.defaultProjectsFolder, { recursive: true }).catch(() => {});
    }
    return next;
  }

  getOpenSourceLicenses(): Promise<OpenSourcePackageInfo[]> {
    return readBundledOpenSourceLicenses(this.repoRoot);
  }
}

/** 为 Cordis 上下文安装聊天服务，复用已注入的记忆及其他能力。 */
export function chatPlugin(context: Context, config: ChatPluginConfig = {}): void {
  new ChatService(context, config);
}

chatPlugin.inject = ["memory"] as const;

declare module "@deepseek-ai/cordis" {
  interface Context {
    chat: ChatService;
  }
}
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default chatPlugin;