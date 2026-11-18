// 提供 LFAA 内置代码审查引擎：结合静态/差异规则分析与审查历史持久化（存于 ~/.lfaa/code-reviews.json）。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { CodeReviewCodingSettings } from "./coding-settings";
import { getGitDiff, getGitStatus, type GitStatusSnapshot } from "./git-service";

export type ReviewFindingSeverity = "critical" | "warning" | "info";
export type ReviewScope = "working_tree" | "staged" | "commit";

export interface CodeReviewFinding {
  id: string;
  severity: ReviewFindingSeverity;
  file: string;
  line?: number;
  title: string;
  detail: string;
  suggestion: string;
}

export interface CodeReviewReport {
  id: string;
  repoRoot: string;
  repoSlug: string;
  branch: string;
  scope: ReviewScope;
  commitHash?: string;
  focus: string;
  thorough: boolean;
  filesReviewed: number;
  additions: number;
  deletions: number;
  summary: string;
  findings: CodeReviewFinding[];
  createdAt: number;
}

function resolveUserHome(): string {
  return resolve(homedir() || process.env.USERPROFILE || process.env.HOME || ".");
}

export function getCodeReviewHistoryFilePath(overridePath?: string): string {
  if (overridePath) return resolve(overridePath);
  return join(resolveUserHome(), ".lfaa", "code-reviews.json");
}

interface DiffRule {
  id: string;
  severity: ReviewFindingSeverity;
  pattern: RegExp;
  title: string;
  detail: string;
  suggestion: string;
  focusMatch?: Array<CodeReviewCodingSettings["reviewAgentFocus"]>;
}

