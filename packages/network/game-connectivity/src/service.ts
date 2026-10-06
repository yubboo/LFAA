/**
 * 功能：拥有跨游戏的公网连接路由、房间与 Provider 能力登记。
 * 作用：把网络映射和游戏部署生命周期隔离，按账户保存真实路由状态。
 * 关联文件：api/connectivity-controller、host/daemon、connectivity-relay。
 */
import { existsSync, lstatSync, mkdirSync, readFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { dirname, resolve } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import { config } from "lfaa-launch-environment/src/config.js";
import { resolveDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { atomicWrite } from "lfaa-storage-json/src/index.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import { credentialReference, type CredentialRecord } from "lfaa-credentials/src/index.js";
import { EASYTIER_RUNTIME_RELEASE } from "./easytier-release.mjs";

export type GameTransport = "tcp" | "udp";
export type ConnectivityMode = "provider" | "self-managed" | "room-domain";
export type ConnectivityState = "manual" | "waiting-for-node" | "connected" | "offline" | "failed";

export interface ConnectivityTarget {
  id: string;
  applicationId: ApplicationId;
  name: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  transport: GameTransport;
  localHost: "127.0.0.1";
  localPort: number;
  state: "running";
}

export interface ConnectivityTargetAdapter {
  list(ownerId: string): readonly ConnectivityTarget[];
  get(ownerId: string, targetId: string): ConnectivityTarget | null;
}

export interface ConnectivityRoute {
  id: string;
  ownerId: string;
  sourceAppId: ApplicationId | "custom";
  targetId: string | null;
  name: string;
  mode: ConnectivityMode;
  transport: GameTransport;
  target: { nodeId: string; localHost: "127.0.0.1"; localPort: number };
  roomName: string | null;
  publicPort: number | null;
  playerAddress: string | null;
  state: ConnectivityState;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt: string | null;
}

interface RouteDocument { version: 1; revision: number; routes: ConnectivityRoute[] }
export type EasyTierInstallTaskStatus = "queued" | "running" | "succeeded" | "failed" | "unknown";
export interface EasyTierInstallTask {
  id: string;
  ownerId: string;
  nodeId: string;
  version: string;
  status: EasyTierInstallTaskStatus;
  message: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  deadlineAt: string | null;
}
interface EasyTierTaskDocument { version: 1; revision: number; tasks: EasyTierInstallTask[] }
export interface ConnectivityProviderAdapter { id: string; name: string; officialUrl: string; status: "ready"; transports: GameTransport[]; connect: (input: unknown) => Promise<unknown> }
interface ConnectivityDeployment { configured: boolean; publicDomain: string | null; relayUrl: string | null; reason: string | null; tcpPortStart: number; tcpPortEnd: number; udpPortStart: number; udpPortEnd: number; minecraftPort: number; perAccountLimit: number; totalLimit: number }

const emptyDocument = (): RouteDocument => ({ version: 1, revision: 0, routes: [] });
const roomPattern = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/u;
const hostPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/iu;
const recordLimitBytes = 4 * 1024 * 1024;
const easyTierTaskLimitBytes = 2 * 1024 * 1024;
const easyTierTaskLimit = 1000;
const easyTierTaskRetentionMs = 7 * 24 * 60 * 60 * 1000;
const easyTierTaskTimeoutMs = 17 * 60 * 1000;
const stateValues = new Set<ConnectivityState>(["manual", "waiting-for-node", "connected", "offline", "failed"]);
const easyTierTaskStatuses = new Set<EasyTierInstallTaskStatus>(["queued", "running", "succeeded", "failed", "unknown"]);

export class ConnectivityServiceError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "ConnectivityServiceError"; }
}

