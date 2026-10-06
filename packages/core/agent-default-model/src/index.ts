/**
 * 功能：为 Agent 入口装配本轮实际模型账户。
 * 作用：从设置中心读取非秘密模型元数据，再按账户归属通过凭据引用读取密钥，不缓存或复制秘密。
 * 关联文件：packages/credentials/credentials/src/index.ts、packages/settings/settings/src/service.ts、packages/core/agent-loop/src/runs.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { credentialReference } from "lfaa-credentials/src/index.js";
import type { CredentialRegistry } from "lfaa-credentials/src/index.js";
import { resolveActiveAiModelDetails, type ActiveAiModelConfiguration } from "lfaa-settings/src/service.js";

export const name = "lfaaAgentDefaultModel";
export const inject = ["lfaaCredentials", "lfaaSettings"];

export interface AgentDefaultModelResolver {
  resolve(userId: string, accountId?: string): ActiveAiModelConfiguration | null;
}

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaAgentDefaultModel: AgentDefaultModelResolver }
}

/** 仅用于插件装配测试和当前 Cordis 插件；账户缺失时不切换到其他 Provider。 */
export function createAgentDefaultModelResolver(credentials: CredentialRegistry, context: Context): AgentDefaultModelResolver {
  const consumer = credentials.createConsumer(context);
  return Object.freeze({
    resolve(userId: string, accountId?: string) {
      const details = resolveActiveAiModelDetails(userId, accountId);
      if (!details) return null;
      const secret = consumer.resolve(userId, credentialReference("lfaa-settings", details.accountId));
      return secret === null ? null : { ...details, secret };
    }
  });
}

export function apply(ctx: Context): void {
  ctx.provide(name, createAgentDefaultModelResolver(ctx.lfaaCredentials, ctx));
}
