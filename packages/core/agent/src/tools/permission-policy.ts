// 实现三种权限模式（请求批准 ask / 帮我审批 smart / 完全访问 full）的审批决策、风险识别与 3 次自动放行计数持久化。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ToolPermissionLevel } from "@lfaa/tools";
import { SMART_APPROVAL_THRESHOLD, type AgentPermissionMode } from "../types";

/** 描述规则识别出的风险及可展示给用户的原因。 */
export interface ToolRiskAssessment {
  highRisk: boolean;
  reason?: string;
}

/** 向执行循环提供审批要求、操作归类与累计信任状态。 */
export interface ApprovalDecision {
  requiresApproval: boolean;
  autoApproved: boolean;
  pattern: string;
  highRisk: boolean;
  approvalCount?: number;
  approvalThreshold?: number;
  reason?: string;
}

const DESTRUCTIVE_COMMAND_PATTERNS: RegExp[] = [
  /(?:^|\s)rm\s+-[a-z]*r[a-z]*f|\brm\s+-rf\b|\brm\s+-fr\b/iu,
  /(?:^|\s)(?:del|erase)\s+\/[a-z]*[sq]/iu,
  /(?:^|\s)rmdir\s+\/[a-z]*s/iu,
  /\bremove-item\b[^\n]*-recurse/iu,
  /\b(?:format|diskpart|bcdedit|reg\s+delete|shutdown)\b/iu,
  /\bgit\s+(?:push\s+(?:--force|-f)|reset\s+--hard|clean\s+-[a-z]*f)/iu,
  /(?:\|\s*(?:sh|bash|zsh|pwsh|powershell)|(?:iex|invoke-expression)\s*\()/iu,
];

const SENSITIVE_FILE_PATTERN = /(?:^|[\\/])(?:\.env(?:\.|$)|\.git(?:[\\/]|$)|id_rsa|id_ed25519)|(?:\.pem|\.key|\.p12|\.pfx)$/iu;

/** 解析新权限模式，同时兼容旧档案的自动审批字段。 */
export function normalizePermissionMode(mode?: unknown, autoApproveTools?: boolean): AgentPermissionMode {
  if (mode === "ask" || mode === "smart" || mode === "full") return mode;
  return autoApproveTools === true ? "full" : "ask";
}

const SENSITIVE_PROJECT_PATH_PATTERN = /(?:^|[\\/])(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^\\/]*\.json|scripts[\\/][^\\/]+|\.github[\\/][^\\/]+)$/iu;