function deploymentConfig(): ConnectivityDeployment {
  const env = process.env;
  const publicDomain = env.LFAA_CONNECTIVITY_PUBLIC_DOMAIN?.trim().toLowerCase() || null;
  const relayUrl = env.LFAA_CONNECTIVITY_RELAY_URL?.trim() || null;
  const relaySecret = env.LFAA_CONNECTIVITY_RELAY_SECRET?.trim() || "";
  const tcpPortStart = Number(env.LFAA_CONNECTIVITY_TCP_PORT_START);
  const tcpPortEnd = Number(env.LFAA_CONNECTIVITY_TCP_PORT_END);
  const udpPortStart = Number(env.LFAA_CONNECTIVITY_UDP_PORT_START);
  const udpPortEnd = Number(env.LFAA_CONNECTIVITY_UDP_PORT_END);
  const minecraftPort = Number(env.LFAA_CONNECTIVITY_MINECRAFT_PORT || 25565);
  const perAccountLimit = Number(env.LFAA_CONNECTIVITY_MAX_ROUTES_PER_USER || 20);
  const totalLimit = Number(env.LFAA_CONNECTIVITY_MAX_ROUTES_TOTAL || 1000);
  let reason: string | null = null;
  if (!publicDomain || !hostPattern.test(publicDomain)) reason = "运营方尚未配置有效的 LFAA 房间域名。";
  else if (!relayUrl || !validRelayUrl(relayUrl)) reason = "运营方尚未配置安全的 LFAA Relay 地址。";
  else if (relaySecret.length < 32) reason = "运营方尚未配置 32 位以上 Relay 共享密钥。";
  else if (!validPortRange(tcpPortStart, tcpPortEnd) || !validPortRange(udpPortStart, udpPortEnd)) reason = "运营方尚未配置有效的 TCP 与 UDP 公网端口范围。";
  else if (!validPort(minecraftPort) || !Number.isInteger(perAccountLimit) || perAccountLimit < 1 || perAccountLimit > 100 || !Number.isInteger(totalLimit) || totalLimit < perAccountLimit || totalLimit > 100_000) reason = "运营方的端口或连接配额配置无效。";
  else reason = "LFAA Relay 控制通道、数据面和健康握手尚未接入。";
  return { configured: false, publicDomain: null, relayUrl: null, reason, tcpPortStart, tcpPortEnd, udpPortStart, udpPortEnd, minecraftPort, perAccountLimit, totalLimit };
}

function validRelayUrl(value: string): boolean {
  try { const url = new URL(value); return ["wss:", "ws:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password && !url.search && !url.hash && (url.protocol === "wss:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)); }
  catch { return false; }
}

function validPort(port: number): boolean { return Number.isInteger(port) && port >= 1 && port <= 65535; }
function validPortRange(start: number, end: number): boolean { return validPort(start) && validPort(end) && end >= start && end - start < 20_000; }

function normalizeAddress(value: string): string | null {
  const address = value.trim().toLowerCase();
  if (address.length > 280 || /[\s/\\?#@]/u.test(address) || address.includes("://")) return null;
  let host = address;
  let port: string | null = null;
  if (address.startsWith("[")) {
    const match = /^\[([0-9a-f:]+)\](?::(\d{1,5}))?$/iu.exec(address);
    if (!match || isIP(match[1]!) !== 6) return null;
    host = `[${match[1]}]`;
    port = match[2] ?? null;
  } else {
    const parts = address.split(":");
    if (parts.length > 2) return null;
    host = parts[0]!;
    port = parts[1] ?? null;
    if (isIP(host) === 0 && !hostPattern.test(host)) return null;
  }
  if (port !== null && !validPort(Number(port))) return null;
  return `${host}${port === null ? "" : `:${Number(port)}`}`;
}

function roomSlug(value: string): string {
  const slug = value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9-]+/gu, "-").replace(/-+/gu, "-").replace(/^-|-$/gu, "");
  if (!roomPattern.test(slug)) throw new ConnectivityServiceError("invalid_room_name", "房间名请使用 1–48 位英文字母、数字或连字符，且首尾必须是字母或数字。");
  return slug;
}

