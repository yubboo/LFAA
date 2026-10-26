/**
 * 功能：把账户与 App 隔离的 Workflow Owner 暴露为模型可选择的工具。
 * 作用：Agent 能发现节点、保存经 Owner 校验的图、启动并跟踪真实运行。
 * 边界：本包不执行节点、不创建权限或存储；Minecraft 执行仍由 Workflow Adapter、Agent Loop 与领域 Owner 负责。
 */
import type { Context } from "@deepseek-ai/cordis";
import { createHash } from "node:crypto";
import { createAiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { AiBusinessTool, AiBusinessToolContext } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import {
  cancelWorkflowRun,
  createWorkflow,
  getWorkflow,
  getWorkflowRun,
  listWorkflowEngineTypes,
  listWorkflowNodeTypes,
  listWorkflowSummaries,
  startWorkflowRun,
  updateWorkflow,
  type WorkflowDefinition,
  type WorkflowRun,
  type WorkflowRunNode
} from "lfaa-workflow/src/service.js";

const WORKFLOW_WAIT_LIMIT_MS = 10 * 60 * 1000;
const WORKFLOW_POLL_INTERVAL_MS = 1_000;
const DEPLOY_TOOLS = new Set(["minecraft_provision_server", "minecraft_deploy_server"]);

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("参数必须是 JSON 对象。");
  return value as Record<string, unknown>;
}

function stringField(value: unknown, name: string, maxLength: number, required = true): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) throw new Error(`${name} 必须是 1-${maxLength} 字符的文本。`);
  return value.trim();
}

function emptyArguments(value: unknown): Record<string, never> {
  const parsed = record(value);
  if (Object.keys(parsed).length) throw new Error("此工具不接受参数。");
  return {};
}

function workflowSaveArguments(value: unknown): Record<string, unknown> {
  const parsed = record(value);
  const title = stringField(parsed.title, "工作流名称", 80)!;
  const engineId = stringField(parsed.engineId, "工作流引擎 ID", 120, false);
  const workflowId = stringField(parsed.workflowId, "工作流 ID", 120, false);
  const expectedUpdatedAt = stringField(parsed.expectedUpdatedAt, "当前工作流更新时间", 80, false);
  if (Boolean(workflowId) !== Boolean(expectedUpdatedAt)) throw new Error("更新工作流必须同时提供 workflowId 和通过目录/详情读取的 expectedUpdatedAt；新建工作流不得提供这两个字段。");
  if (!Array.isArray(parsed.nodes) || parsed.nodes.length > 64) throw new Error("工作流 nodes 必须是最多 64 项的数组。");
  if (!Array.isArray(parsed.edges) || parsed.edges.length > 128) throw new Error("工作流 edges 必须是最多 128 项的数组。");
  const allowed = new Set(["title", "engineId", "workflowId", "expectedUpdatedAt", "nodes", "edges"]);
  if (Object.keys(parsed).some(key => !allowed.has(key))) throw new Error("工作流保存参数包含不支持的字段。");
  return { title, ...(engineId ? { engineId } : {}), ...(workflowId ? { workflowId, expectedUpdatedAt } : {}), nodes: parsed.nodes, edges: parsed.edges };
}

function hasMinecraftEulaNode(definition: WorkflowDefinition): boolean {
  return definition.nodes.some(node => node.type === "minecraft.agent"
    && Array.isArray(node.data.toolNames)
    && node.data.toolNames.some(name => typeof name === "string" && DEPLOY_TOOLS.has(name)));
}

function runApprovalSummary(userId: string, appId: AiBusinessToolContext["applicationId"], workflowId: string, updatedAt: string): { title: string; scopeKey: string; includesMinecraftEula: boolean } {
  const workflow = getWorkflow(userId, appId, workflowId);
  return {
    title: workflow?.title ?? "工作流",
    scopeKey: `workflow.run:${workflowId}:${updatedAt}`,
    includesMinecraftEula: workflow?.updatedAt === updatedAt && hasMinecraftEulaNode(workflow)
  };
}

