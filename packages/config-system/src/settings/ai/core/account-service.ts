/**
 * 文件：account-service.ts
 * 作用：实现 AI Provider 账户的真实配置业务闭环。
 * 负责：草稿校验、Secret 引用、模型探测、账户保存/删除、模型选择。
 * 不负责：HTTP/Secret/文件系统具体实现、React UI、Codex OAuth 进程管理。
 * 状态归属：AiAccountService 无内部可持久状态，状态由 Host Ports 持有。
 * 对外接口：AiAccountService。
 * 关联文件：account.types.ts、host-ports.ts、provider-registry.ts、../transports/*。
 * 修改注意事项：Secret 仅在方法栈内短暂出现，禁止写入 Record、错误字符串或日志。
 */
import type { AiProviderRegistry } from "./provider-registry.ts";
import type { AiAccountDraft, AiAccountModel, AiAccountProbeResult, AiAccountRecord, AiAccountSnapshot } from "./account.types.ts";
import type { AiAccountHostPorts } from "./host-ports.ts";
import { buildOpenAiCompatibleModelRequest, parseOpenAiCompatibleModelList } from "../transports/openai-compatible.ts";
import { parseQwenModelList } from "../transports/qwen-model-list.ts";

function cleanSettings(settings: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, value.trim()]));
}

function validateDraft(registry: AiProviderRegistry, draft: AiAccountDraft, secret: string | null): void {
  const plugin = registry.get(draft.providerId);
  const auth = plugin.authMethods.find((item) => item.id === draft.authMethodId);
  if (!auth) throw new Error(`${plugin.displayName} 不支持当前认证方式。`);
  if (auth.kind === "subscription") throw new Error(`${auth.label} 需要 Codex App Server，当前版本尚未接入。`);
  if (auth.secretLabel && !secret?.trim()) throw new Error(`请输入${auth.secretLabel}。`);
  if (auth.credentialPrefix && secret && !secret.startsWith(auth.credentialPrefix)) {
    throw new Error(`${auth.secretLabel ?? "凭证"}格式与当前认证方式不匹配。`);
  }
  for (const field of plugin.configFields) {
    const value = draft.settings[field.id]?.trim() ?? "";
    if (field.required && !value) throw new Error(`请填写${field.label}。`);
  }
}

function credentialRefFor(recordId: string, providerId: string, authMethodId: string): string {
  return `lfaa-ai:${providerId}:${recordId}:${authMethodId}`;
}

function normalizeModels(models: readonly AiAccountModel[]): readonly AiAccountModel[] {
  const unique = new Map<string, AiAccountModel>();
  for (const model of models) if (!unique.has(model.id)) unique.set(model.id, model);
  return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
}

export class AiAccountService {
  readonly #registry: AiProviderRegistry;
  readonly #ports: AiAccountHostPorts;

  constructor(registry: AiProviderRegistry, ports: AiAccountHostPorts) {
    this.#registry = registry;
    this.#ports = ports;
  }

