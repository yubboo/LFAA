/**
 * 文件：account-service.ts
 * 作用：实现 AI Provider 账户与“当前模型”选择的真实配置业务闭环。
 * 负责：草稿校验、Secret 引用、托管登录、官方模型探测、模型目录快照、模型参数校验、账户保存/删除/重测、显式 Active Model。
 * 不负责：HTTP/Secret/文件系统/Codex 进程具体实现、React UI、推理 Runtime。
 * 状态归属：AiAccountService 无内部可持久状态，状态由 Host Ports 持有。
 * 对外接口：AiAccountService。
 * 关联文件：account.types.ts、host-ports.ts、provider-registry.ts、model-settings.ts、../transports/*。
 * 修改注意事项：Secret 仅在方法栈内短暂出现；宿主管理登录不保存 Secret；模型参数必须由官方 Capability 契约校验。
 */
import type { AiProviderRegistry } from "./provider-registry.ts";
import type {
  AiAccountDraft,
  AiAccountModel,
  AiAccountProbeResult,
  AiAccountRecord,
  AiAccountSnapshot,
  AiActiveModelBinding,
  AiManagedLoginStart,
  AiManagedLoginStatus,
} from "./account.types.ts";
import type { AiAccountHostPorts, AiManagedAuthPort } from "./host-ports.ts";
import type { AiAuthMethod, AiModelCapabilities, AiModelSettingValue, AiProviderPlugin } from "./provider.types.ts";
import { createCredentialRef } from "@lfaa/credentials";
import { defaultModelSettings, validateModelSettings } from "./model-settings.ts";
import { buildOpenAiCompatibleModelRequest, parseOpenAiCompatibleModelList } from "../transports/openai-compatible.ts";
import { parseQwenModelList } from "../transports/qwen-model-list.ts";

function cleanSettings(settings: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, value.trim()]));
}

function resolveAuthMethod(registry: AiProviderRegistry, draft: AiAccountDraft): { plugin: AiProviderPlugin; auth: AiAuthMethod } {
  const plugin = registry.get(draft.providerId);
  const auth = plugin.authMethods.find((item) => item.id === draft.authMethodId);
  if (!auth) throw new Error(`${plugin.displayName} 不支持当前认证方式。`);
  return { plugin, auth };
}

function validateDraft(registry: AiProviderRegistry, draft: AiAccountDraft, secret: string | null): { plugin: AiProviderPlugin; auth: AiAuthMethod } {
  const { plugin, auth } = resolveAuthMethod(registry, draft);
  if (auth.secretLabel && !secret?.trim()) throw new Error(`请输入${auth.secretLabel}。`);
  if (auth.credentialPrefix && secret && !secret.startsWith(auth.credentialPrefix)) throw new Error(`${auth.secretLabel ?? "凭证"}格式与当前认证方式不匹配。`);
  for (const field of plugin.configFields) {
    const value = draft.settings[field.id]?.trim() ?? "";
    if (field.required && !value) throw new Error(`请填写${field.label}。`);
  }
  return { plugin, auth };
}

function credentialRefFor(recordId: string, providerId: string, authMethodId: string): string {
  return createCredentialRef("lfaa-ai", providerId, recordId, authMethodId);
}

function decorateModels(plugin: AiProviderPlugin, models: readonly AiAccountModel[], discoverySource?: AiAccountModel["discoverySource"]): readonly AiAccountModel[] {
  const unique = new Map<string, AiAccountModel>();
  for (const raw of models) {
    if (unique.has(raw.id)) continue;
    const capabilities = raw.capabilities ?? plugin.describeModel(raw.id);
    unique.set(raw.id, {
      ...raw,
      ...(raw.contextWindow === undefined && capabilities?.contextWindow !== undefined ? { contextWindow: capabilities.contextWindow } : {}),
      ...(raw.maxOutputTokens === undefined && capabilities?.maxOutputTokens !== undefined ? { maxOutputTokens: capabilities.maxOutputTokens } : {}),
      ...(raw.discoverySource ? {} : discoverySource ? { discoverySource } : {}),
      ...(capabilities ? { capabilities } : {}),
    });
  }
  return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
}

function ensureModelAvailable(modelId: string | null, models: readonly AiAccountModel[]): void {
  if (!modelId || models.length === 0) return;
  if (!models.some((model) => model.id === modelId)) throw new Error(`模型 ${modelId} 不在当前账户的官方模型目录中。请重新测试后选择实际可用模型。`);
}

function modelCapabilities(plugin: AiProviderPlugin, modelId: string, models: readonly AiAccountModel[]): AiModelCapabilities | null {
  return models.find((model) => model.id === modelId)?.capabilities ?? plugin.describeModel(modelId);
}

