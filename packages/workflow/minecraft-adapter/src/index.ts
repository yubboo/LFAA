/**
 * 功能：把 Minecraft Agent 能力接入通用工作流节点目录。
 * 作用：将通用节点执行委派给现有 Agent Loop、Tool Scope、审批和 Minecraft Owner。
 * 修改注意事项：此适配器可随 Minecraft 插件卸载；未注册时保存图保持不变但不能运行。
 */
import type { Context } from "@deepseek-ai/cordis";
import { cancelAiRun, getAiRun, startAiRun, subscribeAiRun } from "lfaa-agent-loop/src/runs.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { listAiBusinessTools } from "lfaa-tools/src/business-tools.js";
import type { UserRole } from "lfaa-identity-auth/src/service.js";
import { registerWorkflowNodeProvider, type WorkflowNodeExecutionContext } from "lfaa-workflow/src/registry.js";

interface MinecraftWorkflowServices { aiHost?: AiPluginHost }
interface MinecraftAgentData extends Record<string, unknown> { prompt: string; toolNames: string[] }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

function minecraftTools(userId: string, userRole: string) {
  const mode = getUserSettings(userId).permissions.mode;
  return listAiBusinessTools("minecraft", userRole as UserRole, null, mode)
    .filter((tool) => tool.id.startsWith("minecraft.") && tool.id !== "minecraft.load-prompt")
    .map((tool) => ({ id: tool.id, name: tool.name, description: tool.description.slice(0, 420) }));
}

function normalizeAgentData(value: Record<string, unknown>): MinecraftAgentData {
  const prompt = value.prompt;
  const toolNames = value.toolNames;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 6_000) throw new Error("Agent 节点目标不能为空，且不能超过 6000 个字符。");
  if (!Array.isArray(toolNames) || toolNames.length > 20 || toolNames.some((name) => typeof name !== "string" || name.length > 120)) throw new Error("Agent 节点最多选择 20 个有效工具。");
  return { prompt: prompt.trim(), toolNames: [...new Set(toolNames as string[])] };
}

function waitForAgent(userId: string, runId: string, signal: AbortSignal, onUpdate: () => void): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: () => void = () => {};
    const finish = (status: string) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      unsubscribe();
      resolve(status);
    };
    const onAbort = () => { cancelAiRun(userId, runId); finish("interrupted"); };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) { onAbort(); return; }
    try {
      const stop = subscribeAiRun(userId, runId, (event, data) => {
        if (event === "activity" || event === "session") onUpdate();
        if (event === "done") finish(typeof data.status === "string" ? data.status : "unknown");
      });
      unsubscribe = stop;
      if (settled) unsubscribe();
    } catch (error) {
      signal.removeEventListener("abort", onAbort);
      settled = true;
      reject(error);
    }
  });
}

