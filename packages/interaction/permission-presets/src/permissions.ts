/**
 * 功能：提供由 server 核心持有的 AI 工具授权、单次审批和记忆授权。
 * 作用：将账户模式绑定到已登记工具、版本、风险与目标范围；单次批准仍绑定完整参数且只能消费一次。
 * 不负责：执行工具。工具执行器必须在操作前重新校验并消费对应审批。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/settings/settings/src/service.ts、packages/api/gateway/src/index.ts、packages/client/ui-settings/src/SettingsPage.tsx。
 */
import { createHash, randomUUID } from "node:crypto";
import { database } from "lfaa-storage-sqlite/src/database.js";
import type { ApplicationId } from "lfaa-settings/src/preferences/service.js";
import { getUserSettings } from "lfaa-settings/src/service.js";

export type AiToolRisk = "read" | "write" | "dangerous";
export type AiToolAuthorization = "allow" | "approval_required" | "deny";

export class AiPermissionModeChangedError extends Error {
  constructor() {
    super("只有“替我审批”模式可以保存记忆授权。");
    this.name = "AiPermissionModeChangedError";
  }
}

export interface AiToolPolicyInput {
  userId: string;
  activeApplicationId: ApplicationId;
  toolApplicationIds: ApplicationId[];
  toolId: string;
  toolVersion: string;
  risk: AiToolRisk;
  /** 由受信任业务服务提供的稳定目标身份；不得直接采用模型生成的路径或范围。 */
  scopeKey: string;
  executable: boolean;
}

export interface AiToolApprovalView {
  id: string;
  sessionId: string;
  appId: ApplicationId;
  toolId: string;
  toolVersion: string;
  risk: AiToolRisk;
  summary: string;
  scopeSummary: string;
  status: "pending" | "approved" | "denied" | "consumed" | "expired";
  requestedAt: string;
  expiresAt: string;
  decidedAt: string | null;
}

export interface AiToolPermissionGrantView {
  id: string;
  appId: ApplicationId;
  toolId: string;
  toolVersion: string;
  risk: Exclude<AiToolRisk, "read">;
  summary: string;
  scopeSummary: string;
  createdAt: string;
}

type ApprovalRow = {
  id: string;
  session_id: string;
  app_id: ApplicationId;
  tool_id: string;
  tool_version: string | null;
  risk: AiToolRisk;
  summary: string;
  scope_summary?: string | null;
  scope_hash?: string | null;
  status: AiToolApprovalView["status"];
  requested_at: string;
  expires_at: string;
  decided_at: string | null;
};

type PermissionGrantRow = {
  id: string;
  app_id: ApplicationId;
  tool_id: string;
  tool_version: string;
  risk: Exclude<AiToolRisk, "read">;
  summary: string;
  scope_summary: string;
  created_at: string;
};

function mapApproval(row: ApprovalRow): AiToolApprovalView {
  return {
    id: row.id,
    sessionId: row.session_id,
    appId: row.app_id,
    toolId: row.tool_id,
    toolVersion: row.tool_version ?? "legacy",
    risk: row.risk,
    summary: row.summary,
    scopeSummary: row.scope_summary ?? "旧审批未记录目标范围",
    status: row.status,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    decidedAt: row.decided_at
  };
}

function mapPermissionGrant(row: PermissionGrantRow): AiToolPermissionGrantView {
  return {
    id: row.id,
    appId: row.app_id,
    toolId: row.tool_id,
    toolVersion: row.tool_version,
    risk: row.risk,
    summary: row.summary,
    scopeSummary: row.scope_summary,
    createdAt: row.created_at
  };
}

function normalizeIdentity(value: string, label: string, maxLength: number): string {
  const normalized = value.normalize("NFC").trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`${label}无效。`);
  }
  return normalized;
}

function authorizationScopeHash(input: {
  appId: ApplicationId;
  toolId: string;
  toolVersion: string;
  risk: Exclude<AiToolRisk, "read">;
  scopeKey: string;
}): string {
  const toolId = normalizeIdentity(input.toolId, "工具标识", 120);
  const toolVersion = normalizeIdentity(input.toolVersion, "工具版本", 80);
  const scopeKey = normalizeIdentity(input.scopeKey, "操作目标范围", 512);
  return createHash("sha256").update(JSON.stringify([input.appId, toolId, toolVersion, input.risk, scopeKey])).digest("hex");
}

