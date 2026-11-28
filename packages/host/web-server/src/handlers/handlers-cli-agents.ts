// @lfaa/web-server：官方 CLI 代理管理 HTTP 路由（本机探测、配置、多账户隔离与终端命令生成）。
// 关联：packages/host/web-server/src/cli-agents/store.ts；运行环境：Node Host。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiHandler } from "@lfaa/api-gateway";
import type { CliAgentMode } from "../cli-agents/catalog";
import type { CliAgentsStore } from "../cli-agents/store";

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

/** 构造可供用户在 PowerShell / Bash 终端一键粘贴或自动执行的命令串（含隔离账户环境变量）。 */
function formatShellCommand(
  baseCommand: string,
  extraArgs: string,
  envOverlay: Record<string, string>,
): string {
  const fullCmd = extraArgs.trim() ? `${baseCommand} ${extraArgs.trim()}` : baseCommand;
  const entries = Object.entries(envOverlay);
  if (entries.length === 0) return fullCmd;
  if (process.platform === "win32") {
    const prefix = entries
      .map(([k, v]) => `$env:${k}="${v.replace(/"/gu, "`\"")}"`)
      .join("; ");
    return `${prefix}; ${fullCmd}`;
  }
  const prefix = entries
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(" ");
  return `${prefix} ${fullCmd}`;
}

export function createCliAgentsHandler(store: CliAgentsStore): ApiHandler {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const pathname = (req.url ?? "").split("?")[0] ?? "";
    if (!pathname.startsWith("/api/cli-agents")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && pathname === "/api/cli-agents") {
        sendJson(res, 200, await store.getOverview());
        return true;
      }

      if (method === "POST" && pathname === "/api/cli-agents/refresh") {
        sendJson(res, 200, await store.getOverview({ refresh: true }));
        return true;
      }

      if (method === "PATCH" && pathname === "/api/cli-agents/settings") {
        const body = await readJsonBody(req);
        const mode = body.defaultOpenMode === "terminal" ? "terminal" : body.defaultOpenMode === "chat" ? "chat" : undefined;
        sendJson(res, 200, await store.updateGlobal(mode ? { defaultOpenMode: mode } : {}));
        return true;
      }

      const agentMatch = /^\/api\/cli-agents\/([^/]+)$/u.exec(pathname);
      if (method === "PATCH" && agentMatch?.[1]) {
        const agentId = decodeURIComponent(agentMatch[1]);
        const body = await readJsonBody(req);
        const openMode: CliAgentMode | undefined = body.openMode === "terminal"
          ? "terminal"
          : body.openMode === "chat"
            ? "chat"
            : undefined;
        const overview = await store.updateAgent(agentId, {
          ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
          ...(openMode ? { openMode } : {}),
          ...(typeof body.extraArgs === "string" ? { extraArgs: body.extraArgs } : {}),
          ...(body.activeAccountId === null || typeof body.activeAccountId === "string"
            ? { activeAccountId: body.activeAccountId }
            : {}),
        });
        sendJson(res, 200, overview);
        return true;
      }

      const addAccountMatch = /^\/api\/cli-agents\/([^/]+)\/accounts$/u.exec(pathname);
      if (method === "POST" && addAccountMatch?.[1]) {
        const agentId = decodeURIComponent(addAccountMatch[1]);
        const body = await readJsonBody(req);
        const label = typeof body.label === "string" ? body.label : "";
        const result = await store.addAccount(agentId, label);
        sendJson(res, 200, result);
        return true;
      }

      const delAccountMatch = /^\/api\/cli-agents\/([^/]+)\/accounts\/([^/]+)$/u.exec(pathname);
      if (method === "DELETE" && delAccountMatch?.[1] && delAccountMatch?.[2]) {
        const agentId = decodeURIComponent(delAccountMatch[1]);
        const accountId = decodeURIComponent(delAccountMatch[2]);
        sendJson(res, 200, await store.removeAccount(agentId, accountId));
        return true;
      }

      const cmdMatch = /^\/api\/cli-agents\/([^/]+)\/command$/u.exec(pathname);
      if (method === "POST" && cmdMatch?.[1]) {
        const agentId = decodeURIComponent(cmdMatch[1]);
        const body = await readJsonBody(req);
        const action = body.action === "login" ? "login" : "terminal";
        const { snapshot, envOverlay, activeAccount } = await store.resolveAgentExecution(agentId);
        const base = action === "login" ? snapshot.loginCommand : snapshot.terminalCommand;
        const command = formatShellCommand(base, action === "terminal" ? snapshot.extraArgs : "", envOverlay);
        sendJson(res, 200, {
          agentId,
          action,
          command,
          envOverlay,
          accountLabel: activeAccount?.label ?? null,
        });
        return true;
      }

      sendJson(res, 404, { error: "未找到 CLI 代理接口。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