function isRoute(value: unknown): value is ConnectivityRoute {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const route = value as Partial<ConnectivityRoute>;
  return typeof route.id === "string" && typeof route.ownerId === "string" && typeof route.name === "string"
    && (route.sourceAppId === "custom" || typeof route.sourceAppId === "string")
    && (route.targetId === null || typeof route.targetId === "string")
    && ["provider", "self-managed", "room-domain"].includes(String(route.mode))
    && ["tcp", "udp"].includes(String(route.transport)) && route.target !== null && typeof route.target === "object"
    && typeof route.target.nodeId === "string" && route.target.localHost === "127.0.0.1" && validPort(Number(route.target.localPort))
    && (route.roomName === null || typeof route.roomName === "string") && (route.publicPort === null || validPort(Number(route.publicPort)))
    && (route.playerAddress === null || typeof route.playerAddress === "string") && stateValues.has(route.state as ConnectivityState)
    && (route.errorCode === null || typeof route.errorCode === "string") && typeof route.createdAt === "string" && typeof route.updatedAt === "string"
    && (route.lastConnectedAt === null || typeof route.lastConnectedAt === "string");
}

function isEasyTierInstallTask(value: unknown): value is EasyTierInstallTask {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const task = value as Partial<EasyTierInstallTask>;
  return typeof task.id === "string" && /^[0-9a-f-]{36}$/iu.test(task.id)
    && typeof task.ownerId === "string" && typeof task.nodeId === "string" && /^[0-9a-f-]{36}$/iu.test(task.nodeId)
    && task.version === EASYTIER_RUNTIME_RELEASE.version && easyTierTaskStatuses.has(task.status as EasyTierInstallTaskStatus)
    && typeof task.message === "string" && task.message.length <= 200
    && typeof task.createdAt === "string" && Number.isFinite(Date.parse(task.createdAt))
    && (task.startedAt === null || typeof task.startedAt === "string" && Number.isFinite(Date.parse(task.startedAt)))
    && (task.finishedAt === null || typeof task.finishedAt === "string" && Number.isFinite(Date.parse(task.finishedAt)))
    && (task.deadlineAt === null || typeof task.deadlineAt === "string" && Number.isFinite(Date.parse(task.deadlineAt)))
    && (task.status === "queued" ? task.startedAt === null && task.finishedAt === null && task.deadlineAt === null
      : task.status === "running" ? task.startedAt !== null && task.finishedAt === null && task.deadlineAt !== null
        : task.finishedAt !== null && task.deadlineAt === null);
}

export class GameConnectivityService {
  private readonly targetAdapters = new Map<ApplicationId, ConnectivityTargetAdapter>();
  private readonly providerAdapters = new Map<string, ConnectivityProviderAdapter>();
  private readonly filePath = resolve(resolveDataPaths(config.dataDirectory).connectivity, "routes.json");
  private readonly easyTierTasksPath = resolve(dirname(this.filePath), "easytier-install-tasks.json");

  constructor(private readonly pluginContext: Context) {
    this.pluginContext.lfaaCredentials.registerRecordOwner(pluginContext, ["lfaa-game-connectivity"]);
  }

  registerTargetAdapter(owner: Context, applicationId: ApplicationId, adapter: ConnectivityTargetAdapter): () => void {
    if (this.targetAdapters.has(applicationId)) throw new ConnectivityServiceError("duplicate_target_adapter", `App ${applicationId} 已登记联机目标适配器。`);
    this.targetAdapters.set(applicationId, adapter);
    return owner.effect(() => () => { if (this.targetAdapters.get(applicationId) === adapter) this.targetAdapters.delete(applicationId); });
  }

  registerProviderAdapter(owner: Context, adapter: ConnectivityProviderAdapter): () => void {
    if (!/^[a-z][a-z0-9-]{0,63}$/u.test(adapter.id) || this.providerAdapters.has(adapter.id)) throw new ConnectivityServiceError("invalid_provider_adapter", "Provider 适配器标识无效或重复。");
    this.providerAdapters.set(adapter.id, adapter);
    return owner.effect(() => () => { if (this.providerAdapters.get(adapter.id) === adapter) this.providerAdapters.delete(adapter.id); });
  }

  listTargets(ownerId: string, applicationId?: ApplicationId): ConnectivityTarget[] {
    return [...this.targetAdapters.entries()]
      .filter(([appId]) => applicationId === undefined || appId === applicationId)
      .flatMap(([, adapter]) => adapter.list(ownerId).filter(target => target.nodeStatus === "online" && target.state === "running"))
      .slice(0, 500);
  }