async function executeAgentNode(context: WorkflowNodeExecutionContext) {
  const data = normalizeAgentData(context.node.data);
  const available = new Set(minecraftTools(context.userId, context.userRole).map((tool) => tool.name));
  if (data.toolNames.some((name) => !available.has(name))) throw new Error("此节点选择了当前账户或权限模式不可用的 Minecraft 工具。");
  const services = isRecord(context.runtimeServices) ? context.runtimeServices as MinecraftWorkflowServices : {};
  if (!services.aiHost) throw new Error("Agent Runtime 当前不可用。");
  const previousSessionId = context.state.get("minecraft.sessionId");
  const upstream = context.inputs.context;
  const upstreamText = typeof upstream === "string" ? upstream : upstream === undefined ? "" : JSON.stringify(upstream);
  const eulaAccepted = context.options.eulaAccepted === true;
  const systemPrompt = [
    "你正在执行用户保存的 Minecraft Agent 工作流中的一个节点。",
    "根据节点目标自行判断是否需要调用当前允许的 Minecraft 工具；所有操作继续遵守账户权限、工具校验和审批。",
    "不得执行当前节点目标之外的操作；不得声称工具没有返回的结果。",
    eulaAccepted ? "本次运行的用户已通过界面明确确认阅读并同意 Minecraft EULA；仍需在要求的工具参数中如实传递 eulaAccepted=true。" : "用户没有同意 Minecraft EULA；不得代替用户接受或传递同意状态。"
  ].join("\n");
  const run = startAiRun(context.userId, context.userRole as UserRole, {
    appId: "minecraft",
    sessionId: typeof previousSessionId === "string" ? previousSessionId : null,
    content: `工作流节点：${context.node.title}\n\n${upstreamText ? `上游数据：\n${upstreamText.slice(0, 4_000)}\n\n` : ""}用户目标：\n${data.prompt}`
  }, services.aiHost, { allowedToolNames: data.toolNames, canAskUser: true, systemPrompt });
  context.state.set("minecraft.sessionId", run.sessionId);
  context.reportReference({ kind: "ai-run", id: run.id });
  const updateProgress = () => {
    const snapshot = getAiRun(context.userId, run.id);
    if (!snapshot) return;
    const question = snapshot.message.activity.filter((activity) => activity.kind === "question" && activity.status === "waiting_input" && activity.questionId && activity.question && activity.options?.length).at(-1);
    const approval = snapshot.message.activity.filter((activity) => activity.kind === "tool" && activity.status === "approval_required" && activity.approvalId).at(-1);
    context.updateNodeStatus("running", { progress: {
      agentStatus: snapshot.status,
      pendingQuestion: question ? { questionId: question.questionId!, question: question.question!, options: question.options! } : null,
      pendingApproval: approval ? { approvalId: approval.approvalId!, title: approval.title, detail: approval.detail } : null
    } });
  };
  updateProgress();
  const resultStatus = await waitForAgent(context.userId, run.id, context.signal, updateProgress);
  if (resultStatus === "interrupted" || context.signal.aborted) throw new Error("工作流运行已取消。");
  const result = getAiRun(context.userId, run.id);
  if (resultStatus !== "complete") throw new Error(result?.message.content?.trim().slice(-500) || `Agent Run 状态：${resultStatus}`);
  return { outputs: { result: result?.message.content?.trim() ?? "" }, references: [{ kind: "ai-run", id: run.id }] };
}

const agentType = {
  type: "minecraft.agent",
  version: 1,
  name: "Agent",
  description: "使用当前 Minecraft App 工具理解并完成目标。",
  defaultData: { prompt: "", toolNames: [] },
  applicationIds: ["minecraft"] as const,
  inputPorts: [{ id: "context", valueType: "text" as const }],
  outputPorts: [{ id: "result", valueType: "text" as const }],
  normalizeData: normalizeAgentData,
  execute: executeAgentNode,
  listConfigurationOptions(userId: string, userRole: string) { return { tools: minecraftTools(userId, userRole) }; }
};

export function registerMinecraftWorkflowAdapter(ctx: Context): void {
  registerWorkflowNodeProvider(ctx, {
    id: "lfaa.workflow.minecraft",
    applicationIds: ["minecraft"],
    nodes: [agentType],
    validateRun({ userId, userRole, definition, options }) {
      const tools = new Set(minecraftTools(userId, userRole).map((tool) => tool.name));
      for (const node of definition.nodes) {
        if (node.type !== agentType.type) continue;
        const data = normalizeAgentData(node.data);
        if (data.toolNames.some((name) => !tools.has(name))) throw new Error(`节点“${node.title}”包含当前账户或权限模式不可用的工具。`);
        const needsEula = data.toolNames.some((name) => name === "minecraft_provision_server" || name === "minecraft_deploy_server");
        if (needsEula && options.eulaAccepted !== true) throw new Error("此工作流包含开服工具。运行前请明确确认已阅读并同意 Minecraft EULA。");
      }
    }
  });
}

export const name = "lfaaWorkflowMinecraftAdapter";
export const inject = ["lfaaWorkflow", "lfaaAgentLoop"];
export function apply(ctx: Context): void { registerMinecraftWorkflowAdapter(ctx); }
