/**
 * 功能：管理当前作品的世界观、人物、剧情与素材资料。
 * 作用：通过账户认证 API 分页读取目录元数据，并在需要时加载单条正文进行编辑。
 * 不负责：AI 资料解释或写作权限；AI 只读上下文由服务端业务工具提供。
 * 关联文件：WritingWorkspace.tsx、packages/client/connection/src/api.ts、packages/document/writing/src/service.ts。
 */
import { useEffect, useRef, useState } from "react";
import { Button, Input, Modal, Pagination, Select, Spin } from "antd";
import {
  createWritingCatalogEntry,
  deleteWritingCatalogEntry,
  getErrorMessage,
  listWritingCatalogEntries,
  loadWritingCatalogEntry,
  saveWritingCatalogEntry,
  type WritingCatalogEntry,
  type WritingCatalogKind,
  type WritingCatalogSummary
} from "lfaa-client-connection/src/api.js";
import "./WritingCatalogPanel.css";

const catalogKinds: Array<{ value: WritingCatalogKind; label: string }> = [
  { value: "world-rule", label: "世界观 · 规则" }, { value: "world-faction", label: "世界观 · 势力" },
  { value: "world-geography", label: "世界观 · 地理" }, { value: "world-history", label: "世界观 · 历史" },
  { value: "world-term", label: "世界观 · 术语" }, { value: "world-realm", label: "世界观 · 境界" },
  { value: "world-item", label: "世界观 · 物品" }, { value: "world-reveal", label: "世界观 · 揭秘" },
  { value: "character-protagonist", label: "人物 · 主角" }, { value: "character-major", label: "人物 · 主要角色" },
  { value: "character-secondary", label: "人物 · 次要角色" }, { value: "character-extra", label: "人物 · 路人" },
  { value: "plot-storyline", label: "剧情 · 故事线" }, { value: "plot-point", label: "剧情 · 情节点" },
  { value: "plot-foreshadow", label: "剧情 · 伏笔" }, { value: "plot-card", label: "剧情 · 卡片" },
  { value: "material", label: "素材" }
];

interface WritingCatalogPanelProps { bookId: string | null; bookTitle: string }