  resolveTarget(ownerId: string, applicationId: ApplicationId, targetId: string): ConnectivityTarget | null {
    const target = this.targetAdapters.get(applicationId)?.get(ownerId, targetId) ?? null;
    if (!target || target.nodeStatus !== "online" || target.state !== "running") return null;
    if (target.localHost !== "127.0.0.1" || !validPort(target.localPort) || !["tcp", "udp"].includes(target.transport)) return null;
    return target;
  }

  listProviders(ownerId: string) {
    const consumer = this.pluginContext.lfaaCredentials.createConsumer(this.pluginContext);
    return [...this.providerAdapters.values()].map(({ connect: _connect, ...provider }) => ({
      ...provider,
      configured: consumer.describeRecord(ownerId, this.providerCredentialReference(provider.id))?.kind === "api-key"
    }));
  }

  getDeploymentStatus() {
    const { reason } = deploymentConfig();
    return { roomDomain: { configured: false, publicDomain: null, relayUrl: null, reason, tcpPortStart: null, tcpPortEnd: null, udpPortStart: null, udpPortEnd: null, minecraftPort: null } };
  }

  listProviderAdapters(ownerId: string) { return this.listProviders(ownerId); }

  async invokeProvider(ownerId: string, providerId: string, input: unknown): Promise<unknown> {
    const adapter = this.providerAdapters.get(providerId);
    if (!adapter) throw new ConnectivityServiceError("provider_unavailable", "当前没有完成官方 API 核验的第三方 Provider 适配器。");
    const consumer = this.pluginContext.lfaaCredentials.createConsumer(this.pluginContext);
    const record = consumer.readRecord(ownerId, this.providerCredentialReference(providerId));
    const token = record?.kind === "api-key" ? record.key : null;
    if (!token) throw new ConnectivityServiceError("provider_credential_required", "请先在对应官方服务获取并保存访问令牌。");
    return adapter.connect({ ownerId, input, token });
  }

  listRoutes(ownerId: string): ConnectivityRoute[] {
    return this.readDocument().routes.filter(route => route.ownerId === ownerId).map(route => structuredClone(route));
  }

  createEasyTierInstallTask(ownerId: string, nodeId: string): EasyTierInstallTask {
    const document = this.readEasyTierTaskDocument();
    const now = Date.now();
    const expired = this.expireEasyTierTasks(document, now);
    if (document.tasks.some(task => task.nodeId === nodeId && (task.status === "queued" || task.status === "running"))) {
      if (expired) this.writeEasyTierTaskDocument(document);
      throw new ConnectivityServiceError("easytier_install_pending", "此节点已有 EasyTier 安装任务正在处理，请刷新任务状态。");
    }
    if (document.tasks.length >= easyTierTaskLimit) {
      if (expired) this.writeEasyTierTaskDocument(document);
      throw new ConnectivityServiceError("easytier_task_capacity_reached", "EasyTier 安装任务记录已达到容量上限，请稍后重试。");
    }
    const task: EasyTierInstallTask = {
      id: randomUUID(), ownerId, nodeId, version: EASYTIER_RUNTIME_RELEASE.version, status: "queued",
      message: "等待目标 Daemon 节点接收安装任务。", createdAt: new Date(now).toISOString(),
      startedAt: null, finishedAt: null, deadlineAt: null
    };
    document.tasks.push(task);
    this.writeEasyTierTaskDocument(document);
    return structuredClone(task);
  }

  listEasyTierInstallTasks(ownerId: string): EasyTierInstallTask[] {
    const document = this.readEasyTierTaskDocument();
    if (this.expireEasyTierTasks(document, Date.now())) this.writeEasyTierTaskDocument(document);
    return document.tasks.filter(task => task.ownerId === ownerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10).map(task => structuredClone(task));
  }

  getEasyTierInstallTask(ownerId: string, taskId: string): EasyTierInstallTask | null {
    const document = this.readEasyTierTaskDocument();
    if (this.expireEasyTierTasks(document, Date.now())) this.writeEasyTierTaskDocument(document);
    const task = document.tasks.find(item => item.id === taskId && item.ownerId === ownerId);
    return task ? structuredClone(task) : null;
  }

