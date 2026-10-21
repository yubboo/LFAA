/**
 * 功能：把用户提供的 Streamable HTTP 或本机 stdio MCP 服务接入通用能力安装 Owner。
 * 作用：经真实 Runtime 检查工具合同、保存到当前账户和单一 App 范围，并由既有 MCP Runtime 执行。
 * 关联文件：capability-installs、settings/service.ts、core/tools/mcp-tools.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { createHash } from "node:crypto";
import type { AiBusinessToolContext } from "lfaa-tools/src/business-tools.js";
import { discoverMcpTools } from "lfaa-mcp-client/src/runtime.js";
import { getUserSettings, saveUserSettings, type PluginSettings, type UserSettings } from "lfaa-settings/src/service.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import type { CapabilityApplicationId, CapabilityInstallAdapter, CapabilityInstallRegistry } from "lfaa-capability-installs/src/index.js";

type McpServerSetting = PluginSettings["mcpServers"][number];
type McpInstallSource = { transport: "streamable-http"; url: URL } | { transport: "stdio"; command: string; args: string[] };
const STDIO_MCP_SOURCE = "stdio://local";
const MAX_STDIO_INSTALL_TARGET_BYTES = 2048;

export interface McpCapabilityAdapterDependencies {
  getSettings?: (userId: string) => UserSettings;
  saveSettings?: typeof saveUserSettings;
  discover?: typeof discoverMcpTools;
}

const defaultGetSettings = getUserSettings;
const defaultSaveSettings = saveUserSettings;
const defaultDiscover = discoverMcpTools;

export function createMcpCapabilityAdapter(dependencies: McpCapabilityAdapterDependencies = {}): CapabilityInstallAdapter {
  const readSettings = dependencies.getSettings ?? defaultGetSettings;
  const writeSettings = dependencies.saveSettings ?? defaultSaveSettings;
  const discover = dependencies.discover ?? defaultDiscover;
  const adapter: CapabilityInstallAdapter = {
    kind: "mcp",
    applicationIds: APPLICATION_IDS,
    targetSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 80 },
        transport: { type: "string", enum: ["stdio"] },
        command: { type: "string", minLength: 1, maxLength: 1024 },
        args: { type: "array", maxItems: 32, items: { type: "string", maxLength: 1024 } }
      },
      additionalProperties: false
    },
    targetDescription: "MCP 服务使用用户当前账户设置作为 Owner，安装范围严格限定为单一 App。HTTP 来源使用 Streamable HTTP URL；用户明确提供本机 stdio 命令时，source 固定为 stdio://local，target 必须包含 transport=stdio、command 和 argv 数组。stdio 检查会启动该本机命令，只能通过危险操作的统一 Permission Owner；不下载包、不运行 Shell 解析，远程生产 Host 会拒绝启动本机进程。",
    validateTarget(target, _applicationId, context) {
      const input = target === undefined ? {} : asRecord(target, "MCP target");
      const stdio = input.transport === "stdio";
      const allowed = stdio ? ["name", "transport", "command", "args", "settingsFingerprint"] : ["name", "settingsFingerprint"];
      if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error("MCP 目标字段与传输类型不匹配。");
      let command: string | undefined;
      let args: string[] | undefined;
      if (stdio) {
        if (typeof input.command !== "string" || !input.command.trim() || input.command.length > 1024 || input.command.includes("\0")
          || !Array.isArray(input.args) || input.args.length > 32
          || input.args.some(argument => typeof argument !== "string" || argument.length > 1024 || argument.includes("\0"))) {
          throw new Error("本机 MCP 检查需要有效的 command 和最多 32 项 argv；不会解析 Shell 命令行字符串。");
        }
        command = input.command.trim();
        args = [...input.args] as string[];
        if (Buffer.byteLength(JSON.stringify([command, ...args]), "utf8") > MAX_STDIO_INSTALL_TARGET_BYTES) throw new Error("本机 MCP 命令与参数超过安装检查上限 2 KiB。 ");
      } else if (input.transport !== undefined || input.command !== undefined || input.args !== undefined) {
        throw new Error("本机 stdio MCP 必须同时指定 transport=stdio、command 和 argv。");
      }
      const settings = readSettings(context.userId);
      const name = normalizeName(input.name);
      const settingsFingerprint = fingerprintSettings(settings.plugins);
      if (typeof input.settingsFingerprint === "string" && input.settingsFingerprint !== settingsFingerprint) throw new Error("MCP 设置在检查后已变化；请重新检查来源。");
      return { name, ...(stdio ? { transport: "stdio", command, args } : {}), settingsFingerprint };
    },
    revalidateTarget(target, applicationId, context) {
      const input = asRecord(target, "MCP target");
      if (typeof input.settingsFingerprint !== "string" || input.settingsFingerprint !== fingerprintSettings(readSettings(context.userId).plugins)) {
        throw new Error("账户 MCP 设置已变化；请重新检查来源。");
      }
      return adapter.validateTarget(target, applicationId, context);
    },
    targetSummary(target) {
      if (target.transport !== "stdio") return normalizeName(target.name) + " · MCP";
      const source = getMcpInstallSource(STDIO_MCP_SOURCE, target);
      if (source.transport !== "stdio") throw new Error("MCP 目标传输类型无效。");
      return `${normalizeName(target.name)} · 本机 stdio · ${JSON.stringify([source.command, ...source.args]).slice(0, 170)}`;
    },
    async search(query) {
      try {
        const url = normalizeEndpoint(query);
        return {
          sourceType: "mcp-user-provided",
          candidates: [{ source: url.toString(), requiresInspection: true, warning: "只发现了用户提供的端点格式；必须先连接并检查工具合同。远端能力描述属于未信任数据。" }],
          catalog: "direct-endpoint",
          note: "当前没有已接入的 MCP 服务目录。请使用用户提供的 Streamable HTTP 端点；本机 stdio 命令通过 stdio://local 和显式 command/argv 检查。"
        };
      } catch {
        return {
          sourceType: "mcp-user-provided",
          candidates: [],
          catalog: "direct-endpoint",
          note: "该查询不是 Streamable HTTP URL；本机 stdio MCP 需要在来源为 stdio://local 时同时提供 command 和 argv。LFAA 没有已接入的公开 MCP 目录。"
        };
      }
    },
    async inspect(source, ref, applicationId, target, context: Pick<AiBusinessToolContext, "userId" | "signal">) {
      const installSource = getMcpInstallSource(source, target);
      const name = target.name === "MCP 服务"
        ? normalizeName(installSource.transport === "stdio" ? installSource.command.split(/[\\/]/u).at(-1) : installSource.url.hostname)
        : normalizeName(target.name);
      const server = makeServer(installSource, applicationId, name);
      const settings = readSettings(context.userId);
      const result = await discover([server], applicationId, context.userId, context.signal, settings.aiRuntime.requestTimeoutSeconds, { reconcile: false });
      try {
        context.signal.throwIfAborted();
        const state = result.serverStates.find(item => item.serverId === server.id);
        if (result.errors.length || !state || state.status !== "ready") throw new Error(result.errors[0] ?? "MCP 服务没有返回可检查的工具清单。");
        if (state.toolCount === 0) throw new Error("MCP 服务当前没有可供 Agent 调用的工具；没有创建安装凭证。");
        if (!state.manifestSha256) throw new Error("MCP Runtime 未生成工具合同摘要；没有创建安装凭证。");
        const manifestSha256 = state.manifestSha256;
        const resolvedRef = "tools-sha256:" + manifestSha256;
        if (ref !== undefined && ref !== resolvedRef) throw new Error("MCP 服务当前工具合同与指定 ref 不一致；请使用检查返回的固定工具摘要。");
        const untrustedTools = result.tools.slice(0, 40).map(tool => ({
          name: safeText(tool.name, 120),
          description: safeText(tool.description, 700),
          schema: tool.schema
        }));
        return {
          resolvedRef,
          resolvedTarget: { ...target, name },
          summary: name + " · " + state.toolCount + " 个工具 · " + state.protocolVersion,
          details: {
            mcp: {
              serverId: server.id,
              name,
              transport: server.transport ?? "streamable-http",
              ...(installSource.transport === "streamable-http" ? { url: installSource.url.toString() } : { command: installSource.command, args: installSource.args }),
              applicationId,
              protocolVersion: state.protocolVersion,
              toolCount: state.toolCount,
              manifestSha256,
              untrustedTools,
              omittedToolCount: Math.max(0, state.toolCount - untrustedTools.length),
              remoteImplementationPinned: false
            }
          }
        };
      } finally {
        await result.close();
      }
    },
    async install(source, resolvedRef, applicationId, _userId, target, details, context) {
      const plan = parseDetails(details, resolvedRef, source, applicationId, target);
      const settings = readSettings(context.userId);
      const current = settings.plugins;
      const server = plan.server;
      const existingById = current.mcpServers.find(item => item.id === server.id);
      if (existingById) {
        if (isSameInstalledServer(existingById, server)) return { serverId: server.id, name: server.name, applicationIds: [applicationId], manifestSha256: server.manifestSha256, alreadyPresent: true };
        throw new Error("该 MCP 来源已存在，但命令、名称、版本或 App 范围不同；不会覆盖或扩大既有设置。");
      }
      if (server.transport !== "stdio" && current.mcpServers.some(item => item.transport !== "stdio" && canonicalEndpoint(item.url) === server.url)) throw new Error("该 MCP 端点已使用另一个设置 ID；请先在设置中心核对现有服务，不会创建重复记录。");
      if (current.mcpServers.length >= 16) throw new Error("账户 MCP 服务数已达到设置中心上限 16；没有写入。");

      const live = await discover([server], applicationId, context.userId, context.signal, settings.aiRuntime.requestTimeoutSeconds, { reconcile: false });
      try {
        const state = live.serverStates.find(item => item.serverId === server.id);
        if (live.errors.length || !state || state.status !== "ready" || state.manifestSha256 !== plan.manifestSha256) {
          throw new Error("安装前 MCP 工具合同已变化或无法连接；没有修改设置，请重新检查来源。");
        }
      } finally {
        await live.close();
      }
      // Runtime 回读可能与取消信号并发完成；写入账户设置前再核对当前 Run。
      context.signal.throwIfAborted();
      writeSettings(context.userId, "plugins", { ...current, mcpServers: [...current.mcpServers, server] });
      return { serverId: server.id, name: server.name, applicationIds: [applicationId], manifestSha256: plan.manifestSha256, alreadyPresent: false };
    },
    async verifyInstalled(installation, source, resolvedRef, applicationId, target, details, context) {
      const plan = parseDetails(details, resolvedRef, source, applicationId, target);
      const settings = readSettings(context.userId);
      const server = settings.plugins.mcpServers.find(item => item.id === plan.server.id);
      if (!isRecord(installation) || installation.serverId !== plan.server.id || !server
        || !isSameInstalledServer(server, plan.server)) {
        return { status: "unknown", verified: false, summary: "Settings Owner 未回读到同一 MCP 来源、工具摘要和目标 App；先查询能力清单，不要重放安装。" };
      }
      if (!server.enabled || !settings.plugins.enabled) {
        return {
          status: "installed",
          verified: true,
          summary: !settings.plugins.enabled ? "MCP 已写入当前账户设置，但 AI Work 扩展开关关闭，Runtime 不会加载它。" : "MCP 已写入当前账户设置，但该服务处于停用状态。",
          details: { serverId: server.id, manifestSha256: plan.manifestSha256, applicationIds: server.applicationIds, runtimeEnabled: false }
        };
      }
      const live = await discover([server], applicationId, context.userId, context.signal, settings.aiRuntime.requestTimeoutSeconds, { reconcile: false });
      try {
        const state = live.serverStates.find(item => item.serverId === server.id);
        if (state?.status === "incompatible") return { status: "incompatible", verified: true, summary: "MCP 设置已保存，但当前工具合同与固定摘要不一致；Runtime 已拒绝提供这些工具。" };
        if (live.errors.length || !state || state.status !== "ready") return { status: "unknown", verified: false, summary: "MCP 设置已保存，但真实 Runtime 回读未能确认服务可用；先查询能力清单，不要重放安装。" };
        if (state.manifestSha256 !== plan.manifestSha256 || state.toolCount !== plan.toolCount) return { status: "incompatible", verified: true, summary: "MCP 设置已保存，但真实 Runtime 发现的工具合同与检查时不同；未报告为可用。" };
        return {
          status: "ready",
          verified: true,
          summary: "Settings Owner 已保存 MCP，真实 Runtime 已在 " + applicationId + " App 重新发现 " + state.toolCount + " 个摘要匹配的工具。",
          details: { serverId: server.id, manifestSha256: plan.manifestSha256, toolCount: state.toolCount, protocolVersion: state.protocolVersion, applicationIds: server.applicationIds, runtimeEnabled: true }
        };
      } finally {
        await live.close();
      }
    },
    list(applicationId, _target, context) {
      const settings = readSettings(context.userId);
      return settings.plugins.mcpServers
        .filter(server => server.applicationIds.includes(applicationId))
        .map(server => ({
          id: server.id,
          name: server.name,
          source: server.transport === "stdio" ? "本机 stdio" : server.url,
          enabled: server.enabled,
          applicationIds: server.applicationIds,
          ...(server.manifestSha256 ? { manifestSha256: server.manifestSha256 } : {}),
          runtimeGateOpen: settings.plugins.enabled
        }));
    },
    async setEnabled(id, enabled, applicationId, _target, context) {
      const settings = readSettings(context.userId);
      const server = requireSingleAppServer(settings.plugins.mcpServers, id, applicationId);
      const next: McpServerSetting = { ...server, enabled };
      writeSettings(context.userId, "plugins", { ...settings.plugins, mcpServers: settings.plugins.mcpServers.map(item => item.id === id ? next : item) });
      return { id, enabled, applicationIds: [applicationId] };
    },
    async remove(id, applicationId, _target, context) {
      const settings = readSettings(context.userId);
      const server = settings.plugins.mcpServers.find(item => item.id === id);
      if (!server || !server.applicationIds.includes(applicationId)) throw new Error("目标 App 中没有该 MCP 设置；没有移除其他 App 的服务。");
      const mcpServers = server.applicationIds.length > 1
        ? settings.plugins.mcpServers.map(item => item.id === id ? { ...item, applicationIds: item.applicationIds.filter(itemApplicationId => itemApplicationId !== applicationId) } : item)
        : settings.plugins.mcpServers.filter(item => item.id !== id);
      writeSettings(context.userId, "plugins", { ...settings.plugins, mcpServers });
      return { id, removedApplicationId: applicationId, remainingApplicationIds: server.applicationIds.filter(itemApplicationId => itemApplicationId !== applicationId) };
    }
  };
  return adapter;
}

function parseDetails(value: unknown, resolvedRef: string, source: string, applicationId: CapabilityApplicationId, target: Record<string, unknown>): {
  server: McpServerSetting; name: string; manifestSha256: string; toolCount: number;
} {
  if (!isRecord(value) || !isRecord(value.mcp)) throw new Error("MCP 检查详情无效；没有写入设置。");
  const details = value.mcp;
  const name = normalizeName(details.name);
  const manifestSha256 = details.manifestSha256;
  if (name !== target.name || details.applicationId !== applicationId
    || typeof manifestSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(manifestSha256)
    || resolvedRef !== "tools-sha256:" + manifestSha256 || !Number.isInteger(details.toolCount) || Number(details.toolCount) < 1) {
    throw new Error("MCP 固定来源、工具摘要或 App 范围与检查结果不一致；没有写入。");
  }
  const installSource = getMcpInstallSource(source, target);
  const server = makeServer(installSource, applicationId, name, manifestSha256);
  if (details.serverId !== server.id || details.transport !== (server.transport ?? "streamable-http")
    || (installSource.transport === "streamable-http" && details.url !== installSource.url.toString())
    || (installSource.transport === "stdio" && (details.command !== installSource.command || canonical(details.args) !== canonical(installSource.args)))) {
    throw new Error("MCP 固定来源或传输配置与检查结果不一致；没有写入。");
  }
  return { server, name, manifestSha256, toolCount: Number(details.toolCount) };
}

function requireSingleAppServer(servers: McpServerSetting[], id: string, applicationId: CapabilityApplicationId): McpServerSetting {
  const server = servers.find(item => item.id === id);
  if (!server || !server.applicationIds.includes(applicationId)) throw new Error("目标 App 中没有该 MCP 设置。");
  if (server.applicationIds.length !== 1) throw new Error("该 MCP 设置同时服务多个 App；为避免改变其它 App 的开关，请先在设置中心拆分范围。");
  return server;
}

function makeServer(source: McpInstallSource, applicationId: CapabilityApplicationId, name: string, manifestSha256?: string): McpServerSetting {
  const common = { id: serverIdFor(source), name: normalizeName(name), enabled: true, applicationIds: [applicationId], ...(manifestSha256 ? { manifestSha256 } : {}) };
  return source.transport === "stdio"
    ? { ...common, transport: "stdio", command: source.command, args: [...source.args], computerUse: false }
    : { ...common, transport: "streamable-http", url: source.url.toString() };
}

function isSameInstalledServer(existing: McpServerSetting, expected: McpServerSetting): boolean {
  const sameTransport = existing.transport === "stdio" && expected.transport === "stdio"
    ? existing.command === expected.command && canonical(existing.args) === canonical(expected.args)
    : existing.transport !== "stdio" && expected.transport !== "stdio" && canonicalEndpoint(existing.url) === expected.url;
  return sameTransport && existing.name === expected.name && existing.enabled && existing.applicationIds.length === 1
    && existing.applicationIds[0] === expected.applicationIds[0] && existing.manifestSha256 === expected.manifestSha256;
}

function getMcpInstallSource(source: string, target: Record<string, unknown>): McpInstallSource {
  if (source === STDIO_MCP_SOURCE) {
    if (target.transport !== "stdio" || typeof target.command !== "string" || !Array.isArray(target.args)) throw new Error("本机 stdio MCP 来源需要 target.transport=stdio、command 和 argv。");
    return { transport: "stdio", command: target.command, args: [...target.args] as string[] };
  }
  if (target.transport === "stdio" || target.command !== undefined || target.args !== undefined) throw new Error("stdio MCP 只能使用 stdio://local 来源；HTTP 来源不能包含本机命令字段。");
  return { transport: "streamable-http", url: normalizeEndpoint(source) };
}

function normalizeEndpoint(source: string): URL {
  if (typeof source !== "string" || !source.trim() || source.length > 1024) throw new Error("MCP 来源必须是有效的 Streamable HTTP URL 或 stdio://local。");
  let url: URL;
  try { url = new URL(source); } catch { throw new Error("MCP 来源不是有效 URL；本机 stdio 命令须使用 stdio://local 并显式填写 command/argv。"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("MCP 端点只支持无内嵌认证、查询参数或片段的 HTTP/HTTPS URL。");
  }
  return url;
}

function canonicalEndpoint(source: string): string {
  try { return normalizeEndpoint(source).toString(); } catch { return ""; }
}

function serverIdFor(source: McpInstallSource): string {
  const identity = source.transport === "stdio" ? JSON.stringify(["stdio", source.command, source.args]) : source.url.toString();
  return "mcp-" + createHash("sha256").update(identity).digest("hex").slice(0, 20);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function fingerprintSettings(settings: PluginSettings): string {
  return createHash("sha256").update(JSON.stringify(settings)).digest("hex");
}

function normalizeName(value: unknown): string {
  if (value === undefined || value === null || value === "") return "MCP 服务";
  if (typeof value !== "string") throw new Error("MCP 显示名称必须是文本。");
  const name = value.split(String.fromCharCode(0)).join(" ").split(String.fromCharCode(10)).join(" ").split(String.fromCharCode(13)).join(" ").replace(/\s+/gu, " ").trim().slice(0, 80);
  if (!name) throw new Error("MCP 显示名称不能为空。");
  return name;
}

function safeText(value: string, limit: number): string {
  return value.split(String.fromCharCode(0)).join(" ").split(String.fromCharCode(10)).join(" ").split(String.fromCharCode(13)).join(" ").replace(/\s+/gu, " ").trim().slice(0, limit);
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(name + " 必须是 JSON 对象。");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaCapabilityInstalls: CapabilityInstallRegistry }
}

export const name = "lfaaCapabilityMcp";
export const inject = ["lfaaCapabilityInstalls"];
export function apply(ctx: Context): void {
  ctx.lfaaCapabilityInstalls.register(ctx, createMcpCapabilityAdapter());
}