const DIFF_RULES: DiffRule[] = [
  {
    id: "merge-conflict",
    severity: "critical",
    pattern: /^(?:<{7}|={7}|>{7})\s?/u,
    title: "检测到未解决的 Git 合并冲突标记",
    detail: "新增代码行中包含 `<<<<<<<`、`=======` 或 `>>>>>>>` 冲突分隔符。",
    suggestion: "解决冲突并移除所有合并标记后再暂存提交。",
  },
  {
    id: "hardcoded-secret",
    severity: "critical",
    pattern: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{12,}["']/iu,
    title: "疑似硬编码密钥或凭据",
    detail: "新增行包含高熵敏感字符串常量，存在凭据泄漏风险。",
    suggestion: "改为从环境变量或本地加密配置读取，勿提交明文密钥。",
    focusMatch: ["balanced", "security", "strict"],
  },
  {
    id: "ts-ignore",
    severity: "warning",
    pattern: /@ts-ignore|@ts-nocheck|:\s*any\b/u,
    title: "放宽了 TypeScript 类型约束",
    detail: "使用了 `@ts-ignore`、`@ts-nocheck` 或显式 `any`，可能掩盖潜在类型错误。",
    suggestion: "使用精确接口、`unknown` 与类型守卫替代。",
    focusMatch: ["balanced", "strict"],
  },
  {
    id: "debug-leftover",
    severity: "info",
    pattern: /\b(?:console\.log|debugger)\b/u,
    title: "残留调试语句",
    detail: "发现 `console.log` 或 `debugger` 调试输出。",
    suggestion: "确认是否为刻意日志；临时调试输出建议清理。",
  },
  {
    id: "empty-catch",
    severity: "warning",
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/u,
    title: "存在空 catch 异常吞没",
    detail: "捕获异常后未处理或未记录，可能导致故障难以定位。",
    suggestion: "至少记录必要错误上下文或返回显式受控结果。",
    focusMatch: ["balanced", "strict", "performance"],
  },
];

// 基于 unified diff 逐文件与逐新增行执行确定性静态代码审查，离线亦可产出具体定位结果。
export function analyzeUnifiedDiff(params: {
  diffText: string;
  status: GitStatusSnapshot;
  settings: CodeReviewCodingSettings;
  scope: ReviewScope;
  commitHash?: string;
}): Omit<CodeReviewReport, "id" | "createdAt"> {
  const { diffText, status, settings, scope, commitHash } = params;
  const lines = diffText.split(/\r?\n/u);
  let currentFile = "";
  let newLineNo = 0;
  let additions = 0;
  let deletions = 0;
  const touchedFiles = new Set<string>();
  const findings: CodeReviewFinding[] = [];
  const seenKeys = new Set<string>();

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6).trim();
      touchedFiles.add(currentFile);
      continue;
    }
    const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/u);
    if (hunkMatch) {
      newLineNo = Number(hunkMatch[1]);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions += 1;
      const code = line.slice(1);
      for (const rule of DIFF_RULES) {
        if (!settings.thoroughReview && rule.focusMatch && !rule.focusMatch.includes(settings.reviewAgentFocus)) {
          continue;
        }
        if (rule.pattern.test(code)) {
          const dedupKey = `${rule.id}:${currentFile}:${newLineNo}`;
          if (!seenKeys.has(dedupKey)) {
            seenKeys.add(dedupKey);
            findings.push({
              id: randomUUID(),
              severity: rule.severity,
              file: currentFile || "workspace",
              ...(newLineNo ? { line: newLineNo } : {}),
              title: rule.title,
              detail: rule.detail,
              suggestion: rule.suggestion,
            });
          }
        }
      }
      newLineNo += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      deletions += 1;
      continue;
    }
    if (!line.startsWith("\\")) {
      newLineNo += 1;
    }
  }

  // 检查新增/未跟踪的敏感文件
  for (const changed of status.files) {
    if (/(?:^|\/)(?:\.env(?:\.|$)|id_rsa|id_ed25519)|(?:\.pem|\.key|\.p12)$/iu.test(changed.path)) {
      findings.push({
        id: randomUUID(),
        severity: "critical",
        file: changed.path,
        title: "变更列表包含敏感凭据文件",
        detail: `检测到工作区变更文件 \`${changed.path}\` 可能包含私钥或环境变量。`,
        suggestion: "将其加入 `.gitignore` 并从暂存区移除，切勿提交到版本库。",
      });
    }
  }

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;

  const filesCount = touchedFiles.size || (scope === "working_tree" ? status.files.length : 0);
  const customNote = settings.customReviewInstructions.trim()
    ? `；已附带自定义审查指引（${settings.customReviewInstructions.trim().slice(0, 40)}）`
    : "";

  const summary =
    filesCount === 0 && additions === 0 && deletions === 0
      ? "当前选定范围内未检测到代码变更。"
      : findings.length === 0
        ? `共审查 ${filesCount} 个变更文件（+${additions} / -${deletions} 行），未发现阻塞性风险${customNote}。`
        : `共审查 ${filesCount} 个变更文件（+${additions} / -${deletions} 行），发现 ${criticalCount} 项高危、${warningCount} 项警告与 ${infoCount} 项建议${customNote}。`;

  return {
    repoRoot: status.repoRoot,
    repoSlug: status.repoSlug,
    branch: status.branch || "HEAD",
    scope,
    ...(commitHash ? { commitHash } : {}),
    focus: settings.reviewAgentFocus,
    thorough: settings.thoroughReview,
    filesReviewed: filesCount,
    additions,
    deletions,
    summary,
    findings: findings.slice(0, 50),
  };
}

export class CodeReviewService {
  private readonly historyPath: string;

  constructor(overrideHistoryPath?: string) {
    this.historyPath = getCodeReviewHistoryFilePath(overrideHistoryPath);
  }

  async listReports(): Promise<CodeReviewReport[]> {
    try {
      const raw = await readFile(this.historyPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as CodeReviewReport[]) : [];
    } catch {
      return [];
    }
  }

  async runReview(params: {
    repoRoot: string;
    scope: ReviewScope;
    commitHash?: string;
    settings: CodeReviewCodingSettings;
  }): Promise<CodeReviewReport> {
    const status = await getGitStatus(params.repoRoot);
    if (!status.isGitRepo) {
      throw new Error(status.error || "当前目录不是有效的 Git 仓库，无法执行代码审查。");
    }
    const diffRes = await getGitDiff(status.repoRoot, {
      ...(params.scope === "staged" ? { staged: true } : {}),
      ...(params.scope === "commit" && params.commitHash ? { commitHash: params.commitHash } : {}),
    });

    const analyzed = analyzeUnifiedDiff({
      diffText: diffRes.diff,
      status,
      settings: params.settings,
      scope: params.scope,
      ...(params.commitHash ? { commitHash: params.commitHash } : {}),
    });

    const report: CodeReviewReport = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...analyzed,
    };

    const existing = await this.listReports();
    const next = [report, ...existing].slice(0, 30);
    await mkdir(dirname(this.historyPath), { recursive: true });
    await writeFile(this.historyPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return report;
  }
}