  claimEasyTierInstallTask(nodeId: string): Pick<EasyTierInstallTask, "id" | "version"> | null {
    const document = this.readEasyTierTaskDocument();
    const now = Date.now();
    const expired = this.expireEasyTierTasks(document, now);
    const task = document.tasks.find(item => item.nodeId === nodeId && item.status === "queued");
    if (!task) {
      if (expired) this.writeEasyTierTaskDocument(document);
      return null;
    }
    task.status = "running";
    task.message = "Daemon 正在下载并核验 EasyTier 官方运行包。";
    task.startedAt = new Date(now).toISOString();
    task.deadlineAt = new Date(now + easyTierTaskTimeoutMs).toISOString();
    this.writeEasyTierTaskDocument(document);
    return { id: task.id, version: task.version };
  }

  completeEasyTierInstallTask(nodeId: string, taskId: string, succeeded: boolean, version?: string): boolean {
    const document = this.readEasyTierTaskDocument();
    const now = Date.now();
    const expired = this.expireEasyTierTasks(document, now);
    const task = document.tasks.find(item => item.id === taskId && item.nodeId === nodeId && item.status === "running");
    if (!task) {
      if (expired) this.writeEasyTierTaskDocument(document);
      return false;
    }
    task.status = succeeded && version === task.version ? "succeeded" : "failed";
    task.message = task.status === "succeeded" ? "EasyTier 官方运行包已安装并通过版本核验。" : "EasyTier 安装或版本核验失败；请检查节点状态后再决定是否重试。";
    task.finishedAt = new Date(now).toISOString();
    task.deadlineAt = null;
    this.writeEasyTierTaskDocument(document);
    return true;
  }

  getDaemonRoutes(nodeId: string) {
    const deployment = deploymentConfig();
    if (!deployment.configured || !deployment.relayUrl) return [];
    return this.readDocument().routes.filter(route => route.mode === "room-domain" && route.target.nodeId === nodeId && route.state !== "failed")
      .map(route => ({ id: route.id, roomName: route.roomName, transport: route.transport, localHost: route.target.localHost, localPort: route.target.localPort, publicPort: route.publicPort, relayUrl: deployment.relayUrl!, relayToken: createHmac("sha256", process.env.LFAA_CONNECTIVITY_RELAY_SECRET!.trim()).update(route.id).digest("hex") }));
  }

