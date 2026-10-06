/** 功能：Minecraft App 的共享工作流画布适配器。作用：提供 Minecraft 节点编辑、EULA 和真实运行状态。 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Empty, Input, Select, Space, Spin, Tag, Typography } from "antd";
import { WorkflowGraphEditor, type WorkflowNodeEditors } from "lfaa-client-ui-workflow/src/index.js";
import {
  answerAiRunQuestion,
  cancelWorkflowRun,
  createWorkflow,
  decideAiApproval,
  deleteWorkflow,
  getErrorMessage,
  loadWorkflowEngineTypes,
  loadWorkflowNodeTypes,
  loadWorkflowRuns,
  loadWorkflows,
  saveWorkflow,
  startWorkflowRun,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowNodeType,
  type WorkflowRun,
  type WorkflowRunNode
} from "lfaa-client-connection/src/api.js";
import { MinecraftAgentWorkflowNodeEditor } from "./MinecraftAgentWorkflowNodeEditor.js";
import "./MinecraftWorkflowCanvas.css";

interface MinecraftWorkflowCanvasProps { userId: string }
interface WorkflowDraft { id: string | null; title: string; engineId: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] }
const terminalStatuses = new Set(["succeeded", "failed", "interrupted"]);
const workflowStatusLabel: Record<WorkflowRun["status"], string> = { queued: "排队中", running: "运行中", succeeded: "已完成", failed: "失败", interrupted: "已中断" };
const nodeStatusLabel: Record<WorkflowRunNode["status"], string> = { waiting: "等待中", running: "运行中", succeeded: "已完成", failed: "失败", interrupted: "已中断" };

function statusColor(status: string): string {
  return status === "succeeded" ? "green" : status === "failed" ? "red" : status === "interrupted" ? "orange" : status === "running" ? "blue" : "default";
}
function nextNodePosition(nodes: WorkflowNode[]): { x: number; y: number } {
  const offsets: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  for (let ring = 1; ring <= nodes.length + 1; ring += 1) offsets.push({ x: ring, y: 0 }, { x: 0, y: ring }, { x: -ring, y: 0 }, { x: 0, y: -ring }, { x: ring, y: ring }, { x: -ring, y: ring }, { x: -ring, y: -ring }, { x: ring, y: -ring });
  for (const offset of offsets) {
    const position = { x: 80 + offset.x * 400, y: 80 + offset.y * 300 };
    if (!nodes.some((node) => Math.abs(node.x - position.x) < 360 && Math.abs(node.y - position.y) < 280)) return position;
  }
  return { x: 80, y: 80 + nodes.length * 300 };
}
function readProgressRecord(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function readPendingQuestion(node: WorkflowRunNode) {
  const question = readProgressRecord(node.progress).pendingQuestion;
  return typeof question === "object" && question !== null ? question as { questionId: string; question: string; options: string[] } : null;
}
function readPendingApproval(node: WorkflowRunNode) {
  const approval = readProgressRecord(node.progress).pendingApproval;
  return typeof approval === "object" && approval !== null ? approval as { approvalId: string; title: string; detail: string } : null;
}
function agentRunId(node: WorkflowRunNode): string | null { return node.references?.find((reference) => reference.kind === "ai-run")?.id ?? null; }
function needsMinecraftEula(nodes: WorkflowNode[]): boolean {
  return nodes.some((node) => node.type === "minecraft.agent" && Array.isArray(node.data.toolNames)
    && node.data.toolNames.some((name) => name === "minecraft_provision_server" || name === "minecraft_deploy_server"));
}

export function MinecraftWorkflowCanvas({ userId }: MinecraftWorkflowCanvasProps) {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [nodeTypes, setNodeTypes] = useState<WorkflowNodeType[]>([]);
  const [engineTypes, setEngineTypes] = useState<Array<{ id: string; version: number; name: string }>>([]);
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [nodeToAdd, setNodeToAdd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [answeringQuestion, setAnsweringQuestion] = useState<string | null>(null);
  const [decidingApproval, setDecidingApproval] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nodeEditors = useMemo<WorkflowNodeEditors>(() => ({ "minecraft.agent": MinecraftAgentWorkflowNodeEditor }), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDraft(null);
    setRuns([]);
    setError(null);
    Promise.all([loadWorkflows("minecraft"), loadWorkflowNodeTypes("minecraft"), loadWorkflowEngineTypes("minecraft")]).then(([workflowResult, nodeResult, engineResult]) => {
      if (!alive) return;
      setWorkflows(workflowResult.workflows);
      setNodeTypes(nodeResult.nodes);
      setEngineTypes(engineResult.engines);
      setNodeToAdd(nodeResult.nodes.find((node) => node.type === "minecraft.agent")?.type ?? nodeResult.nodes[0]?.type ?? "");
      const first = workflowResult.workflows[0];
      setDraft(first ? { id: first.id, title: first.title, engineId: first.engineId, nodes: first.nodes, edges: first.edges } : null);
      setLoading(false);
    }).catch((reason: unknown) => {
      if (!alive) return;
      setError(getErrorMessage(reason));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [userId]);

  const selectedId = draft?.id ?? "";
  const activeRun = useMemo(() => runs.some((run) => !terminalStatuses.has(run.status)), [runs]);
  useEffect(() => {
    if (!selectedId) { setRuns([]); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await loadWorkflowRuns("minecraft", selectedId);
        if (!alive) return;
        setRuns((current) => JSON.stringify(current) === JSON.stringify(result.runs) ? current : result.runs);
        if (!document.hidden && result.runs.some((run) => !terminalStatuses.has(run.status))) timer = setTimeout(() => void refresh(), 2500);
      } catch (reason) {
        if (alive) setError(getErrorMessage(reason));
      } finally { inFlight = false; }
    };
    const onVisibilityChange = () => {
      if (document.hidden) { if (timer) clearTimeout(timer); timer = null; }
      else { if (timer) clearTimeout(timer); timer = null; void refresh(); }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void refresh();
    return () => { alive = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [selectedId, activeRun]);

  const markChanged = useCallback((change: (current: WorkflowDraft) => WorkflowDraft) => {
    setDraft((current) => current ? change(current) : current);
    setDirty(true);
    setError(null);
  }, []);
  const onGraphChange = useCallback((nodes: WorkflowNode[], edges: WorkflowEdge[]) => markChanged((current) => ({ ...current, nodes, edges })), [markChanged]);
  const addNode = useCallback(() => {
    if (!draft) return;
    const type = nodeTypes.find((item) => item.type === nodeToAdd);
    if (!type) { setError("所选节点插件当前不可用。"); return; }
    const position = nextNodePosition(draft.nodes);
    markChanged((current) => ({ ...current, nodes: [...current.nodes, { id: crypto.randomUUID(), type: type.type, version: type.version, title: type.name, data: structuredClone(type.defaultData), ...position }] }));
  }, [draft, markChanged, nodeToAdd, nodeTypes]);
  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const input = { title: draft.title, engineId: draft.engineId, nodes: draft.nodes, edges: draft.edges };
      const result = draft.id ? await saveWorkflow("minecraft", draft.id, input) : await createWorkflow("minecraft", input);
      setDraft({ id: result.workflow.id, title: result.workflow.title, engineId: result.workflow.engineId, nodes: result.workflow.nodes, edges: result.workflow.edges });
      setWorkflows((current) => [result.workflow, ...current.filter((item) => item.id !== result.workflow.id)]);
      setDirty(false);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setSaving(false); }
  }, [draft]);
  const selectWorkflow = useCallback((id: string) => {
    if (dirty && !window.confirm("当前画布有未保存修改。切换工作流会放弃这些修改，是否继续？")) return;
    if (id === "__new") {
      setDraft({ id: null, title: "新工作流", engineId: engineTypes[0]?.id ?? "", nodes: [], edges: [] });
      setRuns([]);
    } else {
      const workflow = workflows.find((item) => item.id === id);
      if (workflow) { setDraft({ id: workflow.id, title: workflow.title, engineId: workflow.engineId, nodes: workflow.nodes, edges: workflow.edges }); setRuns([]); }
    }
    setDirty(false);
    setError(null);
    setEulaAccepted(false);
  }, [dirty, engineTypes, workflows]);
  const handleDelete = useCallback(async () => {
    if (!draft?.id || !window.confirm(`删除工作流“${draft.title}”？此工作流的运行历史也会一并删除。`)) return;
    try {
      await deleteWorkflow("minecraft", draft.id);
      const remaining = workflows.filter((item) => item.id !== draft.id);
      setWorkflows(remaining);
      const first = remaining[0];
      setDraft(first ? { id: first.id, title: first.title, engineId: first.engineId, nodes: first.nodes, edges: first.edges } : null);
      setRuns([]); setDirty(false); setError(null);
    } catch (reason) { setError(getErrorMessage(reason)); }
  }, [draft, workflows]);
  const needsEula = Boolean(draft && needsMinecraftEula(draft.nodes));
  const selectedEngineAvailable = Boolean(draft && engineTypes.some((engine) => engine.id === draft.engineId));
  const allNodeTypesAvailable = Boolean(draft && draft.nodes.every((node) => nodeTypes.some((type) => type.type === node.type && type.version === node.version)));
  const handleRun = useCallback(async () => {
    if (!draft?.id || dirty) return;
    setRunning(true); setError(null);
    try {
      const result = await startWorkflowRun("minecraft", draft.id, { eulaAccepted });
      setRuns((current) => [result.run, ...current.filter((run) => run.id !== result.run.id)]);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setRunning(false); }
  }, [draft, dirty, eulaAccepted]);
  const handleCancel = useCallback(async (runId: string) => {
    try { const result = await cancelWorkflowRun("minecraft", runId); setRuns((current) => current.map((run) => run.id === runId ? result.run : run)); }
    catch (reason) { setError(getErrorMessage(reason)); }
  }, []);
  const handleQuestionAnswer = useCallback(async (runId: string, node: WorkflowRunNode, answer: string, skipped = false) => {
    const runIdRef = agentRunId(node);
    const question = readPendingQuestion(node);
    if (!runIdRef || !question || (!skipped && !answer.trim())) return;
    const questionKey = `${runId}:${question.questionId}`;
    setAnsweringQuestion(questionKey);
    try {
      await answerAiRunQuestion(runIdRef, question.questionId, answer, skipped);
      setQuestionAnswers((current) => { const next = { ...current }; delete next[questionKey]; return next; });
      setError(null);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setAnsweringQuestion(null); }
  }, []);
  const handleApprovalDecision = useCallback(async (approvalId: string, decision: "approved" | "denied") => {
    setDecidingApproval(approvalId);
    try { await decideAiApproval(approvalId, decision); setError(null); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setDecidingApproval(null); }
  }, []);

  if (loading) return <div className="minecraft-workflow-loading"><Spin /><Typography.Text type="secondary">正在读取工作流节点与执行引擎…</Typography.Text></div>;
  const activeRuntimeNodes = runs.find((run) => !terminalStatuses.has(run.status))?.nodes ?? runs[0]?.nodes ?? [];
  return <section className="minecraft-workflow-page" aria-label="Minecraft 工作流">
    <div className="minecraft-workflow-heading">
      <div><span className="minecraft-eyebrow">APP WORKFLOW</span><Typography.Title level={3}>工作流画布</Typography.Title><Typography.Paragraph>使用可插拔节点组织任务。画布与运行核心跨 App 共用，Minecraft Agent 节点通过现有工具和权限服务执行。</Typography.Paragraph></div>
      <Space wrap>
        <Select aria-label="选择工作流" value={draft?.id ?? "__new"} onChange={selectWorkflow} options={[...workflows.map((workflow) => ({ value: workflow.id, label: workflow.title })), { value: "__new", label: "＋ 新建工作流" }]} style={{ minWidth: 180 }} />
        <Select aria-label="选择工作流引擎" value={draft?.engineId} onChange={(engineId) => markChanged((current) => ({ ...current, engineId }))} options={engineTypes.map((engine) => ({ value: engine.id, label: engine.name }))} disabled={!draft || activeRun || !engineTypes.length} style={{ minWidth: 140 }} />
        <Select aria-label="选择要添加的节点" value={nodeToAdd} onChange={setNodeToAdd} options={nodeTypes.map((node) => ({ value: node.type, label: node.name }))} disabled={!draft || activeRun || !nodeTypes.length} style={{ minWidth: 160 }} />
        <Button onClick={addNode} disabled={!draft || activeRun || !nodeToAdd || draft.nodes.length >= 64}>添加节点</Button>
        <Button type="primary" onClick={() => void handleSave()} disabled={!draft || !dirty || activeRun || !draft.engineId} loading={saving}>保存</Button>
        <Button type="primary" disabled={!draft?.id || dirty || !draft.nodes.length || activeRun || !selectedEngineAvailable || !allNodeTypesAvailable || (needsEula && !eulaAccepted)} loading={running} onClick={() => void handleRun()}>运行</Button>
        {draft?.id ? <Button danger onClick={() => void handleDelete()}>删除</Button> : null}
      </Space>
    </div>

    {error ? <Alert className="minecraft-workflow-alert" type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}
    {draft && (!selectedEngineAvailable || !allNodeTypesAvailable) ? <Alert type="warning" showIcon message="工作流所需的插件当前未启用" description="定义和未知节点配置已保留。启用匹配的节点/引擎提供方后才能运行。" /> : null}
    <Card className="minecraft-card minecraft-workflow-editor">
      {!draft ? <Empty description="还没有工作流。新建一个画布，再从已安装节点包中添加节点。"><Button type="primary" onClick={() => selectWorkflow("__new")}>新建工作流</Button></Empty> : <>
        <div className="minecraft-workflow-toolbar">
          <Input aria-label="工作流名称" value={draft.title} maxLength={80} disabled={activeRun} onChange={(event) => markChanged((current) => ({ ...current, title: event.target.value }))} />
          <span>{draft.nodes.length} 个节点 · {draft.edges.length} 条连线{dirty ? " · 尚未保存" : " · 已保存"}</span>
          {needsEula ? <label className="minecraft-workflow-eula"><Checkbox checked={eulaAccepted} onChange={(event) => setEulaAccepted(event.target.checked)} />我已阅读并同意 <a href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">Minecraft EULA</a></label> : null}
        </div>
        <WorkflowGraphEditor nodes={draft.nodes} edges={draft.edges} nodeTypes={nodeTypes} runtimeNodes={activeRuntimeNodes} nodeEditors={nodeEditors} disabled={false} onChange={onGraphChange} />
      </>}
    </Card>

    {runs.length ? <Card className="minecraft-card minecraft-workflow-runs">
      <div className="minecraft-card-heading"><div><Typography.Title level={4}>运行记录</Typography.Title><Typography.Text type="secondary">状态和结果来自已登记节点执行器与其领域 Owner。</Typography.Text></div><Tag>{runs.length}</Tag></div>
      {runs.map((run) => <article className="minecraft-workflow-run" key={run.id}>
        <div className="minecraft-workflow-run__heading"><strong>{workflowStatusLabel[run.status]}</strong><Tag color={statusColor(run.status)}>{new Date(run.createdAt).toLocaleString("zh-CN")}</Tag>{!terminalStatuses.has(run.status) ? <Button size="small" danger onClick={() => void handleCancel(run.id)}>取消运行</Button> : null}</div>
        {run.nodes.map((node) => {
          const question = readPendingQuestion(node);
          const approval = readPendingApproval(node);
          const questionKey = question ? `${run.id}:${question.questionId}` : "";
          return <div className="minecraft-workflow-run__node" key={node.nodeId}>
            <span>{node.title}</span><Tag color={statusColor(node.status)}>{nodeStatusLabel[node.status]}</Tag>
            {typeof node.progress?.agentStatus === "string" ? <Typography.Text type="secondary">Agent：{node.progress.agentStatus}</Typography.Text> : null}
            {node.startedAt ? <Typography.Text type="secondary">开始 {new Date(node.startedAt).toLocaleTimeString("zh-CN")}</Typography.Text> : null}
            {node.completedAt ? <Typography.Text type="secondary">完成 {new Date(node.completedAt).toLocaleTimeString("zh-CN")}</Typography.Text> : null}
            {node.output ? <Typography.Paragraph className="minecraft-workflow-run__output">{node.output}{node.outputTruncated ? "…" : ""}</Typography.Paragraph> : null}
            {node.error ? <Typography.Text type="danger">{node.error}</Typography.Text> : null}
            {question ? <div className="minecraft-workflow-question">
              <strong>{question.question}</strong>
              <Space wrap>{question.options.map((option) => <Button key={option} size="small" loading={answeringQuestion === questionKey} disabled={Boolean(answeringQuestion)} onClick={() => void handleQuestionAnswer(run.id, node, option)}>{option}</Button>)}</Space>
              <Space.Compact block><Input aria-label="回答 Agent 澄清问题" value={questionAnswers[questionKey] ?? ""} maxLength={12000} onChange={(event) => setQuestionAnswers((current) => ({ ...current, [questionKey]: event.target.value }))} onPressEnter={() => void handleQuestionAnswer(run.id, node, questionAnswers[questionKey] ?? "")} /><Button type="primary" disabled={!questionAnswers[questionKey]?.trim()} loading={answeringQuestion === questionKey} onClick={() => void handleQuestionAnswer(run.id, node, questionAnswers[questionKey] ?? "")}>发送回答</Button><Button disabled={Boolean(answeringQuestion)} onClick={() => void handleQuestionAnswer(run.id, node, "", true)}>跳过</Button></Space.Compact>
            </div> : null}
            {approval ? <div className="minecraft-workflow-question"><strong>需要你审批：{approval.title}</strong><Typography.Text>{approval.detail}</Typography.Text><Space><Button type="primary" size="small" loading={decidingApproval === approval.approvalId} disabled={Boolean(decidingApproval)} onClick={() => void handleApprovalDecision(approval.approvalId, "approved")}>批准本次操作</Button><Button danger size="small" disabled={Boolean(decidingApproval)} onClick={() => void handleApprovalDecision(approval.approvalId, "denied")}>拒绝</Button></Space></div> : null}
          </div>;
        })}
      </article>)}
    </Card> : null}
    <Typography.Text className="minecraft-workflow-footnote" type="secondary">执行引擎与节点适配器可按 App 插拔；本首个适配器使用顺序 DAG。Minecraft 工具审批、EULA 和目标节点真实状态继续由现有 Owner 管理。</Typography.Text>
  </section>;
}
