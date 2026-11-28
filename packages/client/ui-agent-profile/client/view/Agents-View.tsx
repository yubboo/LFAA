// @lfaa/agent-profile Agents 页：统一采用「卡片网格 + 弹窗配置」交互，兼容内置角色、本机官方 CLI 与自定义角色。
// 关联：packages/client/ui-agent-profile/client/editor/Agent-Editor.tsx；运行环境：浏览器。
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { agentsMessages } from "../locales";
import {
  createAgent,
  createBinding,
  deleteAgent,
  fetchAgents,
  fetchBindings,
  fetchCliRuntimes,
  fetchModelOptions,
  exportAgents,
  importAgents,
  fetchWriteToolNames,
  toggleCliRuntimeEnabled,
  updateAgent,
  type ModelOption,
} from "../agents/agents-api";
import type { AgentItem, BindingItem, CliRuntimeItem } from "../agents/agents-types";
import { AgentEditor, type AgentDraft, type BindingDraft } from "../editor/Agent-Editor";
import { AgentsToolbar } from "./Agents-Toolbar";
import { AgentEditorModal, AgentRoleCard } from "./AgentRoleCard";
import { CliRuntimeGrid } from "./CliRuntimeGrid";
import styles from "./Agents-View.module.css";

const EMPTY_DRAFT: AgentDraft = { name: "", kind: "worker", instructions: "", bindingId: "", cliAgentId: "", denyTools: "" };
const noopSubscribe = () => () => {};

interface AgentsWorkbenchBridge {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => { activeDomainItem: string };
  navigate?: (view: string) => void;
}

