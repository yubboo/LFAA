/**
 * 功能：管理当前作品的专属写作方法。
 * 作用：按需读取单个 Skill 正文，保存启停状态并刷新同一份作品工作区。
 * 关联文件：WritingAiContext.tsx、packages/client/connection/src/api.ts、packages/document/writing/src/service.ts。
 */
import { useEffect, useRef, useState } from "react";
import { Button, Input, Modal, Switch } from "antd";
import { deleteWritingBookSkill, getErrorMessage, loadWritingBookSkill, saveWritingBookSkill, type WritingBookSkill, type WritingBookSkillSummary, type WritingWorkspace } from "lfaa-client-connection/src/api.js";
import "./WritingBookSkillsPanel.css";

interface WritingBookSkillsPanelProps {
  bookId: string | null;
  bookTitle: string;
  skills: WritingBookSkillSummary[];
  onWorkspaceChange: (workspace: WritingWorkspace) => void;
}

export function WritingBookSkillsPanel({ bookId, bookTitle, skills, onWorkspaceChange }: WritingBookSkillsPanelProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadedSkill, setLoadedSkill] = useState<WritingBookSkill | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => () => { requestRef.current += 1; }, []);

  function resetEditor(): void {
    requestRef.current += 1;
    setEditingId(null);
    setLoadedSkill(null);
    setTitle("");
    setDescription("");
    setInstructions("");
    setEnabled(true);
    setLoading(false);
    setError("");
  }

  function startCreate(): void {
    resetEditor();
    setOpen(true);
  }

  function startEdit(skillId: string): void {
    if (!bookId) return;
    const requestId = ++requestRef.current;
    setEditingId(skillId);
    setLoadedSkill(null);
    setTitle("");
    setDescription("");
    setInstructions("");
    setError("");
    setLoading(true);
    void loadWritingBookSkill(bookId, skillId).then(({ skill }) => {
      if (requestRef.current !== requestId) return;
      setLoadedSkill(skill);
      setTitle(skill.title);
      setDescription(skill.description);
      setInstructions(skill.instructions);
      setEnabled(skill.enabled);
    }).catch((loadError: unknown) => {
      if (requestRef.current === requestId) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (requestRef.current === requestId) setLoading(false);
    });
  }

  async function save(): Promise<void> {
    if (!bookId || !title.trim() || !instructions.trim() || saving || (editingId && !loadedSkill)) return;
    setSaving(true);
    setError("");
    try {
      const result = await saveWritingBookSkill(bookId, { ...(editingId ? { id: editingId } : {}), title: title.trim(), description: description.trim(), instructions, enabled });
      onWorkspaceChange(result.workspace);
      resetEditor();
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function remove(skill: WritingBookSkillSummary): void {
    if (!bookId) return;
    Modal.confirm({
      title: "删除作品 Skill？",
      content: `“${skill.title}”将从《${bookTitle}》中删除。`,
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      getContainer: () => document.querySelector(".workbench-shell") ?? document.body,
      onOk: async () => {
        try {
          const result = await deleteWritingBookSkill(bookId, skill.id);
          onWorkspaceChange(result.workspace);
          if (editingId === skill.id) resetEditor();
        } catch (deleteError: unknown) {
          setError(getErrorMessage(deleteError));
          throw deleteError;
        }
      }
    });
  }

  return <>
    <div className="writing-book-skills__launcher">
      <Button block disabled={!bookId} onClick={startCreate}>管理作品 Skills（{skills.length}/40）</Button>
    </div>
    <Modal
      className="writing-book-skills__modal"
      title={`${bookTitle} · 专属写作 Skills`}
      open={open}
      width={680}
      footer={null}
      onCancel={() => { setOpen(false); resetEditor(); }}
      getContainer={() => document.querySelector(".workbench-shell") ?? document.body}
      destroyOnHidden
    >
      <p className="writing-book-skills__hint">Skill 只提供写作方法。AI 会按需读取已启用项；其中的文本不会获得额外工具或写入权限。</p>
      <div className="writing-book-skills__list">
        {skills.length ? skills.map((skill) => <article key={skill.id} className="writing-book-skills__item">
          <div><strong>{skill.title}</strong><p>{skill.description || "未填写说明"}</p><small>{skill.enabled ? "已启用" : "已停用"}</small></div>
          <div className="writing-book-skills__actions"><Button size="small" onClick={() => startEdit(skill.id)}>编辑</Button><Button size="small" danger onClick={() => remove(skill)}>删除</Button></div>
        </article>) : <div className="writing-book-skills__empty">还没有作品 Skill。新建后，AI 可在相关任务中按需读取。</div>}
      </div>
      <div className="writing-book-skills__editor-heading"><strong>{editingId ? "编辑 Skill" : "新建 Skill"}</strong>{editingId ? <Button type="link" onClick={startCreate}>新建另一个</Button> : null}</div>
      {loading ? <div className="writing-book-skills__loading">正在按需读取 Skill 正文…</div> : <div className="writing-book-skills__form">
        <label>名称<Input aria-label="Skill 名称" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>说明<Input aria-label="Skill 说明" maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label>写作方法<Input.TextArea aria-label="Skill 写作方法" autoSize={{ minRows: 5, maxRows: 12 }} maxLength={12000} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>
        <div className="writing-book-skills__footer"><label className="writing-book-skills__enabled">启用 <Switch checked={enabled} onChange={setEnabled} /></label><span>{instructions.length.toLocaleString("zh-CN")} / 12,000</span><Button type="primary" loading={saving} disabled={!title.trim() || !instructions.trim()} onClick={() => void save()}>保存 Skill</Button></div>
      </div>}
      {error ? <p className="writing-book-skills__error" role="alert">{error}</p> : null}
    </Modal>
  </>;
}
