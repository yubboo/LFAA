// @lfaa/chat Host 侧 Cordis 服务：基于 @lfaa/memory 暴露聊天会话 CRUD 与项目维度聊天统计。
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
  CodingSettingsStore,
  type CodeReviewCodingSettings,
  type CodingSettingsConfig,
  type GitCodingSettings,
} from "./coding-settings";
import {
  GeneralSettingsStore,
  readBundledOpenSourceLicenses,
  resolveDefaultOutsideProjectFolder,
  resolveDefaultProjectsFolder,
  type GeneralSettingsConfig,
  type OpenSourcePackageInfo,
} from "./general-settings";
import {
  buildCommitDraft,
  buildPrDraft,
  checkoutGitBranch,
  commitGitChanges,
  discoverGitRepositories,
  getGitDiff,
  getGitStatus,
  stageGitFiles,
  unstageGitFiles,
  revertGitFiles,
  type GitRepoDiscoveryItem,
  type GitStatusSnapshot,
} from "./git-service";
import { CodeReviewService, type CodeReviewReport, type ReviewScope } from "./review-service";
import { transcribeWavAudio, type SpeechTranscribeResult } from "./speech-service";

export { createChatHttpHandler } from "./http-handler";
export { createCodingHttpHandler } from "./git-http-handler";
export {
  CodingSettingsStore,
  getCodingSettingsFilePath,
  type CodeReviewCodingSettings,
  type CodingSettingsConfig,
  type GitCodingSettings,
} from "./coding-settings";
export {
  discoverGitRepositories,
  type GitBranchInfo,
  type GitChangedFile,
  type GitCommitSummary,
  type GitRepoDiscoveryItem,
  type GitStatusSnapshot,
} from "./git-service";
export {
  CodeReviewService,
  getCodeReviewHistoryFilePath,
  type CodeReviewFinding,
  type CodeReviewReport,
  type ReviewScope,
} from "./review-service";
export {
  GeneralSettingsStore,
  getGeneralSettingsFilePath,
  resolveDefaultOutsideProjectFolder,
  resolveDefaultProjectsFolder,
  type GeneralSettingsConfig,
  type OpenSourcePackageInfo,
} from "./general-settings";
export { assertValidWavBuffer, transcribeWavAudio, type SpeechTranscribeResult } from "./speech-service";

/** 提供会话与编码配置所需的 Host 路径及可注入依赖。 */
export interface ChatPluginConfig {
  generalSettingsFilePath?: string;
  codingSettingsFilePath?: string;
  reviewHistoryFilePath?: string;
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

/** 编排会话、语音和编码操作，为聊天与工作台 RPC 提供 Host 入口。 */
export class ChatService extends Service {
  static inject = ["memory"];
  private readonly generalSettingsStore: GeneralSettingsStore;
  private readonly codingSettingsStore: CodingSettingsStore;
  private readonly codeReviewService: CodeReviewService;
  private readonly repoRoot: string;

  constructor(ctx: Context, config: ChatPluginConfig = {}) {
    super(ctx, "chat");
    this.generalSettingsStore = new GeneralSettingsStore(config.generalSettingsFilePath);
    this.codingSettingsStore = new CodingSettingsStore(config.codingSettingsFilePath);
    this.codeReviewService = new CodeReviewService(config.reviewHistoryFilePath);
    this.repoRoot = config.repoRoot ?? process.cwd();
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

  getCodingSettings(): Promise<CodingSettingsConfig> {
    return this.codingSettingsStore.get();
  }

  updateCodingSettings(
    patch: Partial<{ git: Partial<GitCodingSettings>; codeReview: Partial<CodeReviewCodingSettings> }>,
  ): Promise<CodingSettingsConfig> {
    return this.codingSettingsStore.update(patch);
  }

  async listDiscoveredRepositories(
    candidates: Array<{ rootPath: string; name?: string; projectId?: string }>,
  ): Promise<GitRepoDiscoveryItem[]> {
    return discoverGitRepositories([{ rootPath: this.repoRoot, name: "lfaa" }, ...candidates]);
  }

  getGitStatus(targetDir?: string): Promise<GitStatusSnapshot> {
    return getGitStatus(targetDir || this.repoRoot);
  }

  getGitDiff(
    targetDir: string | undefined,
    options?: { filePath?: string; staged?: boolean; commitHash?: string },
  ) {
    return getGitDiff(targetDir || this.repoRoot, options);
  }

  stageGitFiles(targetDir: string | undefined, files: string[] | "all") {
    return stageGitFiles(targetDir || this.repoRoot, files);
  }

  unstageGitFiles(targetDir: string | undefined, files: string[] | "all") {
    return unstageGitFiles(targetDir || this.repoRoot, files);
  }

  revertGitFiles(targetDir: string | undefined, files: string[]) {
    return revertGitFiles(targetDir || this.repoRoot, files);
  }

  async checkoutGitBranch(targetDir: string | undefined, options: { name: string; create?: boolean }) {
    const cfg = await this.getCodingSettings();
    return checkoutGitBranch(targetDir || this.repoRoot, {
      ...options,
      branchPrefix: cfg.git.branchPrefix,
    });
  }

  commitGitChanges(targetDir: string | undefined, message: string) {
    return commitGitChanges(targetDir || this.repoRoot, message);
  }

  async generateGitCommitDraft(targetDir?: string) {
    const [status, cfg] = await Promise.all([this.getGitStatus(targetDir), this.getCodingSettings()]);
    return buildCommitDraft(status, cfg.git);
  }

  async generateGitPrDraft(targetDir?: string) {
    const [status, cfg] = await Promise.all([this.getGitStatus(targetDir), this.getCodingSettings()]);
    return buildPrDraft(status, cfg.git);
  }

  listCodeReviews(): Promise<CodeReviewReport[]> {
    return this.codeReviewService.listReports();
  }

  async runCodeReview(params: {
    targetDir?: string;
    scope?: ReviewScope;
    commitHash?: string;
  }): Promise<CodeReviewReport> {
    const cfg = await this.getCodingSettings();
    return this.codeReviewService.runReview({
      repoRoot: params.targetDir || this.repoRoot,
      scope: params.scope ?? "working_tree",
      ...(params.commitHash ? { commitHash: params.commitHash } : {}),
      settings: cfg.codeReview,
    });
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
