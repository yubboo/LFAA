/**
 * 文件：account.types.ts
 * 作用：定义 AI 账户、连接探测、宿主能力、托管登录与模型配置的业务类型。
 * 负责：账户元数据、Secret 引用、连接状态、模型发现结果、显式当前模型绑定、已校验模型参数、宿主托管认证状态。
 * 不负责：Secret 明文持久化、HTTP/进程实现、React UI、宿主文件写入。
 * 状态归属：纯类型契约，无运行时状态。
 * 对外接口：AiAccountRecord、AiActiveModelBinding、AiAccountDraft、AiAccountProbeResult、AiManagedLogin* 等。
 * 关联文件：account-service.ts、host-ports.ts、provider.types.ts、model-settings.ts。
 * 修改注意事项：任何可持久化结构都禁止加入 apiKey/token/password/secret 明文字段；托管认证不得暴露 Token。
 */
import type { CredentialPersistence } from "@lfaa/credentials";
import type { AiHostCapabilityId, AiModelCapabilities, AiModelCapabilitySource, AiModelSettingValue, AiProviderId } from "./provider.types.ts";

export type AiAccountVerificationStatus = "connected" | "unverified" | "error";
export type AiSecretPersistence = Exclude<CredentialPersistence, "unavailable">;

export interface AiHostCapabilityStatus {
  available: boolean;
  reason?: string;
}

export type AiAccountHostCapabilities = Readonly<Partial<Record<AiHostCapabilityId, AiHostCapabilityStatus>>>;

export interface AiManagedLoginStart {
  loginId: string;
  authUrl: string;
}

export type AiManagedLoginStatus =
  | { state: "pending" }
  | { state: "succeeded" }
  | { state: "failed"; error: string };

export interface AiAccountModel {
  id: string;
  name?: string;
  ownedBy?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  discoverySource?: AiModelCapabilitySource;
  capabilities?: AiModelCapabilities;
}

/**
 * 当前 Agent 真正使用的模型绑定。
 * 这是独立于账户内部“默认选中模型”的全局事实，避免多账户时靠数组顺序猜当前模型。
 */
export interface AiActiveModelBinding {
  accountId: string;
  providerId: AiProviderId;
  modelId: string;
}

export interface AiAccountRecord {
  id: string;
  providerId: AiProviderId;
  displayName: string;
  authMethodId: string;
  /** API Key / Token Plan 使用 Secret 引用；宿主管理的订阅登录必须为 null。 */
  credentialRef: string | null;
  settings: Readonly<Record<string, string>>;
  /** 该账户默认模型；“当前 Agent 使用哪个账户”由 AiActiveModelBinding 单独决定。 */
  selectedModelId: string | null;
  modelSettings: Readonly<Record<string, AiModelSettingValue>>;
  /** 最近一次来自官方运行时/官方目录的模型快照。只含公开元数据，不含 Secret。 */
  modelCatalog: readonly AiAccountModel[];
  verificationStatus: AiAccountVerificationStatus;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiAccountDraft {
  accountId?: string;
  providerId: AiProviderId;
  displayName: string;
  authMethodId: string;
  settings: Readonly<Record<string, string>>;
  selectedModelId?: string | null;
  modelSettings?: Readonly<Record<string, AiModelSettingValue>>;
}

export interface AiAccountProbeResult {
  status: "connected" | "unverified";
  message: string;
  models: readonly AiAccountModel[];
  /** Provider 明确允许用户手填模型 ID 时才为 true；不能用它掩盖缺失的连接参数。 */
  manualModelEntry?: boolean;
  resolvedBaseUrl?: string;
}

export interface AiAccountSnapshot {
  accounts: readonly AiAccountRecord[];
  /** 当前 Agent/Composer 的唯一模型事实源。 */
  activeModel: AiActiveModelBinding | null;
  secretPersistence: AiSecretPersistence;
  hostCapabilities: AiAccountHostCapabilities;
}