  createRoute(ownerId: string, input: { sourceAppId: ApplicationId | "custom"; targetId?: string | null; name: string; mode: ConnectivityMode; transport: GameTransport; nodeId?: string; localPort?: number; playerAddress?: string }): ConnectivityRoute {
    const document = this.readDocument();
    const deployment = deploymentConfig();
    if (document.routes.filter(route => route.ownerId === ownerId).length >= deployment.perAccountLimit) throw new ConnectivityServiceError("route_quota_exceeded", "当前账户的联机路线数量已达上限。");
    if (document.routes.length >= deployment.totalLimit) throw new ConnectivityServiceError("service_capacity_reached", "LFAA 联机服务当前已达到运营容量上限。");
    if (!/^[\p{L}\p{N} ._-]{1,64}$/u.test(input.name.trim())) throw new ConnectivityServiceError("invalid_route_name", "路线名称长度或格式无效。");
    if (!["provider", "self-managed", "room-domain"].includes(input.mode) || !["tcp", "udp"].includes(input.transport)) throw new ConnectivityServiceError("invalid_route", "路线类型或网络协议无效。");

    let target: ConnectivityTarget | null = null;
    if (input.sourceAppId !== "custom" && input.targetId) target = this.resolveTarget(ownerId, input.sourceAppId, input.targetId);
    if (!target && input.sourceAppId !== "custom") throw new ConnectivityServiceError("target_unavailable", "所选 App 服务未处于运行状态、节点离线或此账户无权使用。");
    if (target && input.transport !== target.transport) throw new ConnectivityServiceError("target_protocol_mismatch", "路线协议与游戏服务端实际协议不匹配。");
    const nodeId = target?.nodeId ?? input.nodeId;
    const localPort = target?.localPort ?? input.localPort;
    if (!nodeId || !/^[0-9a-f-]{36}$/iu.test(nodeId) || !validPort(Number(localPort))) throw new ConnectivityServiceError("invalid_target", "目标节点或本地端口无效。");
    if (input.mode === "provider") throw new ConnectivityServiceError("provider_unavailable", "当前没有完成官方 API 核验的第三方 Provider 适配器。");

    const id = randomUUID();
    const now = new Date().toISOString();
    let roomName: string | null = null;
    let publicPort: number | null = null;
    let playerAddress: string | null = null;
    let state: ConnectivityState = "manual";

    if (input.mode === "self-managed") {
      const normalized = typeof input.playerAddress === "string" ? normalizeAddress(input.playerAddress) : null;
      if (!normalized) throw new ConnectivityServiceError("invalid_player_address", "请填写穿透服务实际提供的域名或 IP 地址，可附端口。");
      playerAddress = normalized;
    } else {
      if (!deployment.configured || !deployment.publicDomain) throw new ConnectivityServiceError("relay_not_configured", deployment.reason ?? "LFAA 房间域名 Relay 尚未配置。");
      roomName = roomSlug(input.name);
      if (document.routes.some(route => route.mode === "room-domain" && route.roomName === roomName && route.state !== "failed")) throw new ConnectivityServiceError("room_name_in_use", "这个房间名已经被使用，请换一个名称。");
      if (input.transport === "udp") publicPort = this.findAvailablePort(document.routes, "udp", deployment.udpPortStart, deployment.udpPortEnd);
      else if (input.sourceAppId !== "minecraft") publicPort = this.findAvailablePort(document.routes, "tcp", deployment.tcpPortStart, deployment.tcpPortEnd);
      else publicPort = deployment.minecraftPort;
      playerAddress = input.transport === "udp" || input.sourceAppId !== "minecraft"
        ? `${roomName}.${deployment.publicDomain}:${publicPort}`
        : `${roomName}.${deployment.publicDomain}${publicPort === 25565 ? "" : `:${publicPort}`}`;
      state = "waiting-for-node";
    }

    const route: ConnectivityRoute = { id, ownerId, sourceAppId: input.sourceAppId, targetId: target?.id ?? null, name: input.name.trim(), mode: input.mode, transport: input.transport, target: { nodeId, localHost: "127.0.0.1", localPort: Number(localPort) }, roomName, publicPort, playerAddress, state, errorCode: null, createdAt: now, updatedAt: now, lastConnectedAt: null };
    document.routes.push(route);
    this.writeDocument(document);
    return structuredClone(route);
  }

  deleteRoute(ownerId: string, routeId: string): boolean {
    const document = this.readDocument();
    const index = document.routes.findIndex(route => route.id === routeId && route.ownerId === ownerId);
    if (index < 0) return false;
    document.routes.splice(index, 1);
    this.writeDocument(document);
    return true;
  }

  reportDaemonState(nodeId: string, routeId: string, state: Exclude<ConnectivityState, "manual">, errorCode: string | null): ConnectivityRoute | null {
    if (!stateValues.has(state)) throw new ConnectivityServiceError("invalid_route_state", "节点报告的联网状态无效。");
    const document = this.readDocument();
    const route = document.routes.find(item => item.id === routeId && item.mode === "room-domain" && item.target.nodeId === nodeId);
    if (!route) return null;
    const now = new Date().toISOString();
    route.state = state;
    route.errorCode = state === "failed" ? (errorCode ?? "relay_connection_failed").slice(0, 80) : null;
    route.updatedAt = now;
    if (state === "connected") route.lastConnectedAt = now;
    this.writeDocument(document);
    return structuredClone(route);
  }

  providerCredentialReference(providerId: string) { return credentialReference("lfaa-game-connectivity", providerId); }

  saveProviderCredential(ownerId: string, providerId: string, token: string): void {
    if (!this.providerAdapters.has(providerId)) throw new ConnectivityServiceError("provider_unavailable", "此 Provider 尚未完成官方接口适配，无法保存令牌。");
    const normalized = token.trim();
    if (normalized.length < 8 || normalized.length > 4096 || /[\r\n\0]/u.test(normalized)) throw new ConnectivityServiceError("invalid_provider_token", "Provider 令牌格式无效。");
    const record: CredentialRecord = { kind: "api-key", key: normalized };
    this.pluginContext.lfaaCredentials.commitRecord(this.pluginContext, ownerId, this.providerCredentialReference(providerId), record);
  }