// 归类操作签名：写/改文件区分普通文件与核心配置/锁文件/脚本，命令执行按主命令（含串联标记）归类，避免高危操作共享免审计数。
export function buildApprovalPattern(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "write_file" || toolName === "edit_file") {
    const targetPath = typeof args.path === "string" ? args.path.trim() : "";
    return SENSITIVE_PROJECT_PATH_PATTERN.test(targetPath) ? `${toolName}:sensitive` : toolName;
  }
  if (toolName !== "run_command" && toolName !== "start_background_task") return toolName;
  const raw = typeof args.command === "string" ? args.command.trim() : "";
  if (!raw) return toolName;
  const hasChain = /&&|\|\||;|\|/u.test(raw);
  const firstToken = raw
    .split(/\s+/u)[0]
    ?.replace(/^["']|["']$/gu, "")
    .toLowerCase() || "unknown";
  return hasChain ? `${toolName}:${firstToken}+chain` : `${toolName}:${firstToken}`;
}

/** 检查写入目标和命令是否命中高风险规则，为后续审批决策提供依据。 */
export function assessToolRisk(toolName: string, args: Record<string, unknown>): ToolRiskAssessment {
  if (toolName === "run_command" || toolName === "start_background_task") {
    const command = typeof args.command === "string" ? args.command : "";
    if (DESTRUCTIVE_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
      return { highRisk: true, reason: "检测到高危或破坏性终端命令，必须由用户手动确认。" };
    }
    return { highRisk: false };
  }
  if (toolName === "write_file" || toolName === "edit_file") {
    const targetPath = typeof args.path === "string" ? args.path : "";
    if (SENSITIVE_FILE_PATTERN.test(targetPath)) {
      return { highRisk: true, reason: "目标涉及环境变量或密钥配置文件，必须由用户手动确认。" };
    }
  }
  return { highRisk: false };
}

/** 结合权限模式、工具级别与累计批准数，判断是否应暂停运行等待用户确认。 */
export function evaluateToolApproval({
  mode,
  permissionLevel,
  toolName,
  args,
  approvedCount,
}: {
  mode: AgentPermissionMode;
  permissionLevel: ToolPermissionLevel;
  toolName: string;
  args: Record<string, unknown>;
  approvedCount: number;
}): ApprovalDecision {
  const pattern = buildApprovalPattern(toolName, args);
  if (permissionLevel === "read") {
    return { requiresApproval: false, autoApproved: false, pattern, highRisk: false };
  }

  const risk = assessToolRisk(toolName, args);

  if (mode === "full") {
    return {
      requiresApproval: false,
      autoApproved: true,
      pattern,
      highRisk: risk.highRisk,
      reason: "完全访问权限已自动放行",
    };
  }

  if (mode === "ask") {
    return {
      requiresApproval: true,
      autoApproved: false,
      pattern,
      highRisk: risk.highRisk,
      ...(risk.reason ? { reason: risk.reason } : {}),
    };
  }

  // 帮我审批（smart）：高危操作始终人工确认；常规操作累计批准 >= 3 次后自动放行。
  if (risk.highRisk) {
    return {
      requiresApproval: true,
      autoApproved: false,
      pattern,
      highRisk: true,
      ...(risk.reason ? { reason: risk.reason } : {}),
    };
  }

  if (approvedCount >= SMART_APPROVAL_THRESHOLD) {
    return {
      requiresApproval: false,
      autoApproved: true,
      pattern,
      highRisk: false,
      approvalCount: approvedCount,
      approvalThreshold: SMART_APPROVAL_THRESHOLD,
      reason: `帮我审批已自动放行（${pattern} 已累计授权 ${approvedCount} 次）`,
    };
  }

  return {
    requiresApproval: true,
    autoApproved: false,
    pattern,
    highRisk: false,
    approvalCount: approvedCount,
    approvalThreshold: SMART_APPROVAL_THRESHOLD,
  };
}

// 持久化“帮我审批”模式下各操作签名的批准次数，重启服务后仍保留信任记忆。
export class SmartTrustStore {
  private readonly filePath: string;
  private counts = new Map<string, number>();
  private loaded = false;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(homedir(), ".lfaa", "smart-approvals.json");
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        for (const [key, val] of Object.entries(parsed)) {
          if (typeof val === "number" && Number.isFinite(val) && val > 0) {
            this.counts.set(key, Math.floor(val));
          }
        }
      }
    } catch {
      // 首次无文件时保持空记录。
    }
  }

  private async persist(): Promise<void> {
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      const record: Record<string, number> = {};
      for (const [key, val] of this.counts.entries()) {
        if (val > 0) record[key] = val;
      }
      await writeFile(this.filePath, JSON.stringify(record, null, 2), "utf8");
    } catch {
      // 忽略只读环境持久化失败，保留内存态。
    }
  }

  async getCount(pattern: string): Promise<number> {
    await this.ensureLoaded();
    return this.counts.get(pattern) ?? 0;
  }

  async getAllCounts(): Promise<Record<string, number>> {
    await this.ensureLoaded();
    const result: Record<string, number> = {};
    for (const [key, val] of this.counts.entries()) {
      result[key] = val;
    }
    return result;
  }

  async recordDecision(pattern: string, approved: boolean, highRisk: boolean): Promise<number> {
    await this.ensureLoaded();
    if (!approved) {
      this.counts.delete(pattern);
      await this.persist();
      return 0;
    }
    if (highRisk) {
      return this.counts.get(pattern) ?? 0;
    }
    const next = (this.counts.get(pattern) ?? 0) + 1;
    this.counts.set(pattern, next);
    await this.persist();
    return next;
  }

  async resetAll(): Promise<void> {
    this.loaded = true;
    this.counts.clear();
    await this.persist();
  }
}