function resolveModelSettings(
  plugin: AiProviderPlugin,
  modelId: string | null,
  raw: Readonly<Record<string, AiModelSettingValue>> | undefined,
  models: readonly AiAccountModel[],
): Readonly<Record<string, AiModelSettingValue>> {
  if (!modelId) {
    if (raw && Object.keys(raw).length) throw new Error("尚未选择模型，不能保存模型参数。");
    return {};
  }
  const capabilities = modelCapabilities(plugin, modelId, models);
  const source = raw && Object.keys(raw).length ? raw : defaultModelSettings(capabilities);
  return validateModelSettings(capabilities, source);
}

function requireManagedAuth(ports: AiAccountHostPorts, auth: AiAuthMethod): AiManagedAuthPort {
  if (!auth.hostCapability) throw new Error(`${auth.label} 未声明可用的宿主管理认证能力。`);
  const managedAuth = ports.managedAuth;
  if (!managedAuth || managedAuth.kind !== auth.hostCapability) throw new Error(`当前宿主未提供 ${auth.hostCapability} 托管认证能力。`);
  return managedAuth;
}

function bindingFor(account: AiAccountRecord | undefined): AiActiveModelBinding | null {
  if (!account?.selectedModelId) return null;
  return { accountId: account.id, providerId: account.providerId, modelId: account.selectedModelId };
}

function bindingMatchesAccount(binding: AiActiveModelBinding | null, account: AiAccountRecord | undefined): boolean {
  return Boolean(binding && account && account.id === binding.accountId && account.providerId === binding.providerId && account.selectedModelId === binding.modelId);
}

export class AiAccountService {
  readonly #registry: AiProviderRegistry;
  readonly #ports: AiAccountHostPorts;

  constructor(registry: AiProviderRegistry, ports: AiAccountHostPorts) { this.#registry = registry; this.#ports = ports; }

  async #activeModel(accounts: readonly AiAccountRecord[]): Promise<AiActiveModelBinding | null> {
    const stored = await this.#ports.repository.getActiveModel?.() ?? null;
    const storedAccount = stored ? accounts.find((item) => item.id === stored.accountId) : undefined;
    if (bindingMatchesAccount(stored, storedAccount)) return stored;
    return bindingFor(accounts.find((item) => Boolean(item.selectedModelId)));
  }