  deleteProviderCredential(ownerId: string, providerId: string): boolean {
    return this.pluginContext.lfaaCredentials.deleteRecord(this.pluginContext, ownerId, this.providerCredentialReference(providerId));
  }

  private findAvailablePort(routes: ConnectivityRoute[], transport: GameTransport, start: number, end: number): number {
    if (!validPortRange(start, end)) throw new ConnectivityServiceError("relay_not_configured", "Relay 公网端口池未配置。");
    const used = new Set(routes.filter(route => route.mode === "room-domain" && route.transport === transport && route.publicPort !== null && !(transport === "tcp" && route.sourceAppId === "minecraft")).map(route => route.publicPort).filter((port): port is number => port !== null));
    for (let port = start; port <= end; port += 1) if (!used.has(port)) return port;
    throw new ConnectivityServiceError("relay_capacity_reached", "Relay 当前没有可分配的公网端口。");
  }

  private readDocument(): RouteDocument {
    const paths = resolveDataPaths(config.dataDirectory);
    if (!existsSync(paths.connectivity)) return emptyDocument();
    const directory = lstatSync(paths.connectivity);
    if (directory.isSymbolicLink() || !directory.isDirectory()) throw new ConnectivityServiceError("route_store_invalid", "联机数据目录不是普通目录，拒绝读取。");
    if (!existsSync(this.filePath)) return emptyDocument();
    const file = lstatSync(this.filePath);
    if (file.isSymbolicLink() || !file.isFile() || file.size > recordLimitBytes) throw new ConnectivityServiceError("route_store_invalid", "联机路由文件类型或大小无效，原件已保留。");
    let saved: unknown;
    try { saved = JSON.parse(readFileSync(this.filePath, "utf8")); } catch { throw new ConnectivityServiceError("route_store_invalid", "联机路由文件无法解析，原件已保留。"); }
    if (!saved || typeof saved !== "object" || (saved as Partial<RouteDocument>).version !== 1 || !Number.isSafeInteger((saved as Partial<RouteDocument>).revision) || !Array.isArray((saved as Partial<RouteDocument>).routes) || !(saved as RouteDocument).routes.every(isRoute)) throw new ConnectivityServiceError("route_store_invalid", "联机路由文件格式或版本无效，原件已保留。");
    const routes = (saved as RouteDocument).routes;
    if (routes.length > 100_000 || new Set(routes.map(route => route.id)).size !== routes.length) throw new ConnectivityServiceError("route_store_invalid", "联机路由文件存在重复或超量记录，原件已保留。");
    return { version: 1, revision: Number((saved as RouteDocument).revision), routes: structuredClone(routes) };
  }

  private writeDocument(document: RouteDocument): void {
    const paths = resolveDataPaths(config.dataDirectory);
    mkdirSync(paths.connectivity, { recursive: true, mode: 0o700 });
    const rootStat = lstatSync(paths.root);
    const directoryStat = lstatSync(paths.connectivity);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory() || directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw new ConnectivityServiceError("route_store_invalid", "联机数据目录不是普通目录，拒绝写入。");
    const next = { ...document, revision: document.revision + 1 };
    atomicWrite(this.filePath, next);
    const readback = this.readDocument();
    if (readback.revision !== next.revision || JSON.stringify(readback.routes) !== JSON.stringify(next.routes)) throw new ConnectivityServiceError("route_store_readback_failed", "联机路由回读校验失败。");
    Object.assign(document, next);
  }

