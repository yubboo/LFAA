/**
 * 文件：host-ports.ts
 * 作用：定义 AI Account Core 依赖的宿主能力端口。
 * 负责：账户元数据仓库、Secret Store、HTTP JSON 请求、ID/时间能力契约。
 * 不负责：任何具体 Windows/Web/SQLite 实现。
 * 状态归属：接口契约，无运行时状态。
 * 对外接口：AiAccountHostPorts 及子端口。
 * 关联文件：account-service.ts、account.types.ts。
 * 修改注意事项：Host Port 只能表达能力，不得泄漏 Vite/Electron/Node 专有类型。
 */
import type { AiAccountRecord, AiSecretPersistence } from "./account.types.ts";
import type { AiHttpRequestDescriptor } from "../transports/openai-compatible.ts";

export interface AiAccountRepositoryPort {
  list(): Promise<readonly AiAccountRecord[]>;
  put(record: AiAccountRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface AiSecretStorePort {
  readonly persistence: AiSecretPersistence;
  put(credentialRef: string, secret: string): Promise<void>;
  get(credentialRef: string): Promise<string | null>;
  delete(credentialRef: string): Promise<void>;
}

export interface AiHttpJsonPort {
  requestJson(request: AiHttpRequestDescriptor): Promise<unknown>;
}

export interface AiAccountHostPorts {
  repository: AiAccountRepositoryPort;
  secrets: AiSecretStorePort;
  http: AiHttpJsonPort;
  createId(): string;
  now(): string;
}