export function authorizeAiTool(input: AiToolPolicyInput): AiToolAuthorization {
  if (!input.executable || !input.toolApplicationIds.includes(input.activeApplicationId)) return "deny";
  if (input.risk === "read") return "allow";
  if (input.risk !== "write" && input.risk !== "dangerous") return "deny";
  const mode = getUserSettings(input.userId).permissions.mode;
  if (mode === "full_access") return "allow";

  let scopeHash: string;
  let toolId: string;
  let toolVersion: string;
  try {
    toolId = normalizeIdentity(input.toolId, "工具标识", 120);
    toolVersion = normalizeIdentity(input.toolVersion, "工具版本", 80);
    scopeHash = authorizationScopeHash({
      appId: input.activeApplicationId,
      toolId,
      toolVersion,
      risk: input.risk,
      scopeKey: input.scopeKey
    });
  } catch {
    // 没有受信任的稳定目标范围时，即使选择完全权限也不能执行副作用操作。
    return "deny";
  }

  if (mode === "approve_remembered") {
    const remembered = database.prepare(`
      SELECT 1 FROM ai_tool_permission_grants
      WHERE user_id = ? AND app_id = ? AND tool_id = ? AND tool_version = ? AND risk = ? AND scope_hash = ?
      LIMIT 1
    `).get(input.userId, input.activeApplicationId, toolId, toolVersion, input.risk, scopeHash);
    if (remembered) return "allow";
  }
  return mode === "ask" || mode === "approve_remembered" ? "approval_required" : "deny";
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
  }
  throw new Error("AI 工具参数必须是 JSON 数据。");
}

function actionHash(input: { toolId: string; toolVersion: string; appId: ApplicationId; risk: Exclude<AiToolRisk, "read">; scopeHash: string; parameters: unknown }): string {
  const toolId = normalizeIdentity(input.toolId, "工具标识", 120);
  const toolVersion = normalizeIdentity(input.toolVersion, "工具版本", 80);
  const canonical = JSON.stringify(canonicalize(input.parameters));
  return createHash("sha256").update(JSON.stringify([input.appId, toolId, toolVersion, input.risk, input.scopeHash, canonical])).digest("hex");
}

