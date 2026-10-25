/**
 * 功能：从 MCP 官方 Registry 发现固定版本的远端服务与 stdio 包。
 * 作用：只把已识别的 Registry 元数据转成有界 argv；Registry 文本及参数始终视为不可信输入。
 * 关联文件：capability-mcp/src/index.ts、MCP Runtime、统一 Capability Install/Permission Owner。
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { config } from "lfaa-launch-environment/src/config.js";

const REGISTRY_API = "https://registry.modelcontextprotocol.io/v0.1";
const OFFICIAL_META = "io.modelcontextprotocol.registry/official";
const MAX_REGISTRY_BYTES = 2 * 1024 * 1024;
const MAX_CANDIDATES = 20;
const RUNTIMES = { npm: "npx", pypi: "uvx", nuget: "dnx" } as const;
type SupportedPackageType = keyof typeof RUNTIMES;
type RegistrySelection = { name: string; version: string; kind: "remote" | "package"; index: number };
export type RegistryRuntimeSource =
  | { transport: "streamable-http"; url: string }
  | { transport: "stdio"; command: string; args: string[]; env?: Record<string, string> };
export type RegistryFetcher = (url: string, init: RequestInit) => Promise<Response>;
export interface ResolvedRegistryMcp {
  selection: RegistrySelection;
  displayName: string;
  description: string;
  runtime: RegistryRuntimeSource;
  registryFingerprint: string;
  packageType?: string;
  packageIdentifier?: string;
}

export function isMcpRegistrySource(source: string): boolean { return source.startsWith("mcp-registry://official/"); }

export function isMcpRegistryPackageSource(source: string): boolean {
  try { return isMcpRegistrySource(source) && parseSelection(source).kind === "package"; }
  catch { return false; }
}

export async function searchMcpRegistry(query: string, signal: AbortSignal, fetcher: RegistryFetcher = fetch): Promise<Record<string, unknown>> {
  const endpoint = new URL(`${REGISTRY_API}/servers`);
  endpoint.searchParams.set("search", query.trim());
  endpoint.searchParams.set("version", "latest");
  endpoint.searchParams.set("limit", "20");
  const body = await getRegistryJson(endpoint.toString(), signal, fetcher);
  const entries = Array.isArray(body.servers) ? body.servers : [];
  const candidates: Array<Record<string, unknown>> = [];
  const unsupported: Array<Record<string, unknown>> = [];
  for (const entry of entries) {
    if (!isRecord(entry) || !isRecord(entry.server)) continue;
    const server = entry.server;
    if (typeof server.name !== "string" || typeof server.version !== "string" || !isValidRegistryName(server.name) || !isValidVersion(server.version)) continue;
    const status = registryStatus(entry);
    const title = safeText(typeof server.title === "string" ? server.title : server.name, 120);
    const description = safeText(typeof server.description === "string" ? server.description : "", 500);
    const statusWarning = status && status !== "active" ? `Registry 状态为 ${status}，安装前需核实。` : "";
    if (Array.isArray(server.remotes)) {
      server.remotes.forEach((remote, index) => {
        if (!isRecord(remote)) return;
        if (remote.type === "streamable-http" && typeof remote.url === "string" && (!Array.isArray(remote.headers) || remote.headers.length === 0)) {
          candidates.push({
            title, description, source: makeSelectionSource(server.name as string, server.version as string, "remote", index),
            requiresInspection: true, transport: "streamable-http", sourceType: "mcp-registry", registryStatus: status ?? "unknown",
            ...(statusWarning ? { warning: statusWarning } : {})
          });
        } else {
          unsupported.push({ title, version: server.version, kind: "remote", transport: safeText(String(remote.type ?? "unknown"), 40), reason: remote.type === "sse" ? "当前 LFAA MCP Runtime 尚未接入 legacy SSE。" : "远端地址含有尚未接入的认证 Header 或传输类型。" });
        }
      });
    }
    if (Array.isArray(server.packages)) {
      server.packages.forEach((pkg, index) => {
        if (!isRecord(pkg)) return;
        if (pkg.transport?.type !== "stdio" || !isSupportedPackage(pkg)) {
          unsupported.push({ title, version: server.version, kind: "package", packageType: safeText(String(pkg.registryType ?? "unknown"), 40), reason: unsupportedPackageReason(pkg) });
          return;
        }
        candidates.push({
          title, description, source: makeSelectionSource(server.name as string, server.version as string, "package", index),
          requiresInspection: true, transport: "stdio", packageType: pkg.registryType, runtimeHint: pkg.runtimeHint ?? RUNTIMES[pkg.registryType as SupportedPackageType],
          registryStatus: status ?? "unknown", warning: [statusWarning, "检查会按权限模式启动固定版本包；所需非秘密配置会先向你询问，密钥不会通过对话传递。"].filter(Boolean).join(" ")
        });
      });
    }
  }
  const boundedCandidates = candidates.slice(0, MAX_CANDIDATES);
  return {
    sourceType: "mcp-registry", catalog: "official-mcp-registry-v0.1", candidates: boundedCandidates,
    unsupported: unsupported.slice(0, 20),
    note: `按官方 Registry 名称子串查询，返回 ${boundedCandidates.length} 个可检查候选；候选尚未安装或执行。MCP Registry v0.1 仍为预览 API。`
  };
}

export async function resolveMcpRegistrySource(source: string, inputs: Readonly<Record<string, string>>, signal: AbortSignal, fetcher: RegistryFetcher = fetch): Promise<ResolvedRegistryMcp> {
  const selection = parseSelection(source);
  const url = `${REGISTRY_API}/servers/${encodeURIComponent(selection.name)}/versions/${encodeURIComponent(selection.version)}`;
  const body = await getRegistryJson(url, signal, fetcher);
  const server = isRecord(body.server) ? body.server : body;
  if (!isRecord(server) || server.name !== selection.name || server.version !== selection.version) throw new Error("MCP Registry 返回的固定名称或版本与所选候选不一致。");
  const status = registryStatus(body);
  if (status === "deleted") throw new Error("该 MCP Registry 版本已删除，拒绝安装。");
  if (status === "deprecated") throw new Error("该 MCP Registry 版本已弃用；请询问用户是否仍要继续并选择另一个版本。");
  const displayName = safeText(typeof server.title === "string" ? server.title : selection.name.split("/").at(-1) ?? selection.name, 80);
  const description = safeText(typeof server.description === "string" ? server.description : "", 500);
  let runtime: RegistryRuntimeSource;
  let packageType: string | undefined;
  let packageIdentifier: string | undefined;
  if (selection.kind === "remote") {
    if (!Array.isArray(server.remotes) || !isRecord(server.remotes[selection.index])) throw new Error("固定 Registry 版本中已找不到所选远端服务。");
    const remote = server.remotes[selection.index];
    if (remote.type !== "streamable-http" || typeof remote.url !== "string" || Array.isArray(remote.headers) && remote.headers.length > 0) {
      throw new Error("该 MCP Registry 远端使用未接入的认证 Header 或传输类型。");
    }
    runtime = { transport: "streamable-http", url: normalizeRemoteUrl(remote.url) };
  } else {
    if (!Array.isArray(server.packages) || !isRecord(server.packages[selection.index])) throw new Error("固定 Registry 版本中已找不到所选发行包。");
    const pkg = server.packages[selection.index];
    if (!isSupportedPackage(pkg)) throw new Error(unsupportedPackageReason(pkg));
    if (pkg.fileSha256 !== undefined) throw new Error("该发行包声明了 fileSha256，但当前 Runner 无法在包管理器启动前核验下载字节；拒绝忽略摘要后运行。");
    const packageTypeValue = pkg.registryType as SupportedPackageType;
    packageType = packageTypeValue;
    packageIdentifier = pkg.identifier as string;
    const expectedRuntime = RUNTIMES[packageTypeValue];
    if (pkg.runtimeHint !== undefined && pkg.runtimeHint !== expectedRuntime) throw new Error(`当前 Host 只允许 ${packageTypeValue} 使用受支持的 ${expectedRuntime} Runtime。`);
    const usedInputs = new Set<string>();
    const runtimeArguments = resolveRegistryArguments(pkg.runtimeArguments, inputs, usedInputs, "Runtime 参数");
    const packageArguments = resolveRegistryArguments(pkg.packageArguments, inputs, usedInputs, "包参数");
    const env = resolveRegistryEnvironment(pkg.environmentVariables, inputs, usedInputs);
    const managedCache = ensureManagedPackageCache(packageTypeValue);
    const managedCacheVariable = packageTypeValue === "npm" ? "npm_config_cache" : packageTypeValue === "pypi" ? "UV_CACHE_DIR" : "NUGET_PACKAGES";
    env[managedCacheVariable] = managedCache;
    const unusedInputs = Object.keys(inputs).filter(key => !usedInputs.has(key));
    if (unusedInputs.length) throw new Error(`以下补充信息未被所选 MCP 使用：${unusedInputs.join("、")}。请按 Registry 提示重新检查。`);
    const versionedPackage = packageTypeValue === "pypi" ? `${packageIdentifier}==${String(pkg.version ?? selection.version)}` : `${packageIdentifier}@${String(pkg.version ?? selection.version)}`;
    if (packageTypeValue === "npm") {
      const npxCli = resolveNpxCli();
      runtime = { transport: "stdio", command: process.execPath, args: [npxCli, ...runtimeArguments, versionedPackage, ...(packageArguments.length ? ["--", ...packageArguments] : [])], ...(Object.keys(env).length ? { env } : {}) };
    } else if (packageTypeValue === "pypi") {
      runtime = { transport: "stdio", command: "uvx", args: [...runtimeArguments, versionedPackage, ...packageArguments], ...(Object.keys(env).length ? { env } : {}) };
    } else {
      runtime = { transport: "stdio", command: "dnx", args: [...runtimeArguments, versionedPackage, ...(packageArguments.length ? ["--", ...packageArguments] : [])], ...(Object.keys(env).length ? { env } : {}) };
    }
  }
  const fingerprint = createHash("sha256").update(JSON.stringify({ selection, runtime, packageType, packageIdentifier })).digest("hex");
  return { selection, displayName, description, runtime, registryFingerprint: fingerprint, ...(packageType ? { packageType } : {}), ...(packageIdentifier ? { packageIdentifier } : {}) };
}

export function selectionFromSource(source: string): RegistrySelection { return parseSelection(source); }

function resolveNpxCli(): string {
  const executableDirectory = dirname(process.execPath);
  const candidates = [
    resolve(executableDirectory, "node_modules/npm/bin/npx-cli.js"),
    resolve(executableDirectory, "../lib/node_modules/npm/bin/npx-cli.js"),
    resolve(executableDirectory, "../../lib/node_modules/npm/bin/npx-cli.js")
  ];
  const found = candidates.find(candidate => existsSync(candidate));
  if (!found) throw new Error("未在当前 Node.js 安装目录找到 npx-cli.js；无法安全地通过 shell 启动 npm 包。");
  return found;
}

function ensureManagedPackageCache(type: SupportedPackageType): string {
  const dataRoot = realpathSync(config.dataDirectory);
  const requested = resolve(dataRoot, "cache", "mcp", type);
  mkdirSync(requested, { recursive: true, mode: 0o700 });
  const actual = realpathSync(requested);
  const rel = relative(dataRoot, actual);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("MCP 包缓存位置解析到 LFAA_DATA_DIR 之外；拒绝安装。");
  return actual;
}

function parseSelection(source: string): RegistrySelection {
  const match = /^mcp-registry:\/\/official\/([^?]+)\?(.+)$/u.exec(source);
  if (!match) throw new Error("MCP Registry 来源格式无效。");
  let name: string, params: URLSearchParams;
  try { name = decodeURIComponent(match[1]); params = new URLSearchParams(match[2]); }
  catch { throw new Error("MCP Registry 来源编码无效。"); }
  if ([...params.keys()].some(key => !["version", "kind", "index"].includes(key)) || params.getAll("version").length !== 1 || params.getAll("kind").length !== 1 || params.getAll("index").length !== 1) throw new Error("MCP Registry 来源包含未知或重复选择字段。");
  const version = params.get("version") ?? "";
  const kind = params.get("kind");
  const index = Number(params.get("index"));
  if (!isValidRegistryName(name) || !isValidVersion(version) || (kind !== "remote" && kind !== "package") || !Number.isInteger(index) || index < 0 || index > 31) throw new Error("MCP Registry 来源名称、版本、类型或索引无效。");
  return { name, version, kind, index };
}

function makeSelectionSource(name: string, version: string, kind: "remote" | "package", index: number): string {
  return `mcp-registry://official/${encodeURIComponent(name)}?version=${encodeURIComponent(version)}&kind=${kind}&index=${index}`;
}

async function getRegistryJson(url: string, signal: AbortSignal, fetcher: RegistryFetcher): Promise<Record<string, unknown>> {
  let response: Response;
  try { response = await fetcher(url, { method: "GET", headers: { Accept: "application/json" }, signal }); }
  catch (error) { if (signal.aborted) signal.throwIfAborted(); throw new Error(`MCP Registry 请求失败：${safeText(error instanceof Error ? error.message : String(error), 240)}`); }
  if (!response.ok) throw new Error(`MCP Registry 返回 HTTP ${response.status}。`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_REGISTRY_BYTES) throw new Error("MCP Registry 响应超过 2 MiB 限制。");
  const text = await readBoundedResponse(response, MAX_REGISTRY_BYTES, signal);
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("MCP Registry 返回的不是有效 JSON。"); }
  if (!isRecord(value)) throw new Error("MCP Registry 返回了无效对象。");
  return value;
}

function isSupportedPackage(pkg: Record<string, unknown>): boolean {
  const type = pkg.registryType;
  const expected = typeof type === "string" ? RUNTIMES[type as SupportedPackageType] : undefined;
  const transport = isRecord(pkg.transport) ? pkg.transport : undefined;
  if (!expected || transport?.type !== "stdio" || typeof pkg.identifier !== "string" || !pkg.identifier.trim() || !isValidVersion(String(pkg.version ?? ""))) return false;
  if (pkg.runtimeHint !== undefined && pkg.runtimeHint !== expected) return false;
  const baseUrls: Record<SupportedPackageType, string> = { npm: "https://registry.npmjs.org", pypi: "https://pypi.org", nuget: "https://api.nuget.org/v3/index.json" };
  if (pkg.registryBaseUrl !== undefined && pkg.registryBaseUrl !== baseUrls[type as SupportedPackageType]) return false;
  if (type === "npm") return /^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/u.test(pkg.identifier);
  if (type === "pypi") return /^[A-Za-z0-9._-]+$/u.test(pkg.identifier);
  if (type === "nuget") return /^[A-Za-z0-9._-]+$/u.test(pkg.identifier);
  return false;
}

function unsupportedPackageReason(pkg: Record<string, unknown>): string {
  if (pkg.registryType === "cargo") return "Cargo 需先编译并安装独立二进制；当前自动安装器未实现该生命周期。";
  if (pkg.registryType === "oci") return "OCI 包需要受限容器安装与挂载配置；当前 Host 未接入容器隔离策略。";
  if (pkg.registryType === "mcpb") return "MCPB 需要校验发行包摘要并安全解包；当前 Host 未接入 MCPB 文件 Owner。";
  if (isRecord(pkg.transport) && pkg.transport.type === "sse") return "当前 MCP Runtime 尚未接入 legacy SSE。";
  return "Registry 发行格式、包地址或 Runtime Hint 不在当前 Host 的安全支持范围内。";
}

function resolveRegistryArguments(value: unknown, inputs: Readonly<Record<string, string>>, used: Set<string>, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 32) throw new Error(`MCP ${label}数量无效。`);
  const result: string[] = [];
  for (const item of value) {
    if (!isRecord(item) || (item.type !== "named" && item.type !== "positional")) throw new Error(`MCP ${label}格式无效。`);
    const variables = isRecord(item.variables) ? item.variables : {};
    const raw = typeof item.value === "string" ? item.value : typeof item.default === "string" ? item.default : undefined;
    const key = safeText(String(item.valueHint ?? item.name ?? ""), 80);
    let resolved: string | undefined = raw;
    if (resolved === undefined && item.isRequired === true) resolved = inputValue(key, inputs, used, item.choices);
    if (resolved !== undefined) {
      resolved = resolved.replace(/\{([A-Za-z0-9_-]+)\}/gu, (_match, variableName: string) => {
        const spec = variables[variableName];
        if (isRecord(spec) && spec.isSecret === true) throw new Error(`MCP 要求秘密参数 ${variableName}；密钥必须使用设置中心加密凭据，不能通过 Agent 对话传递。`);
        if (isRecord(spec) && typeof spec.default === "string") return spec.default;
        return inputValue(variableName, inputs, used, isRecord(spec) ? spec.choices : undefined);
      });
    }
    if (resolved === undefined) continue;
    if (resolved.includes("\0") || resolved.length > 1024) throw new Error(`MCP ${label}超过长度限制或包含无效字符。`);
    if (item.type === "named") {
      if (typeof item.name !== "string" || !/^[-/A-Za-z0-9_][^\0\r\n]{0,80}$/u.test(item.name)) throw new Error(`MCP ${label}名称无效。`);
      result.push(item.name);
    }
    result.push(resolved);
  }
  return result;
}

function resolveRegistryEnvironment(value: unknown, inputs: Readonly<Record<string, string>>, used: Set<string>): Record<string, string> {
  if (value === undefined) return {};
  if (!Array.isArray(value) || value.length > 64) throw new Error("MCP 环境变量声明数量无效。");
  const env: Record<string, string> = {};
  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/u.test(item.name)) throw new Error("MCP 环境变量声明无效。");
    if (["NPM_CONFIG_CACHE", "UV_CACHE_DIR", "NUGET_PACKAGES"].includes(item.name.toLocaleUpperCase("en-US"))) throw new Error(`MCP 不能覆盖 LFAA 管理的包缓存位置：${item.name}。`);
    if (item.isSecret === true) {
      if (item.isRequired === true) throw new Error(`MCP 需要秘密环境变量 ${item.name}；请先通过设置中心的加密凭据入口配置，不能把密钥发在 Agent 对话中。`);
      continue;
    }
    const defaultValue = typeof item.default === "string" ? item.default : typeof item.value === "string" ? item.value : undefined;
    const valueForEnv = defaultValue ?? (item.isRequired === true ? inputValue(item.name, inputs, used, item.choices) : undefined);
    if (valueForEnv !== undefined) {
      if (valueForEnv.length > 4096 || valueForEnv.includes("\0")) throw new Error(`MCP 环境变量 ${item.name} 无效。`);
      env[item.name] = valueForEnv;
    }
  }
  return env;
}

function inputValue(key: string, inputs: Readonly<Record<string, string>>, used: Set<string>, choices: unknown): string {
  if (/(?:password|secret|token|api[-_ ]?key|credential|authorization)/iu.test(key)) throw new Error(`MCP 参数 ${key} 看起来是秘密；不能通过 Agent 对话传递，必须先接入设置中心加密凭据。`);
  if (!key || !Object.hasOwn(inputs, key)) throw new Error(`安装 MCP 前需要补充“${key || "参数"}”信息；先向用户询问具体值，再通过 target.inputs 重新检查。`);
  const value = inputs[key];
  if (typeof value !== "string" || !value.trim() || value.length > 1024 || value.includes("\0")) throw new Error(`MCP 参数 ${key} 必须是 1–1024 个字符的普通文本。`);
  if (Array.isArray(choices) && choices.length && !choices.includes(value)) throw new Error(`MCP 参数 ${key} 必须从 Registry 提供的候选值中选择。`);
  used.add(key);
  return value;
}

function normalizeRemoteUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("MCP Registry 远端 URL 无效。"); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("MCP Registry 远端 URL 含不允许的认证资料、查询或片段。");
  return url.toString();
}

function registryStatus(entry: Record<string, unknown>): string | undefined {
  const metadata = isRecord(entry._meta) ? entry._meta : {};
  const official = isRecord(metadata[OFFICIAL_META]) ? metadata[OFFICIAL_META] : {};
  return typeof official.status === "string" ? official.status : undefined;
}

function isValidRegistryName(value: string): boolean { return value.length <= 255 && /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(value); }
function isValidVersion(value: string): boolean { return value.length > 0 && value.length <= 255 && value !== "latest" && /^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value); }
function safeText(value: string, limit: number): string { return value.replace(/[\r\n\0]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, limit); }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }

async function readBoundedResponse(response: Response, maximumBytes: number, signal: AbortSignal): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("MCP Registry body exceeds limit");
        throw new Error(`MCP Registry 响应超过 ${maximumBytes / (1024 * 1024)} MiB 限制。`);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), total).toString("utf8");
}
