// 管理 LFAA「设置 → 编码（Git 与代码审查）」持久化配置（存于 ~/.lfaa/coding-settings.json）。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type PrMergeMethod = "merge" | "squash";
export type ReviewDisplayMode = "inline" | "separate";
export type ReviewTriggerCondition = "on_pr_open" | "on_push" | "manual";
export type RepoAutoReviewMode = "inherit" | "enabled" | "disabled";
export type RepoProviderKind = "local" | "github";
export type ReviewAgentFocus = "balanced" | "security" | "performance" | "strict";

export interface GitCodingSettings {
  branchPrefix: string;
  prMergeMethod: PrMergeMethod;
  alwaysForcePush: boolean;
  createDraftPr: boolean;
  reviewDisplayMode: ReviewDisplayMode;
  commitInstructions: string;
  prInstructions: string;
}

export interface CodeReviewCodingSettings {
  activeSubTab: "preferences" | "agent";
  repoProvider: RepoProviderKind;
  autoReview: boolean;
  triggerCondition: ReviewTriggerCondition;
  thoroughReview: boolean;
  useQuotaForReview: boolean;
  reviewAgentFocus: ReviewAgentFocus;
  customReviewInstructions: string;
  repoOverrides: Record<string, RepoAutoReviewMode>;
}

export interface CodingSettingsConfig {
  schemaVersion: number;
  git: GitCodingSettings;
  codeReview: CodeReviewCodingSettings;
  updatedAt: number;
}

function resolveUserHome(): string {
  return resolve(homedir() || process.env.USERPROFILE || process.env.HOME || ".");
}

export function getCodingSettingsFilePath(overridePath?: string): string {
  if (overridePath) return resolve(overridePath);
  return join(resolveUserHome(), ".lfaa", "coding-settings.json");
}

export function createDefaultCodingSettings(): CodingSettingsConfig {
  return {
    schemaVersion: 1,
    git: {
      branchPrefix: "lfaa/",
      prMergeMethod: "merge",
      alwaysForcePush: false,
      createDraftPr: true,
      reviewDisplayMode: "inline",
      commitInstructions: "",
      prInstructions: "",
    },
    codeReview: {
      activeSubTab: "preferences",
      repoProvider: "local",
      autoReview: false,
      triggerCondition: "on_pr_open",
      thoroughReview: false,
      useQuotaForReview: false,
      reviewAgentFocus: "balanced",
      customReviewInstructions: "",
      repoOverrides: {},
    },
    updatedAt: Date.now(),
  };
}

function sanitizeBranchPrefix(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw.trim().replace(/\s+/gu, "-").replace(/^\/+|(\.\.)/gu, "");
  return cleaned || fallback;
}

function normalizeGitSettings(raw: Partial<GitCodingSettings> | undefined, base: GitCodingSettings): GitCodingSettings {
  if (!raw) return { ...base };
  return {
    branchPrefix: sanitizeBranchPrefix(raw.branchPrefix, base.branchPrefix),
    prMergeMethod: raw.prMergeMethod === "squash" || raw.prMergeMethod === "merge" ? raw.prMergeMethod : base.prMergeMethod,
    alwaysForcePush: typeof raw.alwaysForcePush === "boolean" ? raw.alwaysForcePush : base.alwaysForcePush,
    createDraftPr: typeof raw.createDraftPr === "boolean" ? raw.createDraftPr : base.createDraftPr,
    reviewDisplayMode:
      raw.reviewDisplayMode === "inline" || raw.reviewDisplayMode === "separate"
        ? raw.reviewDisplayMode
        : base.reviewDisplayMode,
    commitInstructions: typeof raw.commitInstructions === "string" ? raw.commitInstructions : base.commitInstructions,
    prInstructions: typeof raw.prInstructions === "string" ? raw.prInstructions : base.prInstructions,
  };
}

function normalizeRepoOverrides(
  raw: Record<string, unknown> | undefined,
  base: Record<string, RepoAutoReviewMode>,
): Record<string, RepoAutoReviewMode> {
  if (!raw || typeof raw !== "object") return { ...base };
  const next: Record<string, RepoAutoReviewMode> = { ...base };
  for (const [repoKey, value] of Object.entries(raw)) {
    const trimmedKey = repoKey.trim();
    if (!trimmedKey) continue;
    if (value === "inherit" || value === "enabled" || value === "disabled") {
      next[trimmedKey] = value;
    }
  }
  return next;
}

function normalizeCodeReviewSettings(
  raw: Partial<CodeReviewCodingSettings> | undefined,
  base: CodeReviewCodingSettings,
): CodeReviewCodingSettings {
  if (!raw) return { ...base, repoOverrides: { ...base.repoOverrides } };
  return {
    activeSubTab: raw.activeSubTab === "agent" || raw.activeSubTab === "preferences" ? raw.activeSubTab : base.activeSubTab,
    repoProvider: raw.repoProvider === "github" || raw.repoProvider === "local" ? raw.repoProvider : base.repoProvider,
    autoReview: typeof raw.autoReview === "boolean" ? raw.autoReview : base.autoReview,
    triggerCondition:
      raw.triggerCondition === "on_pr_open" || raw.triggerCondition === "on_push" || raw.triggerCondition === "manual"
        ? raw.triggerCondition
        : base.triggerCondition,
    thoroughReview: typeof raw.thoroughReview === "boolean" ? raw.thoroughReview : base.thoroughReview,
    useQuotaForReview: typeof raw.useQuotaForReview === "boolean" ? raw.useQuotaForReview : base.useQuotaForReview,
    reviewAgentFocus:
      raw.reviewAgentFocus === "balanced" ||
      raw.reviewAgentFocus === "security" ||
      raw.reviewAgentFocus === "performance" ||
      raw.reviewAgentFocus === "strict"
        ? raw.reviewAgentFocus
        : base.reviewAgentFocus,
    customReviewInstructions:
      typeof raw.customReviewInstructions === "string" ? raw.customReviewInstructions : base.customReviewInstructions,
    repoOverrides: normalizeRepoOverrides(raw.repoOverrides as Record<string, unknown> | undefined, base.repoOverrides),
  };
}

export function normalizeCodingSettings(
  raw: Partial<{ git: Partial<GitCodingSettings>; codeReview: Partial<CodeReviewCodingSettings> }>,
  base: CodingSettingsConfig,
): CodingSettingsConfig {
  return {
    schemaVersion: 1,
    git: normalizeGitSettings(raw.git, base.git),
    codeReview: normalizeCodeReviewSettings(raw.codeReview, base.codeReview),
    updatedAt: Date.now(),
  };
}

export class CodingSettingsStore {
  private readonly filePath: string;
  private cached: CodingSettingsConfig | null = null;

  constructor(overridePath?: string) {
    this.filePath = getCodingSettingsFilePath(overridePath);
  }

  getFilePath(): string {
    return this.filePath;
  }

  async get(): Promise<CodingSettingsConfig> {
    if (this.cached) return this.cached;
    const defaults = createDefaultCodingSettings();
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<CodingSettingsConfig>;
      this.cached = normalizeCodingSettings(parsed, defaults);
      return this.cached;
    } catch {
      this.cached = defaults;
      await this.persist(this.cached);
      return this.cached;
    }
  }

  async update(
    patch: Partial<{ git: Partial<GitCodingSettings>; codeReview: Partial<CodeReviewCodingSettings> }>,
  ): Promise<CodingSettingsConfig> {
    const current = await this.get();
    this.cached = normalizeCodingSettings(patch, current);
    await this.persist(this.cached);
    return this.cached;
  }

  private async persist(cfg: CodingSettingsConfig): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
  }
}