  async snapshot(): Promise<AiAccountSnapshot> {
    return { accounts: await this.#ports.repository.list(), secretPersistence: this.#ports.secrets.persistence };
  }

  async probe(draft: AiAccountDraft, secret: string): Promise<AiAccountProbeResult> {
    validateDraft(this.#registry, draft, secret);
    const plugin = this.#registry.get(draft.providerId);
    const connection = plugin.resolveConnection({ authMethodId: draft.authMethodId, settings: cleanSettings(draft.settings) });

    if (connection.modelDiscovery.kind === "manual") {
      return {
        status: "unverified",
        message: connection.modelDiscovery.reason,
        models: draft.selectedModelId ? [{ id: draft.selectedModelId }] : [],
        ...(connection.baseUrl ? { resolvedBaseUrl: connection.baseUrl } : {}),
      };
    }
    if (connection.modelDiscovery.kind === "codex-account") {
      throw new Error("ChatGPT 套餐认证将在 Codex App Server 子任务中接入。");
    }
    if (!connection.authHeader) throw new Error("Provider 未声明模型发现鉴权方式。");

    const request = buildOpenAiCompatibleModelRequest(connection.modelDiscovery.url, connection.authHeader, secret.trim());
    const payload = await this.#ports.http.requestJson(request);
    const models = connection.modelDiscovery.responseShape === "qwen-model-list"
      ? parseQwenModelList(payload)
      : parseOpenAiCompatibleModelList(payload);
    return {
      status: "connected",
      message: `连接成功，发现 ${models.length} 个模型。`,
      models: normalizeModels(models),
      ...(connection.baseUrl ? { resolvedBaseUrl: connection.baseUrl } : {}),
    };
  }

  async save(draft: AiAccountDraft, secret: string): Promise<{ account: AiAccountRecord; probe: AiAccountProbeResult }> {
    const probe = await this.probe(draft, secret);
    const existing = draft.accountId ? (await this.#ports.repository.list()).find((item) => item.id === draft.accountId) : undefined;
    const id = existing?.id ?? this.#ports.createId();
    const credentialRef = existing?.credentialRef ?? credentialRefFor(id, draft.providerId, draft.authMethodId);
    const now = this.#ports.now();
    const previousSecret = existing ? await this.#ports.secrets.get(credentialRef) : null;
    await this.#ports.secrets.put(credentialRef, secret.trim());
    const selectedModelId = draft.selectedModelId?.trim() || probe.models[0]?.id || null;
    const account: AiAccountRecord = {
      id,
      providerId: draft.providerId,
      displayName: draft.displayName.trim() || this.#registry.get(draft.providerId).displayName,
      authMethodId: draft.authMethodId,
      credentialRef,
      settings: cleanSettings(draft.settings),
      selectedModelId,
      verificationStatus: probe.status,
      lastVerifiedAt: probe.status === "connected" ? now : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await this.#ports.repository.put(account);
    } catch (error) {
      if (previousSecret === null) await this.#ports.secrets.delete(credentialRef).catch(() => undefined);
      else await this.#ports.secrets.put(credentialRef, previousSecret).catch(() => undefined);
      throw error;
    }
    return { account, probe };
  }

  async reprobe(accountId: string): Promise<AiAccountProbeResult> {
    const account = (await this.#ports.repository.list()).find((item) => item.id === accountId);
    if (!account) throw new Error("账户不存在。");
    const secret = await this.#ports.secrets.get(account.credentialRef);
    if (!secret) throw new Error("账户凭证不存在，请重新录入。");
    try {
      const probe = await this.probe({
        accountId: account.id,
        providerId: account.providerId,
        displayName: account.displayName,
        authMethodId: account.authMethodId,
        settings: account.settings,
        selectedModelId: account.selectedModelId,
      }, secret);
      const now = this.#ports.now();
      await this.#ports.repository.put({ ...account, verificationStatus: probe.status, lastVerifiedAt: probe.status === "connected" ? now : account.lastVerifiedAt, updatedAt: now });
      return probe;
    } catch (error) {
      await this.#ports.repository.put({ ...account, verificationStatus: "error", updatedAt: this.#ports.now() }).catch(() => undefined);
      throw error;
    }
  }

  async selectModel(accountId: string, modelId: string): Promise<void> {
    const accounts = await this.#ports.repository.list();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) throw new Error("账户不存在。");
    await this.#ports.repository.put({ ...account, selectedModelId: modelId.trim() || null, updatedAt: this.#ports.now() });
  }

  async delete(accountId: string): Promise<void> {
    const accounts = await this.#ports.repository.list();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;
    await this.#ports.repository.delete(accountId);
    try {
      await this.#ports.secrets.delete(account.credentialRef);
    } catch (error) {
      await this.#ports.repository.put(account).catch(() => undefined);
      throw error;
    }
  }
}
