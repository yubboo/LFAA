// @lfaa/agent-profile Agent 编辑卡：名称、用途、人设指令、模型绑定与保存/删除。
// 受控组件：状态由 Agents-View 持有，这里只渲染与回调，拆分目的是把列表与表单的职责分开。
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { AgentsMessages } from "../locales";
import type { ModelOption } from "../agents/agents-api";
import type { AgentItem, BindingItem } from "../agents/agents-types";
import styles from "./Agent-Editor.module.css";

/** 编辑中的草稿；view 持有它，切换选中项时整体替换。 */
export interface AgentDraft {
  name: string;
  kind: "assistant" | "worker";
  instructions: string;
  bindingId: string;
  /** 逗号分隔的禁用工具名；空串表示不限制。 */
  denyTools: string;
}

/** 新建绑定的临时草稿。 */
export interface BindingDraft {
  name: string;
  model: string;
}

export interface AgentEditorProps {
  t: AgentsMessages;
  creating: boolean;
  selected: AgentItem | null;
  draft: AgentDraft;
  onDraftChange: (next: AgentDraft) => void;
  bindings: BindingItem[];
  models: ModelOption[];
  /** 写/执行类工具名，用于「一键只读」预设。 */
  writeTools: string[];
  bindingDraft: BindingDraft | null;
  onBindingDraftChange: (next: BindingDraft | null) => void;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onSaveBinding: () => void;
}

export function AgentEditor(props: AgentEditorProps) {
  const { t, creating, selected, draft, onDraftChange, bindings, models, bindingDraft, onBindingDraftChange, busy } = props;

  return (
    <section className={styles.editor}>
      <h3 className={styles.editorTitle}>{creating ? t.newAgent : t.name}</h3>
      <label className={styles.field}>
        <span>{t.name}</span>
        <input
          className={styles.input}
          value={draft.name}
          placeholder={t.namePlaceholder}
          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
        />
      </label>
      <label className={styles.field}>
        <span>{t.kind}</span>
        <select
          className={styles.input}
          value={draft.kind}
          onChange={(event) => onDraftChange({ ...draft, kind: event.target.value as "assistant" | "worker" })}
        >
          <option value="worker">{t.kindWorker}</option>
          <option value="assistant">{t.kindAssistant}</option>
        </select>
      </label>
      <label className={styles.field}>
        <span>{t.instructions}</span>
        <textarea
          className={styles.textarea}
          value={draft.instructions}
          placeholder={t.instructionsPlaceholder}
          onChange={(event) => onDraftChange({ ...draft, instructions: event.target.value })}
          rows={5}
        />
      </label>
      <label className={styles.field}>
        <span>{t.toolDeny}</span>
        <input
          className={styles.input}
          value={draft.denyTools}
          placeholder="run_command, write_file, edit_file"
          onChange={(event) => onDraftChange({ ...draft, denyTools: event.target.value })}
        />
        <span className={styles.hint}>{t.toolDenyHint}</span>
        {props.writeTools.length > 0 ? (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => onDraftChange({ ...draft, denyTools: props.writeTools.join(", ") })}
          >
            {t.readOnlyPreset}
          </button>
        ) : null}
      </label>
      <label className={styles.field}>
        <span>{t.binding}</span>
        <select
          className={styles.input}
          value={draft.bindingId}
          onChange={(event) => onDraftChange({ ...draft, bindingId: event.target.value })}
        >
          <option value="">{t.bindingDefault}</option>
          {bindings.filter((binding) => !binding.inheritGlobal).map((binding) => (
            <option key={binding.id} value={binding.id}>
              {binding.name}
              {binding.targets.length > 1 ? t.bindingGroupSuffix : ""}
            </option>
          ))}
        </select>
      </label>

      {bindingDraft ? (
        <div className={styles.subCard}>
          <label className={styles.field}>
            <span>{t.bindingName}</span>
            <input
              className={styles.input}
              value={bindingDraft.name}
              onChange={(event) => onBindingDraftChange({ ...bindingDraft, name: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span>{t.bindingModel}</span>
            <select
              className={styles.input}
              value={bindingDraft.model}
              onChange={(event) => onBindingDraftChange({ ...bindingDraft, model: event.target.value })}
            >
              <option value="">{models.length === 0 ? t.noModel : "—"}</option>
              {models.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className={styles.rowActions}>
            <button type="button" className={styles.primary} onClick={props.onSaveBinding} disabled={busy}>
              {t.save}
            </button>
            <button type="button" className={styles.ghost} onClick={() => onBindingDraftChange(null)}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.ghost}
          onClick={() => onBindingDraftChange({ name: draft.name || t.newAgent, model: models[0]?.value ?? "" })}
        >
          <IconPlus size={14} /> {t.createBinding}
        </button>
      )}

      <div className={styles.rowActions}>
        <button type="button" className={styles.primary} onClick={props.onSave} disabled={busy || !draft.name.trim()}>
          {t.save}
        </button>
        <button type="button" className={styles.ghost} onClick={props.onCancel}>
          {t.cancel}
        </button>
        {!creating && selected ? (
          <button
            type="button"
            className={styles.danger}
            onClick={props.onRemove}
            disabled={selected.source === "builtin"}
            title={selected.source === "builtin" ? t.builtinHint : t.remove}
          >
            <IconTrash size={14} /> {t.remove}
          </button>
        ) : null}
      </div>
    </section>
  );
}