export function WritingCatalogPanel({ bookId, bookTitle }: WritingCatalogPanelProps) {
  const [open, setOpen] = useState(false);
  const [sessionBook, setSessionBook] = useState<{ id: string; title: string } | null>(null);
  const [kind, setKind] = useState<WritingCatalogKind>("world-rule");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<{ entries: WritingCatalogSummary[]; offset: number; limit: number; total: number } | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entry, setEntry] = useState<WritingCatalogEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const discardActionRef = useRef<(() => void) | null>(null);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const dirty = Boolean(entry && (title !== entry.title || content !== entry.content));

  useEffect(() => {
    if (!open || !sessionBook) return;
    const requestId = ++listRequestRef.current;
    setEntriesLoading(true);
    setError("");
    void listWritingCatalogEntries(sessionBook.id, kind, offset, search).then(({ page: result }) => {
      if (listRequestRef.current === requestId) setPage(result);
    }).catch((loadError: unknown) => {
      if (listRequestRef.current === requestId) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (listRequestRef.current === requestId) setEntriesLoading(false);
    });
    return () => { listRequestRef.current += 1; };
  }, [kind, offset, open, refreshVersion, search, sessionBook]);

  useEffect(() => () => { detailRequestRef.current += 1; }, []);

  function show(): void {
    if (!bookId) return;
    detailRequestRef.current += 1;
    setSessionBook({ id: bookId, title: bookTitle });
    setKind("world-rule");
    setOffset(0);
    setSearch("");
    setSearchDraft("");
    setPage(null);
    setEntry(null);
    setSelectedId(null);
    setTitle("");
    setContent("");
    setNewTitle("");
    setError("");
    setOpen(true);
  }

  function continueAfterDiscard(action: () => void): void {
    if (!dirty) { action(); return; }
    discardActionRef.current = action;
    setDiscardConfirmOpen(true);
  }

  function confirmDiscard(): void {
    setDiscardConfirmOpen(false);
    const action = discardActionRef.current;
    discardActionRef.current = null;
    action?.();
  }

  function close(): void {
    continueAfterDiscard(() => { detailRequestRef.current += 1; setOpen(false); });
  }

  function resetSelection(action: () => void): void {
    continueAfterDiscard(() => {
      detailRequestRef.current += 1;
      setDetailLoading(false);
      setSelectedId(null);
      setEntry(null);
      setTitle("");
      setContent("");
      action();
    });
  }

  function selectEntry(summary: WritingCatalogSummary): void {
    if (summary.id === selectedId) return;
    continueAfterDiscard(() => {
      const requestId = ++detailRequestRef.current;
      setSelectedId(summary.id);
      setEntry(null);
      setTitle("");
      setContent("");
      setDetailLoading(true);
      setError("");
      void loadWritingCatalogEntry(summary.id).then(({ entry: result }) => {
        if (detailRequestRef.current !== requestId) return;
        setEntry(result);
        setTitle(result.title);
        setContent(result.content);
      }).catch((loadError: unknown) => {
        if (detailRequestRef.current === requestId) setError(getErrorMessage(loadError));
      }).finally(() => {
        if (detailRequestRef.current === requestId) setDetailLoading(false);
      });
    });
  }

  function createEntry(): void {
    const normalizedTitle = newTitle.trim();
    if (!sessionBook || !normalizedTitle || creating) return;
    continueAfterDiscard(() => void performCreate(normalizedTitle));
  }

  async function performCreate(normalizedTitle: string): Promise<void> {
    if (!sessionBook || creating) return;
    setCreating(true);
    setError("");
    try {
      const result = await createWritingCatalogEntry(sessionBook.id, kind, normalizedTitle);
      setEntry(result.entry);
      setSelectedId(result.entry.id);
      setTitle(result.entry.title);
      setContent(result.entry.content);
      setNewTitle("");
      setRefreshVersion((version) => version + 1);
    } catch (createError: unknown) {
      setError(getErrorMessage(createError));
    } finally {
      setCreating(false);
    }
  }

  async function saveEntry(): Promise<void> {
    if (!entry || saving || !title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await saveWritingCatalogEntry(entry.id, title.trim(), content);
      setEntry(result.entry);
      setTitle(result.entry.title);
      setContent(result.entry.content);
      setRefreshVersion((version) => version + 1);
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function deleteEntry(): void {
    if (!entry || deleting) return;
    Modal.confirm({
      title: "删除这条作品资料？",
      content: `“${entry.title}”将从当前作品中删除。`,
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      getContainer: () => document.querySelector(".workbench-shell") ?? document.body,
      onOk: async () => {
        setDeleting(true);
        setError("");
        try {
          await deleteWritingCatalogEntry(entry.id);
          setEntry(null);
          setSelectedId(null);
          setTitle("");
          setContent("");
          setRefreshVersion((version) => version + 1);
        } catch (deleteError: unknown) {
          setError(getErrorMessage(deleteError));
          throw deleteError;
        } finally {
          setDeleting(false);
        }
      }
    });
  }

  return <>
    <div className="writing-catalog-panel__launcher">
      <Button block disabled={!bookId} onClick={show}>作品资料库</Button>
    </div>
    <Modal
      className="writing-catalog-panel__modal"
      title={sessionBook ? `${sessionBook.title} · 作品资料` : "作品资料"}
      open={open}
      width={960}
      footer={null}
      onCancel={close}
      getContainer={() => document.querySelector(".workbench-shell") ?? document.body}
    >
      <div className="writing-catalog-panel__toolbar">
        <Select aria-label="资料类别" value={kind} options={catalogKinds} disabled={entriesLoading || creating || saving} onChange={(value: WritingCatalogKind) => resetSelection(() => { setKind(value); setOffset(0); })} />
        <Input.Search aria-label="按标题搜索" placeholder="按标题搜索" value={searchDraft} disabled={entriesLoading} onChange={(event) => setSearchDraft(event.target.value)} onSearch={(value) => resetSelection(() => { setSearch(value.trim().slice(0, 100)); setOffset(0); })} maxLength={100} />
      </div>
      <div className="writing-catalog-panel__create">
        <Input aria-label="新资料标题" placeholder="新建资料标题" maxLength={120} value={newTitle} disabled={creating} onChange={(event) => setNewTitle(event.target.value)} onPressEnter={() => void createEntry()} />
        <Button type="primary" disabled={!newTitle.trim() || entriesLoading} loading={creating} onClick={() => void createEntry()}>新建</Button>
      </div>
      <div className="writing-catalog-panel__body">
        <section className="writing-catalog-panel__list" aria-label="作品资料列表" aria-busy={entriesLoading}>
          {entriesLoading ? <div className="writing-catalog-panel__loading"><Spin size="small" /></div> : page?.entries.length ? page.entries.map((summary) => <button
            key={summary.id}
            type="button"
            className={`writing-catalog-panel__item${summary.id === selectedId ? " is-active" : ""}`}
            disabled={detailLoading || saving || deleting}
            onClick={() => selectEntry(summary)}
          >
            <span>{summary.title}</span>
            <small>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(summary.updatedAt))}</small>
          </button>) : <div className="writing-catalog-panel__empty">{error ? "资料列表读取失败" : "这个类别还没有资料"}</div>}
          {page && page.total > page.limit ? <Pagination
            size="small"
            current={Math.floor(page.offset / page.limit) + 1}
            pageSize={page.limit}
            total={page.total}
            showSizeChanger={false}
            disabled={entriesLoading}
            onChange={(nextPage) => setOffset((nextPage - 1) * page.limit)}
          /> : null}
        </section>
        <section className="writing-catalog-panel__editor" aria-label="作品资料编辑器" aria-busy={detailLoading || saving}>
          {detailLoading ? <div className="writing-catalog-panel__loading"><Spin size="small" /></div> : entry ? <>
            <Input aria-label="资料标题" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
            <Input.TextArea aria-label="资料正文" className="writing-catalog-panel__content" value={content} maxLength={1_500_000} onChange={(event) => setContent(event.target.value)} placeholder="写下与当前作品相关的资料" />
            <div className="writing-catalog-panel__editor-footer">
              <span>{entry.wordCount.toLocaleString("zh-CN")} 字 · 最近更新 {new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.updatedAt))}</span>
              <div><Button danger disabled={saving || deleting} loading={deleting} onClick={deleteEntry}>删除</Button><Button type="primary" disabled={!dirty || !title.trim() || deleting} loading={saving} onClick={() => void saveEntry()}>保存</Button></div>
            </div>
          </> : <div className="writing-catalog-panel__empty">选择左侧资料，或新建一条资料。</div>}
        </section>
      </div>
      {error ? <p className="writing-catalog-panel__error" role="alert">{error}</p> : null}
      <Modal
        title="放弃未保存的修改？"
        open={discardConfirmOpen}
        okText="放弃修改"
        cancelText="继续编辑"
        okButtonProps={{ danger: true }}
        onOk={confirmDiscard}
        onCancel={() => { setDiscardConfirmOpen(false); discardActionRef.current = null; }}
        getContainer={() => document.querySelector(".workbench-shell") ?? document.body}
      >
        <p>当前资料的修改尚未保存。</p>
      </Modal>
    </Modal>
  </>;
}
