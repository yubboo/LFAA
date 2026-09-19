/**
 * 文件：registry.ts
 * 作用：提供 LFAA 插件与能力目录的 generation-based 原子 Registry。
 * 负责：Manifest 校验、注册/卸载、Capability 查询、不可变 Snapshot。
 * 不负责：动态 import、文件监听、Tool 执行、权限审批、外部 Harness 生命周期。
 * 状态归属：PluginRegistry 是插件/Capability 运行时注册事实的唯一 Owner。
 * 修改注意事项：运行中的 Run 应固定使用启动时 snapshot generation，禁止中途换代破坏可重复性。
 */
import { LFAA_PLUGIN_API_VERSION, type LfaaCapabilityDescriptor, type LfaaCapabilityKind, type LfaaPluginManifest } from "@lfaa/plugin-sdk";

const ID_RE = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/;
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const CREDENTIAL_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const FORBIDDEN_SECRET_KEYS = new Set([
  "apikey", "api_key", "api-key", "token", "accesstoken", "access_token", "access-token",
  "refreshtoken", "refresh_token", "refresh-token", "password", "secret", "credentialvalue", "credential_value",
]);
const SECRET_VALUE_RE = /(?:\bsk-[A-Za-z0-9_-]{12,}\b|\bghp_[A-Za-z0-9_]{12,}\b|\bgithub_pat_[A-Za-z0-9_]{12,}\b)/;

export interface PluginRegistrySnapshot {
  readonly generation: number;
  readonly plugins: ReadonlyMap<string, LfaaPluginManifest>;
  readonly capabilities: ReadonlyMap<string, LfaaCapabilityDescriptor>;
}

function assertNoSecretMaterial(value: unknown, path = "manifest"): void {
  if (typeof value === "string") {
    if (SECRET_VALUE_RE.test(value)) throw new Error(`${path} looks like Secret plaintext; use credentialRef binding instead`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretMaterial(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLocaleLowerCase();
    if (FORBIDDEN_SECRET_KEYS.has(normalized)) throw new Error(`${path}.${key} must not contain Secret plaintext; declare credentials instead`);
    assertNoSecretMaterial(item, `${path}.${key}`);
  }
}

export function validatePluginManifest(manifest: LfaaPluginManifest): LfaaPluginManifest {
  if (manifest.schemaVersion !== 1) throw new Error(`Unsupported plugin manifest schema: ${manifest.schemaVersion}`);
  if (!Number.isInteger(manifest.pluginApiVersion) || manifest.pluginApiVersion < 1) throw new Error("pluginApiVersion must be a positive integer");
  if (manifest.pluginApiVersion !== LFAA_PLUGIN_API_VERSION) throw new Error(`Unsupported plugin API: ${manifest.pluginApiVersion}; expected ${LFAA_PLUGIN_API_VERSION}`);
  if (!ID_RE.test(manifest.pluginId)) throw new Error(`Invalid plugin id: ${manifest.pluginId}`);
  if (!VERSION_RE.test(manifest.pluginVersion)) throw new Error(`Invalid plugin version: ${manifest.pluginVersion}`);

  const local = new Set<string>();
  for (const capability of manifest.capabilities) {
    if (!ID_RE.test(capability.id)) throw new Error(`Invalid capability id: ${capability.id}`);
    if (!VERSION_RE.test(capability.version)) throw new Error(`Invalid capability version: ${capability.id}@${capability.version}`);
    if (local.has(capability.id)) throw new Error(`Duplicate capability in ${manifest.pluginId}: ${capability.id}`);
    local.add(capability.id);
  }

  const credentialIds = new Set<string>();
  for (const requirement of manifest.credentials ?? []) {
    if (!CREDENTIAL_ID_RE.test(requirement.id)) throw new Error(`Invalid credential requirement id: ${requirement.id}`);
    if (credentialIds.has(requirement.id)) throw new Error(`Duplicate credential requirement in ${manifest.pluginId}: ${requirement.id}`);
    if (!requirement.purpose.trim()) throw new Error(`Credential requirement purpose is required: ${requirement.id}`);
    credentialIds.add(requirement.id);
  }

  assertNoSecretMaterial(manifest);
  return manifest;
}

function snapshotOf(
  generation: number,
  plugins: Map<string, LfaaPluginManifest>,
  capabilities: Map<string, LfaaCapabilityDescriptor>,
): PluginRegistrySnapshot {
  return Object.freeze({
    generation,
    plugins: new Map(plugins),
    capabilities: new Map(capabilities),
  });
}

export class PluginRegistry {
  #generation = 0;
  #plugins = new Map<string, LfaaPluginManifest>();
  #capabilities = new Map<string, LfaaCapabilityDescriptor>();

  /** 只验证下一代是否可发布，不改变 generation；业务事务可在持久化前调用。 */
  assertCanRegister(manifest: LfaaPluginManifest): void {
    validatePluginManifest(manifest);
    const previous = this.#plugins.get(manifest.pluginId);
    const previousIds = new Set(previous?.capabilities.map((item) => item.id) ?? []);
    for (const capability of manifest.capabilities) {
      const existing = this.#capabilities.get(capability.id);
      if (existing && !previousIds.has(capability.id)) throw new Error(`Capability already registered: ${capability.id}`);
    }
  }

  register(manifest: LfaaPluginManifest): PluginRegistrySnapshot {
    this.assertCanRegister(manifest);

    const nextPlugins = new Map(this.#plugins);
    const nextCapabilities = new Map(this.#capabilities);
    const previous = nextPlugins.get(manifest.pluginId);
    if (previous) {
      for (const capability of previous.capabilities) nextCapabilities.delete(capability.id);
    }

    for (const capability of manifest.capabilities) {
      const existing = nextCapabilities.get(capability.id);
      if (existing) throw new Error(`Capability already registered: ${capability.id}`);
      nextCapabilities.set(capability.id, capability);
    }

    nextPlugins.set(manifest.pluginId, manifest);
    this.#plugins = nextPlugins;
    this.#capabilities = nextCapabilities;
    this.#generation += 1;
    return this.snapshot();
  }

  unregister(pluginId: string): PluginRegistrySnapshot {
    const previous = this.#plugins.get(pluginId);
    if (!previous) return this.snapshot();

    const nextPlugins = new Map(this.#plugins);
    const nextCapabilities = new Map(this.#capabilities);
    nextPlugins.delete(pluginId);
    for (const capability of previous.capabilities) nextCapabilities.delete(capability.id);

    this.#plugins = nextPlugins;
    this.#capabilities = nextCapabilities;
    this.#generation += 1;
    return this.snapshot();
  }

  snapshot(): PluginRegistrySnapshot {
    return snapshotOf(this.#generation, this.#plugins, this.#capabilities);
  }

  getCapability(id: string): LfaaCapabilityDescriptor | undefined {
    return this.#capabilities.get(id);
  }

  listCapabilities(kind?: LfaaCapabilityKind): readonly LfaaCapabilityDescriptor[] {
    const all = [...this.#capabilities.values()];
    return kind ? all.filter((item) => item.kind === kind) : all;
  }
}
