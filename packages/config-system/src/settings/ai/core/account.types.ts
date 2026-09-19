/**
 * 文件：account.types.ts
 * 作用：定义 AI 账户、连接探测、官方模型能力与模型配置的业务类型。
 * 负责：账户元数据、Secret 引用、连接状态、模型发现结果、已校验模型参数。
 * 不负责：Secret 明文持久化、HTTP 实现、React UI、宿主文件写入。
 * 状态归属：纯类型契约，无运行时状态。
 * 对外接口：AiAccountRecord、AiAccountDraft、AiAccountProbeResult 等。
 * 关联文件：account-service.ts、host-ports.ts、provider.types.ts、model-settings.ts。
 * 修改注意事项：任何可持久化结构都禁止加入 apiKey/token/password/secret 明文字段。
 */
import type { AiModelCapabilities, AiModelCapabilitySource, AiModelSettingValue, AiProviderId } from "./provider.types.ts";

export type AiAccountVerificationStatus = "connected" | "unverified" | "error";
export type AiSecretPersistence = "os-credential-store" | "memory";

export interface AiAccountRecord {
  id: string;
  providerId: AiProviderId;
  displayName: string;
  authMethodId: string;
  credentialRef: string;
  settings: Readonly<Record<string, string>>;
  selectedModelId: string | null;
  modelSettings: Readonly<Record<string, AiModelSettingValue>>;
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

export interface AiAccountModel {
  id: string;
  name?: string;
  ownedBy?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  discoverySource?: AiModelCapabilitySource;
  capabilities?: AiModelCapabilities;
}

export interface AiAccountProbeResult {
  status: "connected" | "unverified";
  message: string;
  models: readonly AiAccountModel[];
  resolvedBaseUrl?: string;
}

export interface AiAccountSnapshot {
  accounts: readonly AiAccountRecord[];
  secretPersistence: AiSecretPersistence;
}
