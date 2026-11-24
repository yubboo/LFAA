// @lfaa/agent-profile Agents 页：左侧列出 agent，右侧编辑人设、用途与模型绑定。
// 数据全部来自 /api/agents 与 /api/bindings；保存后重新拉取，不做乐观更新以免掩盖服务端校验。
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconRobot } from "@tabler/icons-react";
import { agentsMessages } from "../locales";
import {
  createAgent,
  createBinding,
  deleteAgent,
  fetchAgents,
  fetchBindings,
  fetchModelOptions,
  exportAgents,
  importAgents,
  fetchWriteToolNames,
  updateAgent,
  type ModelOption,
} from "../agents/agents-api";
import type { AgentItem, BindingItem } from "../agents/agents-types";
import { AgentEditor, type AgentDraft, type BindingDraft } from "../editor/Agent-Editor";
import { AgentsToolbar } from "./Agents-Toolbar";
import styles from "./Agents-View.module.css";

const EMPTY_DRAFT: AgentDraft = { name: "", kind: "worker", instructions: "", bindingId: "", denyTools: "" };

/** Agents 页主体；isZh 决定文案，切换语言时重渲染即可。 */
export function AgentsView({ isZh }: { isZh: boolean }) {
  const t = agentsMessages[isZh ? "zh" : "en"];
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [bindings, setBindings] = useState<BindingItem[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [writeTools, setWriteTools] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgentDraft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [bindingDraft, setBindingDraft] = useState<BindingDraft | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const report = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [nextAgents, nextBindings, nextModels, nextWriteTools] = await Promise.all([
        fetchAgents(),
        fetchBindings(),
        fetchModelOptions().catch(() => [] as ModelOption[]),
        fetchWriteToolNames().catch(() => [] as string[]),
      ]);
      setAgents(nextAgents);
      setBindings(nextBindings);
      setModels(nextModels);
      setWriteTools(nextWriteTools);
      setError("");
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId) ?? null, [agents, selectedId]);

  /** 列表行副标题：显示绑定指向的第一个「供应商/模型」，路由组额外显示目标数。 */
  const bindingLabel = useCallback((agent: AgentItem): string => {
    const binding = bindings.find((item) => item.id === agent.bindingId);
    if (!binding || binding.inheritGlobal) return t.bindingDefault;
    const first = binding.targets[0];
    const model = models.find((option) => option.profileId === first?.profileId && option.modelId === first?.modelId);
    const suffix = binding.targets.length > 1 ? `${binding.targets.length}${t.targetCount}` : "";
    return `${model?.label ?? binding.name}${suffix ? ` · ${suffix}` : ""}`;
  }, [bindings, models, t]);

  const openAgent = (agent: AgentItem) => {
    setCreating(false);
    setSelectedId(agent.id);
    setBindingDraft(null);
    setDraft({
      name: agent.name,
      kind: agent.kind,
      instructions: agent.instructions ?? "",
      bindingId: agent.bindingId ?? "",
      denyTools: (agent.toolPolicy?.deny ?? []).join(", "),
    });
  };

  const openCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setBindingDraft(null);
    setDraft(EMPTY_DRAFT);
  };

  const closeEditor = () => {
    setCreating(false);
    setSelectedId(null);
    setBindingDraft(null);
  };

  const save = async () => {
    setBusy(true);
    try {
      const bindingId = draft.bindingId.trim();
      const deny = draft.denyTools.split(/[,，\s]+/u).map((item) => item.trim()).filter(Boolean);
      const toolPolicy = deny.length > 0 ? { deny } : null;
      if (creating) {
        const created = await createAgent({
          name: draft.name,
          kind: draft.kind,
          ...(draft.instructions.trim() ? { instructions: draft.instructions } : {}),
          ...(bindingId ? { bindingId } : {}),
          ...(toolPolicy ? { toolPolicy } : {}),
        });
        await load();
        setCreating(false);
        setSelectedId(created.id);
      } else if (selected) {
        await updateAgent(selected.id, {
          name: draft.name,
          kind: draft.kind,
          instructions: draft.instructions,
          bindingId: bindingId || null,
          toolPolicy,
        });
        await load();
      }
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (agent: AgentItem) => {
    try {
      await updateAgent(agent.id, { enabled: !agent.enabled });
      await load();
    } catch (cause) {
      report(cause);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteAgent(selected.id);
      closeEditor();
      await load();
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  /** 导出为 JSON 文件：直接走浏览器下载，不经过任何服务端存储。 */
  const exportAll = async () => {
    try {
      const snapshot = await exportAgents();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lfaa-agents-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setError("");
    } catch (cause) {
      report(cause);
    }
  };

  /** 导入 JSON 快照：覆盖同 id 项、追加新项，然后重新拉列表。 */
  const importAll = async (file: File) => {
    setBusy(true);
    try {
      const snapshot: unknown = JSON.parse(await file.text());
      const stats = await importAgents(snapshot);
      await load();
      setError(`${t.importDone}：agent +${stats.agents.added}/~${stats.agents.updated}，绑定 +${stats.bindings.added}/~${stats.bindings.updated}`);
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  const saveBinding = async () => {
    if (!bindingDraft) return;
    const [profileId, modelId] = bindingDraft.model.split("\u0000");
    if (!bindingDraft.name.trim() || !profileId) {
      setError(t.noModel);
      return;
    }
    setBusy(true);
    try {
      const binding = await createBinding({
        name: bindingDraft.name,
        strategy: "single",
        targets: [{ profileId, ...(modelId ? { modelId } : {}) }],
      });
      setBindingDraft(null);
      await load();
      setDraft((current) => ({ ...current, bindingId: binding.id }));
      setError("");
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  const editing = creating || selected !== null;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{t.title}</h2>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        <AgentsToolbar
          t={t}
          busy={busy}
          onRefresh={() => void load()}
          onCreate={openCreate}
          onExport={() => void exportAll()}
          onImport={(file) => void importAll(file)}
        />      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.body}>
        <ul className={styles.list}>
          {agents.length === 0 && !busy ? <li className={styles.empty}>{t.empty}</li> : null}
          {agents.map((agent) => (
            <li key={agent.id}>
              <div className={`${styles.row} ${selectedId === agent.id ? styles.rowActive : ""}`}>
                <button type="button" className={styles.rowMain} onClick={() => openAgent(agent)}>
                  <span className={styles.avatar}><IconRobot size={16} /></span>
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>
                      {agent.name}
                      {agent.source === "builtin" ? <em className={styles.badge}>{t.builtin}</em> : null}
                      {agent.enabled ? null : <em className={styles.badgeMuted}>{t.disabledTag}</em>}
                    </span>
                    <span className={styles.rowMeta}>{bindingLabel(agent)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.switch} ${agent.enabled ? styles.switchOn : ""}`}
                  role="switch"
                  aria-checked={agent.enabled}
                  aria-label={agent.enabled ? t.disable : t.enable}
                  title={agent.enabled ? t.disable : t.enable}
                  onClick={() => void toggleEnabled(agent)}
                >
                  <span className={styles.switchDot} />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {editing ? (
          <AgentEditor
            t={t}
            creating={creating}
            selected={selected}
            draft={draft}
            onDraftChange={setDraft}
            bindings={bindings}
            models={models}
            writeTools={writeTools}
            bindingDraft={bindingDraft}
            onBindingDraftChange={setBindingDraft}
            busy={busy}
            onSave={() => void save()}
            onCancel={closeEditor}
            onRemove={() => void remove()}
            onSaveBinding={() => void saveBinding()}
          />
        ) : null}
      </div>
    </div>
  );
}