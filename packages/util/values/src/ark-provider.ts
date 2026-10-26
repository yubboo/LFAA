/** 火山方舟公开接入地址的共享事实源。 */
export const ARK_OPENAI_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
/** 当前在 LFAA 中整理的火山方舟 Agent/Coding Plan 官方目录版本。 */
export const ARK_PLAN_CATALOG_REVISION = "2026-10-26";

export const ARK_PLAN_PROVIDERS = Object.freeze({
  agent: Object.freeze({
    id: "ark-agent-plan",
    baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
    chatCompletionsUrl: "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions",
    imageGenerationsUrl: "https://ark.cn-beijing.volces.com/api/plan/v3/images/generations",
    videoGenerationTasksUrl: "https://ark.cn-beijing.volces.com/api/plan/v3/contents/generations/tasks",
    documentationUrl: "https://docs.volcengine.com/docs/ark/agent-plan-personal-other-tools?lang=en"
  }),
  coding: Object.freeze({
    id: "ark-coding-plan",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
    chatCompletionsUrl: "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
    documentationUrl: "https://docs.volcengine.com/docs/ark/coding-plan-personal-ai-other-tools?lang=en"
  })
});

export type ArkPlanProviderId = typeof ARK_PLAN_PROVIDERS[keyof typeof ARK_PLAN_PROVIDERS]["id"];

export function isArkPlanProviderId(providerId: string): providerId is ArkPlanProviderId {
  return providerId === ARK_PLAN_PROVIDERS.agent.id || providerId === ARK_PLAN_PROVIDERS.coding.id;
}