/** 仅供 server 工具协调器创建审批；目标范围和参数只保存哈希，不落盘。 */
export function requestAiToolApproval(input: {
  userId: string;
  sessionId: string;
  appId: ApplicationId;
  toolId: string;
  toolVersion: string;
  risk: AiToolRisk;
  scopeKey: string;
  scopeSummary: string;
  summary: string;
  parameters: unknown;
}): AiToolApprovalView {
  if (input.risk === "read") throw new Error("只读工具不应创建审批请求。");
  const summary = input.summary.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 500);
  const scopeSummary = input.scopeSummary.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 240);
  const toolId = normalizeIdentity(input.toolId, "工具标识", 120);
  const toolVersion = normalizeIdentity(input.toolVersion, "工具版本", 80);
  const scopeHash = authorizationScopeHash({ ...input, toolId, toolVersion, risk: input.risk });
  if (!summary || !scopeSummary) throw new Error("工具审批信息或目标范围说明无效。");
  const session = database.prepare("SELECT app_id FROM ai_sessions WHERE id = ? AND user_id = ?").get(input.sessionId, input.userId) as { app_id: ApplicationId } | undefined;
  if (!session || session.app_id !== input.appId) throw new Error("找不到此应用下的 AI 会话。");

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  database.prepare(`
    INSERT INTO ai_tool_approvals (id, user_id, session_id, app_id, tool_id, tool_version, risk, summary, scope_summary, action_hash, scope_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.userId, input.sessionId, input.appId, toolId, toolVersion, input.risk, summary, scopeSummary, actionHash({ toolId, toolVersion, appId: input.appId, risk: input.risk, scopeHash, parameters: input.parameters }), scopeHash, expiresAt);
  const row = database.prepare("SELECT id, session_id, app_id, tool_id, tool_version, risk, summary, scope_summary, status, requested_at, expires_at, decided_at FROM ai_tool_approvals WHERE id = ? AND user_id = ?").get(id, input.userId) as ApprovalRow;
  return mapApproval(row);
}

export function listAiToolApprovals(userId: string, status?: AiToolApprovalView["status"]): AiToolApprovalView[] {
  database.prepare("UPDATE ai_tool_approvals SET status = 'expired' WHERE user_id = ? AND status IN ('pending', 'approved') AND julianday(expires_at) <= julianday('now')").run(userId);
  const columns = "id, session_id, app_id, tool_id, tool_version, risk, summary, scope_summary, status, requested_at, expires_at, decided_at";
  const rows = status
    ? database.prepare(`SELECT ${columns} FROM ai_tool_approvals WHERE user_id = ? AND status = ? ORDER BY requested_at DESC LIMIT 100`).all(userId, status)
    : database.prepare(`SELECT ${columns} FROM ai_tool_approvals WHERE user_id = ? ORDER BY requested_at DESC LIMIT 100`).all(userId);
  return (rows as ApprovalRow[]).map(mapApproval);
}

export function decideAiToolApproval(userId: string, approvalId: string, decision: "approved" | "denied", remember = false): AiToolApprovalView | null {
  if (remember && decision !== "approved") throw new Error("拒绝的操作不能保存为记忆授权。");

  database.exec("BEGIN IMMEDIATE;");
  try {
    if (remember && getUserSettings(userId).permissions.mode !== "approve_remembered") {
      throw new AiPermissionModeChangedError();
    }
    const result = database.prepare("UPDATE ai_tool_approvals SET status = ?, decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), decided_by = ? WHERE id = ? AND user_id = ? AND status = 'pending' AND julianday(expires_at) > julianday('now')").run(decision, userId, approvalId, userId);
    if (result.changes !== 1) {
      database.exec("ROLLBACK;");
      return null;
    }

    const approval = database.prepare("SELECT id, session_id, app_id, tool_id, tool_version, risk, summary, scope_summary, scope_hash, status, requested_at, expires_at, decided_at FROM ai_tool_approvals WHERE id = ? AND user_id = ?").get(approvalId, userId) as ApprovalRow;
    if (remember) {
      if (!approval.tool_version || !approval.scope_hash || !approval.scope_summary || approval.risk === "read") throw new Error("此审批缺少可记忆的工具版本或目标范围。");
      const grantId = randomUUID();
      database.prepare(`
        INSERT INTO ai_tool_permission_grants (id, user_id, app_id, tool_id, tool_version, risk, scope_hash, summary, scope_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, app_id, tool_id, tool_version, risk, scope_hash)
        DO UPDATE SET summary = excluded.summary, scope_summary = excluded.scope_summary, created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `).run(grantId, userId, approval.app_id, approval.tool_id, approval.tool_version, approval.risk, approval.scope_hash, approval.summary, approval.scope_summary);
    }

    database.exec("COMMIT;");
    return mapApproval(approval);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function listAiToolPermissionGrants(userId: string): AiToolPermissionGrantView[] {
  const rows = database.prepare(`
    SELECT id, app_id, tool_id, tool_version, risk, summary, scope_summary, created_at
    FROM ai_tool_permission_grants WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(userId) as PermissionGrantRow[];
  return rows.map(mapPermissionGrant);
}

export function revokeAiToolPermissionGrant(userId: string, grantId: string): boolean {
  return database.prepare("DELETE FROM ai_tool_permission_grants WHERE id = ? AND user_id = ?").run(grantId, userId).changes === 1;
}

/** 工具执行前调用；只匹配同一用户、工具、应用与完整参数摘要的单次批准。 */
export function consumeAiToolApproval(input: { userId: string; approvalId: string; appId: ApplicationId; toolId: string; toolVersion: string; risk: Exclude<AiToolRisk, "read">; scopeKey: string; parameters: unknown }): boolean {
  database.prepare("UPDATE ai_tool_approvals SET status = 'expired' WHERE id = ? AND user_id = ? AND status = 'approved' AND julianday(expires_at) <= julianday('now')").run(input.approvalId, input.userId);
  let scopeHash: string;
  let actionDigest: string;
  let toolId: string;
  let toolVersion: string;
  try {
    toolId = normalizeIdentity(input.toolId, "工具标识", 120);
    toolVersion = normalizeIdentity(input.toolVersion, "工具版本", 80);
    scopeHash = authorizationScopeHash({ appId: input.appId, toolId, toolVersion, risk: input.risk, scopeKey: input.scopeKey });
    actionDigest = actionHash({ toolId, toolVersion, appId: input.appId, risk: input.risk, scopeHash, parameters: input.parameters });
  } catch {
    return false;
  }
  const result = database.prepare("UPDATE ai_tool_approvals SET status = 'consumed' WHERE id = ? AND user_id = ? AND app_id = ? AND tool_id = ? AND tool_version = ? AND risk = ? AND scope_hash = ? AND action_hash = ? AND status = 'approved' AND julianday(expires_at) > julianday('now')").run(
    input.approvalId,
    input.userId,
    input.appId,
    toolId,
    toolVersion,
    input.risk,
    scopeHash,
    actionDigest
  );
  return result.changes === 1;
}
