/**
 * 文件：host-ports.ts
 * 作用：定义 AI Account Core 依赖的宿主能力端口。
 * 负责：账户元数据仓库、Secret Store、HTTP JSON、托管认证、ID/时间能力契约。
 * 不负责：任何具体 Windows/Web/SQLite/Codex 进程实现。
 * 状态归属：接口契约，无运行时状态。
 * 对外接口：AiAccountHostPorts 及子端口。
 * 关联文件：account-service.ts、account.types.ts。
 * 修改注意事项：Host Port 只能表达能力，不得泄漏 Vite/Electron/Node 专有类型；托管认证不得返回 Token。
 */
import type { CredentialStorePort } from "@lfaa/credentials";
import type {
  AiAccountProbeResult,
  AiAccountRecord,
  AiActiveModelBinding,
  AiHostCapabilityStatus,
  AiManagedLoginStart,
  AiManagedLoginStatus,
} from "./account.types.ts";
import type { AiHostCapabilityId } from "./provider.types.ts";
import type { AiHttpRequestDescriptor } from "../transports/openai-compatible.ts";

export interface AiAccountRepositoryPort {
  list(): Promise<readonly AiAccountRecord[]>;
  put(record: AiAccountRecord): Promise<void>;
  delete(id: string): Promise<void>;
  /** 旧 Host 可暂时不实现；Core 会回退到第一个有效账户，但正式 Host 必须持久化。 */
  getActiveModel?(): Promise<AiActiveModelBinding | null>;
  setActiveModel?(binding: AiActiveModelBinding | null): Promise<void>;
}

export type AiSecretStorePort = CredentialStorePort;

export interface AiHttpJsonPort {
  requestJson(request: AiHttpRequestDescriptor): Promise<unknown>;
}

/**
 * 宿主管理认证端口。
 *
 * 当前首个实现是 Codex App Server，但 Core 只依赖这一能力接口：
 * 登录凭证生命周期完全归宿主/官方客户端所有，Config Core 只接收登录状态与可用模型。
 */
export interface AiManagedAuthPort {
  readonly kind: AiHostCapabilityId;
  status(): Promise<AiHostCapabilityStatus>;
  startLogin(): Promise<AiManagedLoginStart>;
  loginStatus(loginId: string): Promise<AiManagedLoginStatus>;
  cancelLogin(loginId: string): Promise<void>;
  probe(): Promise<AiAccountProbeResult>;
}

export interface AiAccountHostPorts {
  repository: AiAccountRepositoryPort;
  secrets: AiSecretStorePort;
  http: AiHttpJsonPort;
  managedAuth?: AiManagedAuthPort;
  createId(): string;
  now(): string;
}