  async #persistActive(binding: AiActiveModelBinding | null): Promise<void> {
    await this.#ports.repository.setActiveModel?.(binding);
  }

  async snapshot(): Promise<AiAccountSnapshot> {
    const managedAuth = this.#ports.managedAuth;
    let hostCapabilities: AiAccountSnapshot["hostCapabilities"] = {};
    if (managedAuth) {
      let status;
      try { status = await managedAuth.status(); }
      catch (error) { status = { available: false, reason: error instanceof Error ? error.message : `${managedAuth.kind} 状态检查失败。` }; }
      hostCapabilities = { [managedAuth.kind]: status };
    }
    const accounts = await this.#ports.repository.list();
    return {
      accounts,
      activeModel: await this.#activeModel(accounts),
      secretPersistence: this.#ports.secrets.persistence,
      hostCapabilities,
    };
  }

  async startManagedLogin(draft: AiAccountDraft): Promise<AiManagedLoginStart> {
    const { auth } = validateDraft(this.#registry, draft, null);
    if (auth.kind !== "subscription") throw new Error("当前认证方式不使用宿主管理登录。");
    const managedAuth = requireManagedAuth(this.#ports, auth);
    const status = await managedAuth.status();
    if (!status.available) throw new Error(status.reason ?? `${managedAuth.kind} 当前不可用。`);
    return managedAuth.startLogin();
  }

  async managedLoginStatus(loginId: string): Promise<AiManagedLoginStatus> {
    if (!loginId.trim()) throw new Error("登录会话 ID 不能为空。");
    if (!this.#ports.managedAuth) throw new Error("当前宿主未提供托管认证能力。");
    return this.#ports.managedAuth.loginStatus(loginId.trim());
  }

  async cancelManagedLogin(loginId: string): Promise<void> {
    if (!loginId.trim() || !this.#ports.managedAuth) return;
    await this.#ports.managedAuth.cancelLogin(loginId.trim());
  }

  async probe(draft: AiAccountDraft, secret: string | null): Promise<AiAccountProbeResult> {
    const { plugin, auth } = validateDraft(this.#registry, draft, secret);
    const connection = plugin.resolveConnection({ authMethodId: draft.authMethodId, settings: cleanSettings(draft.settings) });

    if (connection.modelDiscovery.kind === "manual") {
      const models = draft.selectedModelId ? decorateModels(plugin, [{ id: draft.selectedModelId }]) : [];
      return { status: "unverified", message: connection.modelDiscovery.reason, models, manualModelEntry: true, ...(connection.baseUrl ? { resolvedBaseUrl: connection.baseUrl } : {}) };
    }
    if (connection.modelDiscovery.kind === "official-catalog") {
      const models = decorateModels(plugin, connection.modelDiscovery.models, connection.modelDiscovery.source);
      return { status: "unverified", message: `${connection.modelDiscovery.reason} 已载入 ${models.length} 个官方目录模型。`, models, ...(connection.baseUrl ? { resolvedBaseUrl: connection.baseUrl } : {}) };
    }
    if (connection.modelDiscovery.kind === "codex-account") {
      const managedAuth = requireManagedAuth(this.#ports, auth);
      const probe = await managedAuth.probe();
      return { ...probe, models: decorateModels(plugin, probe.models) };
    }
    if (!connection.authHeader) throw new Error("Provider 未声明模型发现鉴权方式。");
    if (!secret?.trim()) throw new Error(`${auth.secretLabel ?? "凭证"}不能为空。`);

    const request = buildOpenAiCompatibleModelRequest(connection.modelDiscovery.url, connection.authHeader, secret.trim());
    const payload = await this.#ports.http.requestJson(request);
    const parsed = connection.modelDiscovery.responseShape === "qwen-model-list" ? parseQwenModelList(payload) : parseOpenAiCompatibleModelList(payload);
    const models = decorateModels(plugin, parsed, connection.modelDiscovery.source);
    return { status: "connected", message: `连接成功，官方模型目录返回 ${models.length} 个模型。`, models, ...(connection.baseUrl ? { resolvedBaseUrl: connection.baseUrl } : {}) };
  }

  async save(draft: AiAccountDraft, secret: string | null): Promise<{ account: AiAccountRecord; probe: AiAccountProbeResult }> {
    const { plugin, auth } = validateDraft(this.#registry, draft, secret);
    const probe = await this.probe(draft, secret);
    const beforeAccounts = await this.#ports.repository.list();
    const existing = draft.accountId ? beforeAccounts.find((item) => item.id === draft.accountId) : undefined;
    const id = existing?.id ?? this.#ports.createId();
    const usesManagedAuth = auth.kind === "subscription";
    const canReuseCredentialRef = Boolean(
      existing?.credentialRef
      && existing.providerId === draft.providerId
      && existing.authMethodId === draft.authMethodId,
    );
    const credentialRef = usesManagedAuth
      ? null
      : canReuseCredentialRef
        ? existing?.credentialRef ?? null
        : credentialRefFor(id, draft.providerId, draft.authMethodId);
    const now = this.#ports.now();
    const previousCredentialRef = existing?.credentialRef ?? null;
    const previousSecret = previousCredentialRef ? await this.#ports.secrets.get(previousCredentialRef) : null;
    const targetSecretBefore = credentialRef ? await this.#ports.secrets.get(credentialRef) : null;
    const activeBefore = await this.#activeModel(beforeAccounts);
    const selectedModelId = draft.selectedModelId?.trim() || probe.models[0]?.id || null;
    ensureModelAvailable(selectedModelId, probe.models);
    const modelSettings = resolveModelSettings(plugin, selectedModelId, draft.modelSettings, probe.models);

    if (credentialRef) await this.#ports.secrets.put(credentialRef, secret?.trim() ?? "");
    const account: AiAccountRecord = {
      id,
      providerId: draft.providerId,
      displayName: draft.displayName.trim() || plugin.displayName,
      authMethodId: draft.authMethodId,
      credentialRef,
      settings: cleanSettings(draft.settings),
      selectedModelId,
      modelSettings,
      modelCatalog: probe.models,
      verificationStatus: probe.status,
      lastVerifiedAt: probe.status === "connected" ? now : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await this.#ports.repository.put(account);
      if (!activeBefore || activeBefore.accountId === account.id) await this.#persistActive(bindingFor(account));
      if (previousCredentialRef && previousCredentialRef !== credentialRef) await this.#ports.secrets.delete(previousCredentialRef);
    } catch (error) {
      if (existing) await this.#ports.repository.put(existing).catch(() => undefined);
      else await this.#ports.repository.delete(id).catch(() => undefined);
      await this.#persistActive(activeBefore).catch(() => undefined);
      if (credentialRef) {
        if (targetSecretBefore === null) await this.#ports.secrets.delete(credentialRef).catch(() => undefined);
        else await this.#ports.secrets.put(credentialRef, targetSecretBefore).catch(() => undefined);
      }
      if (previousCredentialRef && previousCredentialRef !== credentialRef && previousSecret !== null) {
        await this.#ports.secrets.put(previousCredentialRef, previousSecret).catch(() => undefined);
      }
      throw error;
    }
    return { account, probe };
  }

  async reprobe(accountId: string): Promise<AiAccountProbeResult> {
    const accounts = await this.#ports.repository.list();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) throw new Error("账户不存在。");
    const secret = account.credentialRef ? await this.#ports.secrets.get(account.credentialRef) : null;
    if (account.credentialRef && !secret) throw new Error("账户凭证不存在，请重新录入。");
    let probe: AiAccountProbeResult;
    try {
      probe = await this.probe({ accountId: account.id, providerId: account.providerId, displayName: account.displayName, authMethodId: account.authMethodId, settings: account.settings, selectedModelId: account.selectedModelId, modelSettings: account.modelSettings }, secret);
    } catch (error) {
      await this.#ports.repository.put({ ...account, verificationStatus: "error", updatedAt: this.#ports.now() }).catch(() => undefined);
      throw error;
    }
    const now = this.#ports.now();
    const selectedStillAvailable = !account.selectedModelId || probe.models.length === 0 || probe.models.some((item) => item.id === account.selectedModelId);
    const updated: AiAccountRecord = {
      ...account,
      selectedModelId: selectedStillAvailable ? account.selectedModelId : null,
      modelSettings: selectedStillAvailable ? account.modelSettings : {},
      modelCatalog: probe.models,
      verificationStatus: probe.status,
      lastVerifiedAt: probe.status === "connected" ? now : account.lastVerifiedAt,
      updatedAt: now,
    };
    const activeBefore = await this.#activeModel(accounts);
    try {
      await this.#ports.repository.put(updated);
      if (activeBefore?.accountId === account.id) await this.#persistActive(bindingFor(updated));
    } catch (error) {
      await this.#ports.repository.put(account).catch(() => undefined);
      await this.#persistActive(activeBefore).catch(() => undefined);
      throw error;
    }
    return probe;
  }

  async selectModel(accountId: string, modelId: string, modelSettings: Readonly<Record<string, AiModelSettingValue>> = {}): Promise<void> {
    const accounts = await this.#ports.repository.list();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) throw new Error("账户不存在。");
    const secret = account.credentialRef ? await this.#ports.secrets.get(account.credentialRef) : null;
    if (account.credentialRef && !secret) throw new Error("账户凭证不存在，请重新录入。");
    const probe = await this.probe({ providerId: account.providerId, displayName: account.displayName, authMethodId: account.authMethodId, settings: account.settings, selectedModelId: modelId }, secret);
    const selectedModelId = modelId.trim() || null;
    ensureModelAvailable(selectedModelId, probe.models);
    const plugin = this.#registry.get(account.providerId);
    const resolvedSettings = resolveModelSettings(plugin, selectedModelId, modelSettings, probe.models);
    const updated: AiAccountRecord = {
      ...account,
      selectedModelId,
      modelSettings: resolvedSettings,
      modelCatalog: probe.models,
      verificationStatus: probe.status,
      lastVerifiedAt: probe.status === "connected" ? this.#ports.now() : account.lastVerifiedAt,
      updatedAt: this.#ports.now(),
    };
    const activeBefore = await this.#activeModel(accounts);
    try {
      await this.#ports.repository.put(updated);
      if (!activeBefore || activeBefore.accountId === account.id) await this.#persistActive(bindingFor(updated));
    } catch (error) {
      await this.#ports.repository.put(account).catch(() => undefined);
      await this.#persistActive(activeBefore).catch(() => undefined);
      throw error;
    }
  }

  async activateModel(accountId: string): Promise<void> {
    const accounts = await this.#ports.repository.list();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) throw new Error("账户不存在。");
    const binding = bindingFor(account);
    if (!binding) throw new Error("请先为该账户选择模型。");
    await this.#persistActive(binding);
  }

  async delete(accountId: string): Promise<void> {
    const accounts = await this.#ports.repository.list();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;
    const active = await this.#activeModel(accounts);
    const remaining = accounts.filter((item) => item.id !== accountId);
    const nextActive = active?.accountId === accountId
      ? bindingFor(remaining.find((item) => Boolean(item.selectedModelId)))
      : active;
    const previousSecret = account.credentialRef ? await this.#ports.secrets.get(account.credentialRef) : null;
    try {
      await this.#ports.repository.delete(accountId);
      await this.#persistActive(nextActive);
      // 宿主管理登录属于 Codex 全局认证状态；删除 LFAA 项目账户只能解除关联，不能全局 logout。
      if (account.credentialRef) await this.#ports.secrets.delete(account.credentialRef);
    } catch (error) {
      await this.#ports.repository.put(account).catch(() => undefined);
      await this.#persistActive(active).catch(() => undefined);
      if (account.credentialRef && previousSecret !== null) {
        await this.#ports.secrets.put(account.credentialRef, previousSecret).catch(() => undefined);
      }
      throw error;
    }
  }
}
