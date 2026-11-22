// @lfaa/review Host 侧 Cordis 服务：内置 Git 变更操作、编码设置持久化与代码审查引擎。
import { type Context, Service } from "@deepseek-ai/cordis";
import {
  CodingSettingsStore,
  type CodeReviewCodingSettings,
  type CodingSettingsConfig,
  type GitCodingSettings,
} from "@lfaa/settings";
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

export { createCodingHttpHandler } from "./git-http-handler";
export {
  CodingSettingsStore,
  getCodingSettingsFilePath,
  type CodeReviewCodingSettings,
  type CodingSettingsConfig,
  type GitCodingSettings,
} from "@lfaa/settings";
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

/** 提供编码配置与审查历史所需的 Host 路径及可注入依赖。 */
export interface ReviewPluginConfig {
  codingSettingsFilePath?: string;
  reviewHistoryFilePath?: string;
  repoRoot?: string;
}

/** 编排 Git 变更、编码设置与代码审查，为工作台与审查界面提供 Host 入口。 */
export class ReviewService extends Service {
  private readonly codingSettingsStore: CodingSettingsStore;
  private readonly codeReviewService: CodeReviewService;
  private readonly repoRoot: string;

  constructor(ctx: Context, config: ReviewPluginConfig = {}) {
    super(ctx, "review");
    this.codingSettingsStore = new CodingSettingsStore(config.codingSettingsFilePath);
    this.codeReviewService = new CodeReviewService(config.reviewHistoryFilePath);
    this.repoRoot = config.repoRoot ?? process.cwd();
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
    options?: { filePath?: string; staged?: boolean; commitHash?: string; statOnly?: boolean },
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

/** 为 Cordis 上下文安装代码审查服务。 */
export function reviewPlugin(context: Context, config: ReviewPluginConfig = {}): void {
  new ReviewService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    review: ReviewService;
  }
}
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default reviewPlugin;