function progressView(node: WorkflowRunNode): Record<string, unknown> | undefined {
  if (!node.progress) return undefined;
  const result: Record<string, unknown> = {};
  if (typeof node.progress.agentStatus === "string") result.agentStatus = node.progress.agentStatus;
  const question = node.progress.pendingQuestion;
  if (question && typeof question === "object" && !Array.isArray(question)) {
    const item = question as Record<string, unknown>;
    if (typeof item.question === "string") result.pendingQuestion = {
      questionId: typeof item.questionId === "string" ? item.questionId : undefined,
      question: item.question.slice(0, 500),
      options: Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === "string").slice(0, 8).map(option => option.slice(0, 160)) : []
    };
  }
  const approval = node.progress.pendingApproval;
  if (approval && typeof approval === "object" && !Array.isArray(approval)) {
    const item = approval as Record<string, unknown>;
    if (typeof item.approvalId === "string") result.pendingApproval = {
      approvalId: item.approvalId,
      title: typeof item.title === "string" ? item.title.slice(0, 160) : "等待审批",
      detail: typeof item.detail === "string" ? item.detail.slice(0, 500) : ""
    };
  }
  return Object.keys(result).length ? result : undefined;
}

function runNodeView(node: WorkflowRunNode, includeOutput: boolean): Record<string, unknown> {
  return {
    nodeId: node.nodeId,
    type: node.type,
    title: node.title,
    status: node.status,
    ...(includeOutput && node.output ? { output: node.output.slice(0, 500), ...(node.outputTruncated || node.output.length > 500 ? { outputTruncated: true } : {}) } : {}),
    ...(node.error ? { error: node.error.slice(0, 500) } : {}),
    ...(node.references?.length ? { references: node.references.slice(0, 2) } : {}),
    ...(progressView(node) ? { progress: progressView(node) } : {})
  };
}

function workflowRunView(run: WorkflowRun, includeOutput: boolean): Record<string, unknown> {
  return {
    runId: run.id,
    appId: run.appId,
    workflowId: run.workflowId,
    status: run.status,
    currentNodeId: run.currentNodeId,
    nodes: run.nodes.map(node => runNodeView(node, includeOutput)),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt
  };
}

function isTerminal(status: WorkflowRun["status"]): boolean {
  return status === "succeeded" || status === "failed" || status === "interrupted";
}

function waitForWorkflowRun(context: AiBusinessToolContext, runId: string): Promise<{ run: WorkflowRun; timedOut: boolean }> {
  const startedAt = Date.now();
  let previousState = "";
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: unknown, result?: { run: WorkflowRun; timedOut: boolean }) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      context.signal.removeEventListener("abort", onAbort);
      if (error !== undefined) reject(error);
      else resolve(result!);
    };
    const onAbort = () => finish(new DOMException("用户已停止 Agent 运行。", "AbortError"));
    const poll = () => {
      if (context.signal.aborted) { onAbort(); return; }
      try {
        const run = getWorkflowRun(context.userId, context.applicationId, runId);
        if (!run) throw new Error("工作流运行记录已不可用；没有伪造完成状态。");
        const state = JSON.stringify([run.status, run.currentNodeId, ...run.nodes.map(node => [node.nodeId, node.status, node.error ?? "", node.progress ?? null])]);
        if (state !== previousState) {
          previousState = state;
          const active = run.nodes.find(node => node.nodeId === run.currentNodeId);
          context.onProgress(active ? `工作流${run.status}；当前节点“${active.title}”${active.status === "running" ? "正在运行" : `状态：${active.status}`}。` : `工作流状态：${run.status}。`);
        }
        if (isTerminal(run.status)) { finish(undefined, { run, timedOut: false }); return; }
        if (Date.now() - startedAt >= WORKFLOW_WAIT_LIMIT_MS) { finish(undefined, { run, timedOut: true }); return; }
        timer = setTimeout(poll, WORKFLOW_POLL_INTERVAL_MS);
      } catch (error) { finish(error); }
    };
    context.signal.addEventListener("abort", onAbort, { once: true });
    if (context.signal.aborted) onAbort();
    else poll();
  });
}

