/** 功能：提供 AI Provider 连接验证与账户/模型操作 API；凭据状态及权限仍由 Settings/认证 Owner 管理。 */
import type { AiAccount, AiModelTestResult, AiProvider, AiProviderProbe, ClaudeAgentCredentialStatus } from "./ai-account-types.js";
import { request } from "./http-client.js";

export function probeAiProvider(input: { providerId: string; secret: string; options: Record<string, string>; modelId?: string }): Promise<{ result: AiProviderProbe }> {
  return request<{ result: AiProviderProbe }>("/settings/ai/probe", { method: "POST", body: JSON.stringify(input) });
}

export function testAiProviderModel(input: { providerId: string; secret: string; options: Record<string, string>; modelId: string; reasoningMode: string }): Promise<{ result: AiModelTestResult }> {
  return request<{ result: AiModelTestResult }>("/settings/ai/test-model", { method: "POST", body: JSON.stringify(input) });
}

export function saveAiAccount(input: { providerId: string; secret: string; options: Record<string, string>; displayName: string; modelId: string; reasoningMode: string; verificationToken?: string }): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>("/settings/ai/accounts", { method: "POST", body: JSON.stringify(input) });
}

export function refreshAiAccountModelCatalog(accountId: string): Promise<{ result: AiProviderProbe }> {
  return request<{ result: AiProviderProbe }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/refresh-models`, { method: "POST" });
}

export function testSavedAiAccountModel(accountId: string): Promise<{ result: AiModelTestResult }> {
  return request<{ result: AiModelTestResult }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/test-model`, { method: "POST" });
}

export function testAiAccountCredential(accountId: string, secret: string): Promise<{ result: AiModelTestResult }> {
  return request<{ result: AiModelTestResult }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/test-credential`, { method: "POST", body: JSON.stringify({ secret }) });
}

export function updateAiAccountCredential(accountId: string, secret: string): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/credential`, { method: "PUT", body: JSON.stringify({ secret }) });
}

export function updateAiAccountModel(accountId: string, modelId: string): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/model`, { method: "PUT", body: JSON.stringify({ modelId }) });
}

export function updateAiAccountReasoningMode(accountId: string, reasoningMode: string): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/reasoning`, { method: "PUT", body: JSON.stringify({ reasoningMode }) });
}

export function activateAiAccount(accountId: string): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/activate`, { method: "POST" });
}

export function selectAiAccountModel(accountId: string, modelId: string): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/select-model`, { method: "POST", body: JSON.stringify({ modelId }) });
}

export function deleteAiAccount(accountId: string): Promise<void> {
  return request<void>(`/settings/ai/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
}




export function deleteClaudeAgentCredential(): Promise<void> {
  return request<void>("/settings/ai/external-agents/anthropic-credential", { method: "DELETE" });
}


export function saveClaudeAgentCredential(secret: string): Promise<{ credential: ClaudeAgentCredentialStatus }> {
  return request<{ credential: ClaudeAgentCredentialStatus }>("/settings/ai/external-agents/anthropic-credential", { method: "PUT", body: JSON.stringify({ secret }) });
}


export function loadClaudeAgentCredentialStatus(): Promise<{ credential: ClaudeAgentCredentialStatus }> {
  return request<{ credential: ClaudeAgentCredentialStatus }>("/settings/ai/external-agents/anthropic-credential");
}


export function loadAiAccounts(): Promise<{ accounts: AiAccount[] }> {
  return request<{ accounts: AiAccount[] }>("/settings/ai/accounts");
}


export function loadAiProviders(): Promise<{ providers: AiProvider[] }> {
  return request<{ providers: AiProvider[] }>("/settings/ai/providers");
}