  private readEasyTierTaskDocument(): EasyTierTaskDocument {
    const paths = resolveDataPaths(config.dataDirectory);
    const root = lstatSync(paths.root, { throwIfNoEntry: false });
    if (!root) return { version: 1, revision: 0, tasks: [] };
    if (root.isSymbolicLink() || !root.isDirectory()) {
      throw new ConnectivityServiceError("easytier_task_store_invalid", "LFAA 数据根目录不是普通目录，拒绝读取。");
    }
    const directory = lstatSync(paths.connectivity, { throwIfNoEntry: false });
    if (!directory) return { version: 1, revision: 0, tasks: [] };
    if (directory.isSymbolicLink() || !directory.isDirectory()) {
      throw new ConnectivityServiceError("easytier_task_store_invalid", "联机数据目录不是普通目录，拒绝读取。");
    }
    const file = lstatSync(this.easyTierTasksPath, { throwIfNoEntry: false });
    if (!file) return { version: 1, revision: 0, tasks: [] };
    if (file.isSymbolicLink() || !file.isFile() || file.size > easyTierTaskLimitBytes) {
      throw new ConnectivityServiceError("easytier_task_store_invalid", "EasyTier 任务数据文件类型或大小无效，原件已保留。");
    }
    let saved: unknown;
    try { saved = JSON.parse(readFileSync(this.easyTierTasksPath, "utf8")); }
    catch { throw new ConnectivityServiceError("easytier_task_store_invalid", "EasyTier 任务数据无法解析，原件已保留。"); }
    if (!saved || typeof saved !== "object" || (saved as Partial<EasyTierTaskDocument>).version !== 1
      || !Number.isSafeInteger((saved as Partial<EasyTierTaskDocument>).revision) || !Array.isArray((saved as Partial<EasyTierTaskDocument>).tasks)
      || !(saved as EasyTierTaskDocument).tasks.every(isEasyTierInstallTask) || (saved as EasyTierTaskDocument).tasks.length > easyTierTaskLimit
      || new Set((saved as EasyTierTaskDocument).tasks.map(task => task.id)).size !== (saved as EasyTierTaskDocument).tasks.length) {
      throw new ConnectivityServiceError("easytier_task_store_invalid", "EasyTier 任务数据格式或版本无效，原件已保留。");
    }
    return { version: 1, revision: Number((saved as EasyTierTaskDocument).revision), tasks: structuredClone((saved as EasyTierTaskDocument).tasks) };
  }

  private expireEasyTierTasks(document: EasyTierTaskDocument, now: number): boolean {
    let changed = false;
    const retentionCutoff = now - easyTierTaskRetentionMs;
    document.tasks = document.tasks.filter(task => {
      if (task.status === "running" && task.deadlineAt && Date.parse(task.deadlineAt) <= now) {
        task.status = "unknown";
        task.message = "Daemon 安装任务超时，结果未知；任务不会自动重放。";
        task.finishedAt = new Date(now).toISOString();
        task.deadlineAt = null;
        changed = true;
      }
      if (task.status !== "queued" && task.finishedAt && Date.parse(task.finishedAt) <= retentionCutoff) { changed = true; return false; }
      return true;
    });
    return changed;
  }

  private writeEasyTierTaskDocument(document: EasyTierTaskDocument): void {
    const paths = resolveDataPaths(config.dataDirectory);
    mkdirSync(paths.connectivity, { recursive: true, mode: 0o700 });
    const rootStat = lstatSync(paths.root);
    const directoryStat = lstatSync(paths.connectivity);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory() || directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
      throw new ConnectivityServiceError("easytier_task_store_invalid", "联机数据目录不是普通目录，拒绝写入。");
    }
    const next = { ...document, revision: document.revision + 1 };
    atomicWrite(this.easyTierTasksPath, next);
    const readback = this.readEasyTierTaskDocument();
    if (readback.revision !== next.revision || JSON.stringify(readback.tasks) !== JSON.stringify(next.tasks)) {
      throw new ConnectivityServiceError("easytier_task_store_readback_failed", "EasyTier 安装任务回读校验失败。");
    }
    Object.assign(document, next);
  }
}

declare module "@deepseek-ai/cordis" { interface Context { lfaaGameConnectivity: GameConnectivityService } }
export const name = "lfaaGameConnectivity";
export const inject = ["lfaaCredentials"];
export function apply(ctx: Context): void {
  const service = new GameConnectivityService(ctx);
  ctx.provide(name, service);
}
