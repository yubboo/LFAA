// @lfaa/skills 技能中心主视图组件，支持按来源筛选、导入/新建、编辑、二创复制、启停与删除。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCopy, IconEdit, IconPlus, IconRefresh, IconTrash, IconUpload } from "@tabler/icons-react";
import type { SkillDetail, SkillSourceKind, SkillSummary } from "@lfaa/skills/contract";
import { skillsMessages } from "./locales";
import {
  deleteSkillRequest,
  fetchSkillDetail,
  fetchSkillsList,
  forkSkillRequest,
  saveSkillRequest,
  toggleSkillRequest,
} from "./skills-client";
import styles from "./Skills-View.module.css";

type SourceFilter = "all" | SkillSourceKind;

export function SkillsView({ isZh }: { isZh: boolean }) {
  const t = skillsMessages[isZh ? "zh" : "en"];
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [formId, setFormId] = useState<string | undefined>(undefined);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formContent, setFormContent] = useState("");
  const [expectedRev, setExpectedRev] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadList = useCallback(async (keepSelected = true) => {
    try {
      const list = await fetchSkillsList(true);
      setSkills(list);
      if (!keepSelected || !list.some((s) => s.id === selectedId)) {
        setSelectedId(list[0]?.id ?? null);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  }, [selectedId]);

  useEffect(() => {
    void loadList(true);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void fetchSkillDetail(selectedId)
      .then((d) => setDetail(d))
      .catch((err) => setNotice(err instanceof Error ? err.message : String(err)));
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (filter !== "all" && s.source !== filter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    });
  }, [filter, query, skills]);

  const sourceLabel = (src: SkillSourceKind) =>
    src === "personal" ? t.sourcePersonal
      : src === "builtin" ? t.sourceBuiltin
        : src === "project" ? t.sourceProject
          : t.sourcePlugin;

  const startCreate = () => {
    setFormId(undefined);
    setFormName("");
    setFormDesc("");
    setFormContent("---\nname: my-skill\ndescription: 描述技能用途\n---\n\n# 技能指令\n\n在这里编写执行步骤。");
    setExpectedRev(undefined);
    setEditing(true);
    setNotice(null);
  };

  const startEdit = (item: SkillDetail) => {
    setFormId(item.id);
    setFormName(item.name);
    setFormDesc(item.description);
    setFormContent(item.content);
    setExpectedRev(item.revision);
    setEditing(true);
    setNotice(null);
  };

  const handleSave = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const saved = await saveSkillRequest({
        ...(formId ? { id: formId } : {}),
        name: formName,
        description: formDesc,
        content: formContent,
        ...(typeof expectedRev === "number" ? { expectedRevision: expectedRev } : {}),
      });
      setEditing(false);
      setSelectedId(saved.id);
      setDetail(saved);
      setNotice(t.savedToast);
      await loadList(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleFork = async (id: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const forked = await forkSkillRequest(id);
      setSelectedId(forked.id);
      setDetail(forked);
      setNotice(t.forkedToast);
      await loadList(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (item: SkillDetail) => {
    setBusy(true);
    setNotice(null);
    try {
      await toggleSkillRequest(item.id, !item.enabled);
      await loadList(true);
      const nextDetail = await fetchSkillDetail(item.id);
      setDetail(nextDetail);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await deleteSkillRequest(id);
      setSelectedId(null);
      setDetail(null);
      await loadList(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t.title}</h2>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btn} onClick={() => void loadList(true)} disabled={busy}>
            <IconRefresh size={14} /> {t.refresh}
          </button>
          <button type="button" className={styles.btn} onClick={() => fileInputRef.current?.click()} disabled={busy}>
            <IconUpload size={14} /> {t.importSkill}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={startCreate} disabled={busy}>
            <IconPlus size={14} /> {t.newSkill}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                setFormId(undefined);
                setFormName(file.name.replace(/\.md$/iu, ""));
                setFormDesc("");
                setFormContent(text);
                setExpectedRev(undefined);
                setEditing(true);
              });
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          {(["all", "personal", "builtin", "project", "plugin"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.chipBtn} ${filter === key ? styles.chipBtnActive : ""}`}
              onClick={() => setFilter(key)}
            >
              {key === "all" ? t.filterAll : sourceLabel(key)}
            </button>
          ))}
        </div>
        <input
          className={styles.searchInput}
          value={query}
          placeholder={t.searchPlaceholder}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {notice && <div className={styles.notice} role="status">{notice}</div>}

      <div className={styles.bodyGrid}>
        <div className={styles.listPane}>
          {filtered.length === 0 ? (
            <p className={styles.emptyText}>{t.empty}</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.skillCard} ${selectedId === item.id && !editing ? styles.skillCardActive : ""}`}
                onClick={() => {
                  setEditing(false);
                  setSelectedId(item.id);
                }}
              >
                <div className={styles.skillCardTop}>
                  <span className={styles.skillName}>{item.name}</span>
                  <span className={styles.badge}>
                    {sourceLabel(item.source)} · {item.enabled ? t.enabled : t.disabled}
                  </span>
                </div>
                {item.description && <span className={styles.skillDesc}>{item.description}</span>}
              </button>
            ))
          )}
        </div>

        <div className={styles.detailPane}>
          {editing ? (
            <div className={styles.editorForm}>
              <label className={styles.field}>
                <span>{t.nameLabel}</span>
                <input className={styles.searchInput} value={formName} onChange={(e) => setFormName(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>{t.descLabel}</span>
                <input className={styles.searchInput} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>{t.contentLabel}</span>
                <textarea className={styles.textarea} value={formContent} onChange={(e) => setFormContent(e.target.value)} />
              </label>
              <div className={styles.detailActions}>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={() => void handleSave()}>
                  {t.saveAction}
                </button>
                <button type="button" className={styles.btn} disabled={busy} onClick={() => setEditing(false)}>
                  {t.cancelAction}
                </button>
              </div>
            </div>
          ) : detail ? (
            <div>
              <div className={styles.detailHeader}>
                <strong>{detail.name}</strong>
                <div className={styles.detailActions}>
                  <button type="button" className={styles.btn} disabled={busy} onClick={() => void handleToggle(detail)}>
                    {detail.enabled ? t.disableAction : t.enableAction}
                  </button>
                  {detail.editable ? (
                    <>
                      <button type="button" className={styles.btn} disabled={busy} onClick={() => startEdit(detail)}>
                        <IconEdit size={13} /> {t.editAction}
                      </button>
                      <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={busy} onClick={() => void handleDelete(detail.id)}>
                        <IconTrash size={13} /> {t.deleteAction}
                      </button>
                    </>
                  ) : (
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={() => void handleFork(detail.id)}>
                      <IconCopy size={13} /> {t.forkAction}
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.metaRow}>
                <span>{sourceLabel(detail.source)}</span>
                <span>{t.revisionNote}{detail.revision}</span>
                {detail.originSkillId && <span>{t.originNote}{detail.originSkillId}</span>}
              </div>
              <pre className={styles.contentPre}>{detail.content}</pre>
            </div>
          ) : (
            <p className={styles.emptyText}>{t.selectHint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
