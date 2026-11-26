// 设置中心「长期记忆」面板：新增、检索筛选、编辑与删除分组，删除固定落在页面最末的危险组。
import { useState } from "react";
import {
  SettingDangerGroup,
  SettingFormActions,
  SettingFormField,
  SettingGroup,
  SettingRow,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
import type { ChatClientStore } from "../store/chat-store";
import type { LongTermMemoryItem, MemoryKindItem, MemoryStatsItem } from "../store/chat-types";
import type { ChatLocaleMessages } from "../locales";
import styles from "./MemoryPanel.module.css";
import {
  filterMemories,
  MEMORY_KIND_ORDER,
  memoryKindLabel,
  memoryMetaText,
  memoryStatsText,
} from "./memory-view";

/** 列表一次最多渲染多少条，避免记忆库变大后设置页一次性挂满 DOM。 */
const MAX_VISIBLE = 50;

/** 渲染记忆面板；数据来自 Store 快照，写操作统一走 Store 动作。 */
export function MemoryPanel({
  locale,
  store,
  memories,
  stats,
  boundProjectId,
  onNotice,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  memories: LongTermMemoryItem[];
  stats: MemoryStatsItem | null;
  boundProjectId: string | null;
  onNotice: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [draftKind, setDraftKind] = useState<MemoryKindItem>("fact");
  const [draftScope, setDraftScope] = useState<"global" | "project">("global");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<MemoryKindItem | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editKind, setEditKind] = useState<MemoryKindItem>("fact");
  const [deleteId, setDeleteId] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = filterMemories(memories, { query, kind: kindFilter });
  const editing = memories.find((memory) => memory.id === editingId) ?? null;
  const deleting = memories.find((memory) => memory.id === deleteId) ?? null;
  const kindOptions = MEMORY_KIND_ORDER.map((kind): [MemoryKindItem, string] => [kind, memoryKindLabel(locale, kind)]);

  /** 提交新增记忆：作用域选项目但未绑定项目时回落到全局。 */
  const submitMemory = async () => {
    const content = draft.trim();
    if (!content || busy) return;
    const scope = draftScope === "project" && boundProjectId ? "project" : "global";
    setBusy(true);
    try {
      await store.addLongTermMemory({
        content,
        kind: draftKind,
        scope,
        ...(scope === "project" && boundProjectId ? { projectId: boundProjectId } : {}),
      });
      setDraft("");
      onNotice(locale.savedNotice);
    } finally {
      setBusy(false);
    }
  };

  /** 打开编辑：把当前值灌进草稿，取消时直接丢弃。 */
  const beginEdit = (memory: LongTermMemoryItem) => {
    setEditingId(memory.id);
    setEditContent(memory.content);
    setEditKind(memory.kind);
  };

  const submitEdit = async () => {
    if (!editingId || busy) return;
    const content = editContent.trim();
    if (!content) return;
    setBusy(true);
    try {
      await store.updateLongTermMemory(editingId, { content, kind: editKind });
      setEditingId(null);
      onNotice(locale.savedNotice);
    } finally {
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteId || busy) return;
    setBusy(true);
    try {
      await store.removeLongTermMemory(deleteId);
      setDeleteId("");
      if (editingId === deleteId) setEditingId(null);
      onNotice(locale.savedNotice);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingGroup title={locale.addMemory}>
        <SettingFormField label={locale.isZh ? "记忆内容" : "Memory"}>
          <input
            className={baseStyles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={locale.addMemoryPlaceholder}
          />
        </SettingFormField>
        <SettingFormField label={locale.isZh ? "记忆类型" : "Kind"}>
          <select
            className={baseStyles.input}
            value={draftKind}
            onChange={(event) => setDraftKind(event.target.value as MemoryKindItem)}
          >
            {kindOptions.map(([kind, label]) => (
              <option key={kind} value={kind}>{label}</option>
            ))}
          </select>
        </SettingFormField>
        <SettingFormField label={locale.isZh ? "作用域" : "Scope"}>
          <select
            className={baseStyles.input}
            value={draftScope}
            onChange={(event) => setDraftScope(event.target.value === "project" ? "project" : "global")}
          >
            <option value="global">{locale.globalScope}</option>
            {boundProjectId && <option value="project">{locale.projectScope}</option>}
          </select>
        </SettingFormField>
        <SettingFormActions>
          <button
            type="button"
            className={baseStyles.primaryBtn}
            disabled={!draft.trim() || busy}
            onClick={() => void submitMemory()}
          >
            {locale.addMemory}
          </button>
        </SettingFormActions>
      </SettingGroup>

      <SettingGroup title={locale.memoryLibraryTitle} description={memoryStatsText(locale, memories, stats)}>
        <SettingRow
          title={locale.memorySearchLabel}
          control={(
            <input
              className={`${baseStyles.input} ${styles.filterInput}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={locale.memorySearchPlaceholder}
              aria-label={locale.memorySearchLabel}
            />
          )}
        />
        <SettingRow
          title={locale.memoryFilterLabel}
          control={(
            <select
              className={`${baseStyles.input} ${styles.filterSelect}`}
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value as MemoryKindItem | "all")}
              aria-label={locale.memoryFilterLabel}
            >
              <option value="all">{locale.memoryKindAll}</option>
              {kindOptions.map(([kind, label]) => (
                <option key={kind} value={kind}>{label}</option>
              ))}
            </select>
          )}
        />
        {filtered.slice(0, MAX_VISIBLE).map((memory) => (
          <SettingRow
            key={memory.id}
            title={memory.content}
            description={memoryMetaText(locale, memory)}
            control={(
              <button
                type="button"
                className={baseStyles.ghostBtn}
                onClick={() => beginEdit(memory)}
              >
                {locale.memoryEditAction}
              </button>
            )}
          />
        ))}
        {filtered.length === 0 && (
          <p className={baseStyles.pageDesc}>
            {query.trim() || kindFilter !== "all" ? locale.memoryEmptyFiltered : locale.emptyMemories}
          </p>
        )}
        {filtered.length > MAX_VISIBLE && (
          <p className={baseStyles.pageDesc}>
            {locale.isZh
              ? `另有 ${filtered.length - MAX_VISIBLE} 条未显示`
              : `${filtered.length - MAX_VISIBLE} more hidden`}
          </p>
        )}
      </SettingGroup>

      {editing && (
        <SettingGroup title={locale.memoryEditTitle}>
          <SettingFormField label={locale.isZh ? "记忆内容" : "Memory"}>
            <textarea
              className={`${baseStyles.input} ${baseStyles.textarea}`}
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
            />
          </SettingFormField>
          <SettingFormField label={locale.isZh ? "记忆类型" : "Kind"}>
            <select
              className={baseStyles.input}
              value={editKind}
              onChange={(event) => setEditKind(event.target.value as MemoryKindItem)}
            >
              {kindOptions.map(([kind, label]) => (
                <option key={kind} value={kind}>{label}</option>
              ))}
            </select>
          </SettingFormField>
          <SettingFormActions>
            <button
              type="button"
              className={baseStyles.primaryBtn}
              disabled={!editContent.trim() || busy}
              onClick={() => void submitEdit()}
            >
              {locale.memorySaveEdit}
            </button>
            <button
              type="button"
              className={baseStyles.ghostBtn}
              onClick={() => setEditingId(null)}
            >
              {locale.memoryCancelEdit}
            </button>
          </SettingFormActions>
        </SettingGroup>
      )}

      {memories.length > 0 && (
        <SettingDangerGroup title={locale.memoryDeleteTitle}>
          <SettingRow
            title={locale.memoryDeletePickLabel}
            {...(deleting ? { description: deleting.content } : {})}
            control={(
              <>
                <select
                  className={`${baseStyles.input} ${styles.filterSelect}`}
                  value={deleteId}
                  onChange={(event) => setDeleteId(event.target.value)}
                  aria-label={locale.memoryDeletePickLabel}
                >
                  <option value="">—</option>
                  {memories.map((memory) => (
                    <option key={memory.id} value={memory.id}>
                      {`[${memoryKindLabel(locale, memory.kind)}] ${memory.content.slice(0, 32)}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={baseStyles.dangerBtn}
                  disabled={!deleteId || busy}
                  onClick={() => void submitDelete()}
                >
                  {locale.deleteMemory}
                </button>
              </>
            )}
          />
        </SettingDangerGroup>
      )}
    </>
  );
}