/** Agents 页主体：全部 Agent（角色 + 本机 CLI 统一卡片网格）与自定义角色，点击卡片「设置」弹出模态框配置。 */
export function AgentsView({ isZh, workbench }: { isZh: boolean; workbench?: AgentsWorkbenchBridge }) {
  const activeDomainItem = useSyncExternalStore(
    workbench ? workbench.subscribe : noopSubscribe,
    () => workbench?.getSnapshot().activeDomainItem ?? "agents-all",
    () => "agents-all",
  );
  const rolesOnly = activeDomainItem === "agents-roles";
  const t = agentsMessages[isZh ? "zh" : "en"];
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [bindings, setBindings] = useState<BindingItem[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [cliRuntimes, setCliRuntimes] = useState<CliRuntimeItem[]>([]);
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

  const load = useCallback(async (forceCli = false) => {
    setBusy(true);
    try {
      const [nextAgents, nextBindings, nextModels, nextWriteTools, nextCliRuntimes] = await Promise.all([
        fetchAgents(),
        fetchBindings(),
        fetchModelOptions().catch(() => [] as ModelOption[]),
        fetchWriteToolNames().catch(() => [] as string[]),
        fetchCliRuntimes(forceCli).catch(() => [] as CliRuntimeItem[]),
      ]);
      setAgents(nextAgents);
      setBindings(nextBindings);
      setModels(nextModels);
      setWriteTools(nextWriteTools);
      setCliRuntimes(nextCliRuntimes);
      setError("");
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  }, [report]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId) ?? null, [agents, selectedId]);
  const editing = creating || selected !== null;

  /** 卡片副标题：优先展示绑定的本机 CLI，否则显示「供应商/模型」。 */
  const bindingLabel = useCallback((agent: AgentItem): string => {
    if (agent.cliAgentId) {
      const cli = cliRuntimes.find((item) => item.id === agent.cliAgentId);
      return `${cli?.name ?? agent.cliAgentId} · CLI`;
    }
    const binding = bindings.find((item) => item.id === agent.bindingId);
    if (!binding || binding.inheritGlobal) return t.bindingDefault;
    const first = binding.targets[0];
    const model = models.find((option) => option.profileId === first?.profileId && option.modelId === first?.modelId);
    const suffix = binding.targets.length > 1 ? `${binding.targets.length}${t.targetCount}` : "";
    return `${model?.label ?? binding.name}${suffix ? ` · ${suffix}` : ""}`;
  }, [bindings, cliRuntimes, models, t]);

  const openAgent = (agent: AgentItem) => {
    setCreating(false);
    setSelectedId(agent.id);
    setBindingDraft(null);
    setDraft({
      name: agent.name,
      kind: agent.kind,
      instructions: agent.instructions ?? "",
      bindingId: agent.bindingId ?? "",
      cliAgentId: agent.cliAgentId ?? "",
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

  const openCliAccountSettings = () => {
    try {
      sessionStorage.setItem("lfaa:settings-config-tab", "cli-agents");
    } catch {
      // 忽略
    }
    window.dispatchEvent(new CustomEvent("lfaa:settings-config-tab", { detail: "cli-agents" }));
    workbench?.navigate?.("settings:config");
  };

  const save = async () => {
    setBusy(true);
    try {
      const bindingId = draft.bindingId.trim();
      const deny = draft.denyTools.split(/[,，\s]+/u).map((item) => item.trim()).filter(Boolean);
      const toolPolicy = deny.length > 0 ? { deny } : null;
      if (creating) {
        await createAgent({
          name: draft.name,
          kind: draft.kind,
          ...(draft.instructions.trim() ? { instructions: draft.instructions } : {}),
          ...(bindingId ? { bindingId } : {}),
          ...(draft.cliAgentId.trim() ? { cliAgentId: draft.cliAgentId.trim() } : {}),
          ...(toolPolicy ? { toolPolicy } : {}),
        });
        await load(false);
        closeEditor();
      } else if (selected) {
        await updateAgent(selected.id, {
          name: draft.name,
          kind: draft.kind,
          instructions: draft.instructions,
          bindingId: bindingId || null,
          cliAgentId: draft.cliAgentId.trim(),
          toolPolicy,
        });
        await load(false);
        closeEditor();
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
      await load(false);
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
      await load(false);
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

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

  const importAll = async (file: File) => {
    setBusy(true);
    try {
      const snapshot: unknown = JSON.parse(await file.text());
      const stats = await importAgents(snapshot);
      await load(false);
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
      await load(false);
      setDraft((current) => ({ ...current, bindingId: binding.id }));
      setError("");
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  const installedClis = cliRuntimes.filter((item) => item.installed);
  const availableClis = cliRuntimes.filter((item) => !item.installed);

  const renderRoleCard = (agent: AgentItem) => (
    <AgentRoleCard
      key={agent.id}
      agent={agent}
      isZh={isZh}
      t={t}
      bindingText={bindingLabel(agent)}
      onOpen={() => openAgent(agent)}
      onToggleEnabled={() => void toggleEnabled(agent)}
    />
  );

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>{rolesOnly ? (isZh ? "自定义角色" : "Custom Roles") : t.title}</h2>
            <p className={styles.subtitle}>
              {rolesOnly
                ? (isZh ? "管理内置与自定义协作角色，点击卡片「设置」在弹窗中调整人设、工具权限与绑定引擎。" : "Manage built-in and custom roles; click Settings on any card to configure in a dialog.")
                : (isZh ? "统一管理内置 Agent、本机官方 CLI 与自定义角色，点击卡片「设置」即可快速配置。" : "Manage built-in agents, local official CLIs, and custom roles in one card directory.")}
            </p>
          </div>
          <AgentsToolbar
            t={t}
            busy={busy}
            onRefresh={() => void load(true)}
            onCreate={openCreate}
            onExport={() => void exportAll()}
            onImport={(file) => void importAll(file)}
          />
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}

        {rolesOnly ? (
          <div className={styles.grid}>
            {agents.length === 0 && !busy ? <div className={styles.empty}>{t.empty}</div> : null}
            {agents.map(renderRoleCard)}
          </div>
        ) : (
          <>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                {isZh ? `已就绪（${agents.length + installedClis.length}）` : `Ready (${agents.length + installedClis.length})`}
              </h3>
              <div className={styles.grid}>
                {agents.map(renderRoleCard)}
                <CliRuntimeGrid
                  isZh={isZh}
                  runtimes={installedClis}
                  onOpenSettings={openCliAccountSettings}
                  onToggleEnabled={(item) => {
                    void toggleCliRuntimeEnabled(item.id, !item.enabled)
                      .then(setCliRuntimes)
                      .catch(report);
                  }}
                />
              </div>
            </section>

            {availableClis.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  {isZh ? `可安装官方 CLI（${availableClis.length}）` : `Available Official CLIs (${availableClis.length})`}
                </h3>
                <div className={styles.grid}>
                  <CliRuntimeGrid
                    isZh={isZh}
                    runtimes={availableClis}
                    onOpenSettings={openCliAccountSettings}
                    onToggleEnabled={(item) => {
                      void toggleCliRuntimeEnabled(item.id, !item.enabled)
                        .then(setCliRuntimes)
                        .catch(report);
                    }}
                  />
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <AgentEditorModal
        open={editing}
        title={creating ? t.newAgent : `${selected?.name ?? ""} · ${isZh ? "角色设置" : "Role Settings"}`}
        isZh={isZh}
        onClose={closeEditor}
      >
        <AgentEditor
          t={t}
          isZh={isZh}
          creating={creating}
          selected={selected}
          draft={draft}
          onDraftChange={setDraft}
          bindings={bindings}
          models={models}
          cliRuntimes={cliRuntimes}
          writeTools={writeTools}
          bindingDraft={bindingDraft}
          onBindingDraftChange={setBindingDraft}
          busy={busy}
          onSave={() => void save()}
          onCancel={closeEditor}
          onRemove={() => void remove()}
          onSaveBinding={() => void saveBinding()}
        />
      </AgentEditorModal>
    </div>
  );
}