function makeTools(aiHost: ReturnType<typeof createAiPluginHost>): AiBusinessTool[] {
  const appIds = [...APPLICATION_IDS];
  return [
    {
      id: "workflow.catalog", name: "lfaa_workflow_catalog", coreManaged: true, applicationIds: appIds,
      description: "查询当前 App 已登记的工作流节点和执行引擎。先调用此工具确认节点类型、版本、输入输出端口及配置选项；未登记的能力不能加入可运行图。",
      schema: { type: "object", properties: {}, additionalProperties: false },
      risk: () => "read",
      approval: () => ({ scopeKey: "workflow.catalog", scopeSummary: "当前 App 工作流目录", summary: "查询已启用的工作流节点和引擎" }),
      parse: emptyArguments,
      async execute(_parameters, context) {
        const [nodes, engines] = await Promise.all([
          listWorkflowNodeTypes(context.applicationId, context.userId, context.userRole),
          Promise.resolve(listWorkflowEngineTypes(context.applicationId))
        ]);
        return { appId: context.applicationId, nodes, engines };
      }
    },
    {
      id: "workflow.list", name: "lfaa_workflow_list", coreManaged: true, applicationIds: appIds,
      description: "列出当前账户在当前 App 保存的工作流摘要；如需查看节点定义，再调用 lfaa_workflow_get。",
      schema: { type: "object", properties: {}, additionalProperties: false },
      risk: () => "read",
      approval: () => ({ scopeKey: "workflow.list", scopeSummary: "当前 App 的工作流列表", summary: "读取当前账户保存的工作流" }),
      parse: emptyArguments,
      async execute(_parameters, context) { return { workflows: listWorkflowSummaries(context.userId, context.applicationId) }; }
    },
    {
      id: "workflow.get", name: "lfaa_workflow_get", coreManaged: true, applicationIds: appIds,
      description: "读取当前账户和当前 App 的完整工作流定义。保存更新前必须读取 expectedUpdatedAt；运行前也必须用最新版本号。",
      schema: { type: "object", properties: { workflowId: { type: "string", minLength: 1, maxLength: 120 } }, required: ["workflowId"], additionalProperties: false },
      risk: () => "read",
      approval: parameters => ({ scopeKey: `workflow.get:${parameters.workflowId}`, scopeSummary: "当前 App 工作流详情", summary: "读取指定工作流定义" }),
      parse(value) { const parsed = record(value); return { workflowId: stringField(parsed.workflowId, "工作流 ID", 120)! }; },
      async execute(parameters, context) {
        const workflow = getWorkflow(context.userId, context.applicationId, String(parameters.workflowId));
        if (!workflow) throw new Error("找不到当前账户和 App 的工作流。");
        return { workflow };
      }
    },
    {
      id: "workflow.save", name: "lfaa_workflow_save", coreManaged: true, applicationIds: appIds,
      description: "创建或更新当前 App 的工作流定义。节点、版本、端口和有向无环图由 Workflow Owner 严格校验。更新必须带上最近读取的 workflowId 与 expectedUpdatedAt；保存与运行是两个独立操作。",
      schema: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 80 },
          engineId: { type: "string", minLength: 2, maxLength: 120 },
          workflowId: { type: "string", minLength: 1, maxLength: 120 },
          expectedUpdatedAt: { type: "string", minLength: 1, maxLength: 80 },
          nodes: { type: "array", maxItems: 64, items: { type: "object", additionalProperties: true } },
          edges: { type: "array", maxItems: 128, items: { type: "object", additionalProperties: true } }
        },
        required: ["title", "nodes", "edges"],
        additionalProperties: false
      },
      risk: () => "write",
      approval(parameters, context) {
        const contentHash = createHash("sha256").update(JSON.stringify([context.applicationId, parameters])).digest("hex");
        const action = typeof parameters.workflowId === "string" ? "更新" : "新建";
        return { scopeKey: `workflow.save:${contentHash}`, scopeSummary: `${action}工作流 · ${String(parameters.title).slice(0, 80)}`, summary: `${action}并保存当前 App 的工作流定义` };
      },
      parse: workflowSaveArguments,
      async execute(parameters, context) {
        const { workflowId, expectedUpdatedAt, ...definition } = parameters as { workflowId?: string; expectedUpdatedAt?: string } & Record<string, unknown>;
        let workflow: WorkflowDefinition;
        if (workflowId) {
          const current = getWorkflow(context.userId, context.applicationId, workflowId);
          if (!current) throw new Error("找不到当前账户和 App 的待更新工作流。");
          if (current.updatedAt !== expectedUpdatedAt) throw new Error("工作流已发生变化；本次未覆盖旧定义，请重新读取后再保存。");
          const updated = updateWorkflow(context.userId, context.applicationId, workflowId, definition);
          if (!updated) throw new Error("工作流已被移除；本次未保存。");
          workflow = updated;
        } else {
          workflow = createWorkflow(context.userId, context.applicationId, definition);
        }
        const registered = new Set((await listWorkflowNodeTypes(context.applicationId, context.userId, context.userRole)).map(node => `${node.type}@${node.version}`));
        const unavailableNodes = workflow.nodes.filter(node => !registered.has(`${node.type}@${node.version}`)).map(node => ({ nodeId: node.id, type: node.type, version: node.version }));
        return { workflow, runnable: unavailableNodes.length === 0 && listWorkflowEngineTypes(context.applicationId).some(engine => engine.id === workflow.engineId), ...(unavailableNodes.length ? { unavailableNodes } : {}) };
      }
    },
    {
      id: "workflow.run", name: "lfaa_workflow_run", coreManaged: true, applicationIds: appIds, requiresQuestionChannel: true,
      description: "运行当前账户和当前 App 的已保存工作流，并等待最多 10 分钟收集真实终态。必须先读取定义并确认目标；传入精确 expectedUpdatedAt 防止运行过期版本。工作流中的 Agent 澄清会回到当前对话；若 Minecraft 节点包含开服/部署工具，同一权限摘要会明确列出接受官方 EULA 与所选核心许可。",
      schema: { type: "object", properties: { workflowId: { type: "string", minLength: 1, maxLength: 120 }, expectedUpdatedAt: { type: "string", minLength: 1, maxLength: 80 } }, required: ["workflowId", "expectedUpdatedAt"], additionalProperties: false },
      risk: () => "dangerous",
      approval(parameters, context) {
        const scope = runApprovalSummary(context.userId, context.applicationId, String(parameters.workflowId), String(parameters.expectedUpdatedAt));
        const licenseAction = scope.includesMinecraftEula ? "；并明确同意 Minecraft 官方 EULA（https://www.minecraft.net/eula）及所选服务端核心许可" : "";
        return {
          scopeKey: scope.scopeKey,
          scopeSummary: `${scope.includesMinecraftEula ? "运行并同意 Minecraft EULA · " : "运行工作流 · "}${scope.title}`,
          summary: `启动当前 App 保存的工作流“${scope.title}”${licenseAction}；其节点继续使用原领域服务和权限规则`
        };
      },
      parse(value) { const parsed = record(value); return { workflowId: stringField(parsed.workflowId, "工作流 ID", 120)!, expectedUpdatedAt: stringField(parsed.expectedUpdatedAt, "工作流更新时间", 80)! }; },
      async execute(parameters, context) {
        const workflowId = String(parameters.workflowId);
        const current = getWorkflow(context.userId, context.applicationId, workflowId);
        if (!current) throw new Error("找不到当前账户和 App 的工作流。");
        if (current.updatedAt !== parameters.expectedUpdatedAt) throw new Error("工作流版本已变化；本次未启动，请重新读取并确认最新定义。");
        const eulaAccepted = hasMinecraftEulaNode(current);
        context.signal.throwIfAborted();
        const latest = getWorkflow(context.userId, context.applicationId, workflowId);
        if (!latest || latest.updatedAt !== parameters.expectedUpdatedAt) throw new Error("权限检查期间工作流版本已变化；本次未启动，请重新读取并确认最新定义。");
        const run = startWorkflowRun(context.userId, context.userRole, context.applicationId, workflowId, eulaAccepted ? { eulaAccepted: true } : {}, {
          aiHost,
          ...(context.askUser ? { askUser: async (input: { questionId: string; question: string; options: string[] }) => context.askUser!(input.question, input.options) } : {})
        });
        const abortWorkflow = () => { cancelWorkflowRun(context.userId, context.applicationId, run.id); };
        context.signal.addEventListener("abort", abortWorkflow, { once: true });
        if (context.signal.aborted) abortWorkflow();
        try {
          const result = await waitForWorkflowRun(context, run.id);
          return { ...workflowRunView(result.run, true), ...(result.timedOut ? { waitLimitReached: true, detail: "工作流仍在运行；未报告为完成，可用 lfaa_workflow_get_run 继续查询。" } : {}) };
        } finally {
          context.signal.removeEventListener("abort", abortWorkflow);
        }
      }
    },
    {
      id: "workflow.get-run", name: "lfaa_workflow_get_run", coreManaged: true, applicationIds: appIds,
      description: "查询当前账户和当前 App 的工作流运行状态。可选 nodeId 查看一个节点的有界输出和等待中的问题/审批摘要。",
      schema: { type: "object", properties: { runId: { type: "string", minLength: 1, maxLength: 120 }, nodeId: { type: "string", minLength: 1, maxLength: 120 } }, required: ["runId"], additionalProperties: false },
      risk: () => "read",
      approval: parameters => ({ scopeKey: `workflow.get-run:${parameters.runId}`, scopeSummary: "工作流运行状态", summary: "查询工作流运行状态" }),
      parse(value) { const parsed = record(value); return { runId: stringField(parsed.runId, "运行 ID", 120)!, ...(parsed.nodeId === undefined ? {} : { nodeId: stringField(parsed.nodeId, "节点 ID", 120)! }) }; },
      async execute(parameters, context) {
        const run = getWorkflowRun(context.userId, context.applicationId, String(parameters.runId));
        if (!run) throw new Error("找不到当前账户和 App 的工作流运行记录。");
        if (parameters.nodeId && !run.nodes.some(node => node.nodeId === parameters.nodeId)) throw new Error("指定节点不属于此工作流运行。");
        return {
          ...workflowRunView(run, false),
          ...(parameters.nodeId ? { selectedNode: runNodeView(run.nodes.find(node => node.nodeId === parameters.nodeId)!, true) } : {})
        };
      }
    },
    {
      id: "workflow.cancel-run", name: "lfaa_workflow_cancel_run", coreManaged: true, applicationIds: appIds,
      description: "请求取消当前账户和当前 App 的活动工作流。已派发节点中的主机操作可能继续运行；取消不回滚副作用，结果不明时必须如实报告。",
      schema: { type: "object", properties: { runId: { type: "string", minLength: 1, maxLength: 120 } }, required: ["runId"], additionalProperties: false },
      risk: () => "write",
      approval(parameters) { return { scopeKey: `workflow.cancel:${parameters.runId}`, scopeSummary: "取消工作流运行", summary: "请求停止该工作流后续节点" }; },
      parse(value) { const parsed = record(value); return { runId: stringField(parsed.runId, "运行 ID", 120)! }; },
      async execute(parameters, context) {
        const run = cancelWorkflowRun(context.userId, context.applicationId, String(parameters.runId));
        if (!run) throw new Error("找不到当前账户和 App 的工作流运行记录。");
        return { ...workflowRunView(run, false), cancellationRequested: !isTerminal(run.status), sideEffectsReverted: false };
      }
    }
  ];
}

export const name = "lfaaToolWorkflow";
export const inject = ["lfaaTools", "lfaaWorkflow", "lfaaAgentLoop", "aiExtensions", "aiRuntimeHooks", "skills", "lfaaPluginRuntime"];

export function apply(ctx: Context): void {
  const aiHost = createAiPluginHost(ctx);
  for (const tool of makeTools(aiHost)) ctx.lfaaTools.registerTool(ctx, tool);
  ctx.effect(() => () => { void aiHost.close(); });
}
