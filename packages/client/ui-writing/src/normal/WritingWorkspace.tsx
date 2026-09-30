/**
 * 功能：提供写作空间常规模式的作品大纲、卷、章节与中央编辑区。
 * 作用：大纲和正文通过控制端 API 自动保存到当前账户的 SQLite 数据，并分别保留最近修订以供恢复。
 * 不负责：任意本机路径文件操作或 AI 工具的审批；模型写入由服务端业务工具处理。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、WritingWorkspace.css。
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Button, Input, Modal, Spin, Tooltip } from "antd";
import { createWritingBook, createWritingCatalogEntry as createWritingCatalogEntryRequest, createWritingChapter, createWritingVolume, deleteWritingBook, deleteWritingCatalogEntry as deleteWritingCatalogEntryRequest, deleteWritingChapter, getErrorMessage, loadWritingBookOutlineRevisions, loadWritingCatalogEntry, loadWritingChapterRevisions, loadWritingWorkspace, renameWritingBook, restoreWritingBookOutlineRevision, restoreWritingChapterRevision, saveWritingBookOutline, saveWritingCatalogEntry, saveWritingChapter, selectWritingLocation, type AiExtension, type WritingCatalogEntry, type WritingCatalogKind, type WritingWorkspace as WritingWorkspaceData } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon, type WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import "./WritingWorkspace.css";

interface WritingWorkspaceProps {
  workspace: WritingWorkspaceData | null;
  loading: boolean;
  loadError: string;
  onRetry: () => void;
  writingSkills: AiExtension[];
  skillsLoading: boolean;
  onWorkspaceChange: (workspace: WritingWorkspaceData) => void;
  onRegisterFlush: (flush: (() => Promise<void>) | null) => void;
}

type SaveState = "saved" | "dirty" | "saving" | "error";
type WritingPanel = "writing" | "catalog" | "character-overview" | "continuity-pending" | "continuity-records" | "skills";

const catalogGroups: Array<{ id: string; title: string; icon: WorkbenchIconName; categories: Array<{ kind: WritingCatalogKind; label: string }> }> = [
  { id: "world", title: "世界观", icon: "browser", categories: [
    { kind: "world-rule", label: "规则" }, { kind: "world-faction", label: "势力" }, { kind: "world-geography", label: "地理" },
    { kind: "world-history", label: "历史" }, { kind: "world-term", label: "术语" }, { kind: "world-realm", label: "境界" },
    { kind: "world-item", label: "物品" }, { kind: "world-reveal", label: "世界观揭露" }
  ] },
  { id: "characters", title: "人物设计", icon: "user", categories: [
    { kind: "character-protagonist", label: "主角" }, { kind: "character-major", label: "主要配角" },
    { kind: "character-secondary", label: "次要配角" }, { kind: "character-extra", label: "路人" }
  ] },
  { id: "plot", title: "剧情设计", icon: "history", categories: [
    { kind: "plot-storyline", label: "全书故事线" }, { kind: "plot-point", label: "剧情点" },
    { kind: "plot-foreshadow", label: "伏笔总览" }, { kind: "plot-card", label: "章卡" }
  ] }
];

function entryWordCount(value: string): number {
  const cjkCharacters = [...value.matchAll(/\p{Script=Han}/gu)].length;
  const otherWords = [...value.replace(/\p{Script=Han}/gu, " ").matchAll(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)].length;
  return cjkCharacters + otherWords;
}

function wordCount(value: string): number {
  const cjkCharacters = [...value.matchAll(/\p{Script=Han}/gu)].length;
  const otherWords = [...value.replace(/\p{Script=Han}/gu, " ").matchAll(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)].length;
  return cjkCharacters + otherWords;
}

export function WritingWorkspace({ workspace, loading, loadError, writingSkills, skillsLoading, onRetry, onWorkspaceChange, onRegisterFlush }: WritingWorkspaceProps) {
  const chapter = workspace?.activeChapter ?? null;
  const activeBookId = workspace?.activeBookId ?? null;
  const [isOutlineActive, setIsOutlineActive] = useState(false);
  const [activePanel, setActivePanel] = useState<WritingPanel>("writing");
  const [activeCatalogKind, setActiveCatalogKind] = useState<WritingCatalogKind>("world-rule");
  const [activeCatalogEntryId, setActiveCatalogEntryId] = useState<string | null>(null);
  const [catalogEntry, setCatalogEntry] = useState<WritingCatalogEntry | null>(null);
  const [catalogTitle, setCatalogTitle] = useState("");
  const [catalogContent, setCatalogContent] = useState("");
  const [catalogSaveState, setCatalogSaveState] = useState<SaveState>("saved");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [createCatalogOpen, setCreateCatalogOpen] = useState(false);
  const [createCatalogKind, setCreateCatalogKind] = useState<WritingCatalogKind>("world-rule");
  const [createCatalogTitle, setCreateCatalogTitle] = useState("");
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [outlineContent, setOutlineContent] = useState(workspace?.activeBookOutline ?? "");
  const [outlineSaveState, setOutlineSaveState] = useState<SaveState>("saved");
  const [chapterTitle, setChapterTitle] = useState(chapter?.title ?? "");
  const [content, setContent] = useState(chapter?.content ?? "");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [createBookOpen, setCreateBookOpen] = useState(false);
  const [bookTitleDraft, setBookTitleDraft] = useState("");
  const [createVolumeOpen, setCreateVolumeOpen] = useState(false);
  const [volumeTitleDraft, setVolumeTitleDraft] = useState("");
  const [renameBookOpen, setRenameBookOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisions, setRevisions] = useState<Array<{ id: string; title: string; createdAt: string; wordCount: number }>>([]);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [libraryPortalTarget, setLibraryPortalTarget] = useState<HTMLElement | null>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const catalogEntryRef = useRef(catalogEntry);
  catalogEntryRef.current = catalogEntry;
  const catalogDraftRef = useRef({ id: activeCatalogEntryId, title: catalogTitle, content: catalogContent });
  catalogDraftRef.current = { id: activeCatalogEntryId, title: catalogTitle, content: catalogContent };
  const catalogSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const catalogSaveTimerRef = useRef<number | null>(null);
  const saveCatalogSnapshotRef = useRef<(snapshot: { id: string; title: string; content: string }) => Promise<void>>(async () => undefined);

  useEffect(() => {
    setLibraryPortalTarget(document.querySelector<HTMLElement>(".module-sidebar__writing-library-portal"));
  }, []);
  const synchronizedRef = useRef({ chapterId: chapter?.id ?? null, title: chapter?.title ?? "", content: chapter?.content ?? "" });
  const draftRef = useRef({ chapterId: chapter?.id ?? null, title: chapterTitle, content });
  draftRef.current = { chapterId: chapter?.id ?? null, title: chapterTitle, content };
  const synchronizedOutlineRef = useRef({ bookId: activeBookId, content: workspace?.activeBookOutline ?? "" });
  const outlineDraftRef = useRef({ bookId: activeBookId, content: outlineContent });
  outlineDraftRef.current = { bookId: activeBookId, content: outlineContent };
  const outlineActiveRef = useRef(isOutlineActive);
  outlineActiveRef.current = isOutlineActive;
  const mountedRef = useRef(true);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const saveTimerRef = useRef<number | null>(null);
  const outlineSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const outlineSaveTimerRef = useRef<number | null>(null);
  const saveSnapshotRef = useRef<(snapshot: { chapterId: string; title: string; content: string }) => Promise<void>>(async () => undefined);
  const saveOutlineSnapshotRef = useRef<(snapshot: { bookId: string; content: string }) => Promise<void>>(async () => undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      if (outlineSaveTimerRef.current !== null) window.clearTimeout(outlineSaveTimerRef.current);
      if (catalogSaveTimerRef.current !== null) window.clearTimeout(catalogSaveTimerRef.current);
      if (catalogEntryRef.current && catalogDraftRef.current.id === catalogEntryRef.current.id && (catalogDraftRef.current.title !== catalogEntryRef.current.title || catalogDraftRef.current.content !== catalogEntryRef.current.content)) {
        void saveCatalogSnapshotRef.current(catalogDraftRef.current as { id: string; title: string; content: string }).catch(() => undefined);
      } else if (outlineActiveRef.current) {
        const pendingOutline = outlineDraftRef.current;
        if (pendingOutline.bookId && pendingOutline.bookId === synchronizedOutlineRef.current.bookId && pendingOutline.content !== synchronizedOutlineRef.current.content) {
          void saveOutlineSnapshotRef.current({ bookId: pendingOutline.bookId, content: pendingOutline.content }).catch(() => undefined);
        }
      } else {
        const pending = draftRef.current;
        if (pending.chapterId && pending.chapterId === synchronizedRef.current.chapterId && (pending.title !== synchronizedRef.current.title || pending.content !== synchronizedRef.current.content)) {
          void saveSnapshotRef.current({ chapterId: pending.chapterId, title: pending.title, content: pending.content }).catch(() => undefined);
        }
      }
    };
  }, []);

  useEffect(() => {
    const nextBookId = workspace?.activeBookId ?? null;
    if (nextBookId === synchronizedOutlineRef.current.bookId) return;
    const nextContent = workspace?.activeBookOutline ?? "";
    synchronizedOutlineRef.current = { bookId: nextBookId, content: nextContent };
    setOutlineContent(nextContent);
    setOutlineSaveState("saved");
    setIsOutlineActive(false);
    setActivePanel("writing");
    setActiveCatalogEntryId(null);
    setCatalogEntry(null);
  }, [workspace?.activeBookId, workspace?.activeBookOutline]);

  useEffect(() => {
    const next = workspace?.activeChapter ?? null;
    if (next?.id === synchronizedRef.current.chapterId) return;
    synchronizedRef.current = { chapterId: next?.id ?? null, title: next?.title ?? "", content: next?.content ?? "" };
    setChapterTitle(next?.title ?? "");
    setContent(next?.content ?? "");
    setSaveState("saved");
    setError("");
  }, [workspace?.activeChapter?.id]);

  const saveSnapshot = useCallback(async (snapshot: { chapterId: string; title: string; content: string }): Promise<void> => {
    const known = synchronizedRef.current;
    if (known.chapterId === snapshot.chapterId && known.title === snapshot.title && known.content === snapshot.content) return;
    const operation = saveChainRef.current.then(async () => {
      if (mountedRef.current && draftRef.current.chapterId === snapshot.chapterId) setSaveState("saving");
      const result = await saveWritingChapter(snapshot.chapterId, snapshot.title, snapshot.content);
      synchronizedRef.current = { chapterId: result.chapter.id, title: result.chapter.title, content: result.chapter.content };
      const currentWorkspace = workspaceRef.current;
      if (currentWorkspace?.activeChapterId === snapshot.chapterId && currentWorkspace.activeBookId === result.chapter.bookId) {
        const next = {
          ...currentWorkspace,
          activeChapter: result.chapter,
          chapters: currentWorkspace.chapters.map((item) => item.id === result.chapter.id ? {
            id: result.chapter.id,
            volumeId: result.chapter.volumeId,
            title: result.chapter.title,
            sortOrder: result.chapter.sortOrder,
            updatedAt: result.chapter.updatedAt,
            wordCount: result.chapter.wordCount
          } : item),
          books: currentWorkspace.books.map((item) => item.id === result.chapter.bookId ? { ...item, updatedAt: result.chapter.updatedAt } : item)
        };
        workspaceRef.current = next;
        onWorkspaceChange(next);
      }
      const latestDraft = draftRef.current;
      if (mountedRef.current && latestDraft.chapterId === snapshot.chapterId && latestDraft.title === snapshot.title && latestDraft.content === snapshot.content) {
        setSaveState("saved");
        setError("");
      }
    });
    saveChainRef.current = operation.then(() => undefined, () => undefined);
    try {
      await operation;
    } catch (saveError: unknown) {
      if (mountedRef.current && draftRef.current.chapterId === snapshot.chapterId) {
        setSaveState("error");
        setError(getErrorMessage(saveError));
      }
      throw saveError;
    }
  }, [onWorkspaceChange]);
  saveSnapshotRef.current = saveSnapshot;

  const saveOutlineSnapshot = useCallback(async (snapshot: { bookId: string; content: string }): Promise<void> => {
    const known = synchronizedOutlineRef.current;
    if (known.bookId === snapshot.bookId && known.content === snapshot.content) return;
    const operation = outlineSaveChainRef.current.then(async () => {
      if (mountedRef.current && outlineDraftRef.current.bookId === snapshot.bookId) setOutlineSaveState("saving");
      const result = await saveWritingBookOutline(snapshot.bookId, snapshot.content);
      synchronizedOutlineRef.current = { bookId: result.outline.bookId, content: result.outline.content };
      const currentWorkspace = workspaceRef.current;
      if (currentWorkspace?.activeBookId === result.outline.bookId) {
        const next = {
          ...currentWorkspace,
          activeBookOutline: result.outline.content,
          books: currentWorkspace.books.map((item) => item.id === result.outline.bookId ? { ...item, updatedAt: result.outline.updatedAt } : item)
        };
        workspaceRef.current = next;
        onWorkspaceChange(next);
      }
      const latestDraft = outlineDraftRef.current;
      if (mountedRef.current && latestDraft.bookId === snapshot.bookId && latestDraft.content === snapshot.content) {
        setOutlineSaveState("saved");
        setError("");
      }
    });
    outlineSaveChainRef.current = operation.then(() => undefined, () => undefined);
    try {
      await operation;
    } catch (saveError: unknown) {
      if (mountedRef.current && outlineDraftRef.current.bookId === snapshot.bookId) {
        setOutlineSaveState("error");
        setError(getErrorMessage(saveError));
      }
      throw saveError;
    }
  }, [onWorkspaceChange]);
  saveOutlineSnapshotRef.current = saveOutlineSnapshot;

  const saveCatalogSnapshot = useCallback(async (snapshot: { id: string; title: string; content: string }): Promise<void> => {
    const known = catalogEntryRef.current;
    if (known?.id === snapshot.id && known.title === snapshot.title && known.content === snapshot.content) return;
    const operation = catalogSaveChainRef.current.then(async () => {
      if (mountedRef.current && catalogDraftRef.current.id === snapshot.id) setCatalogSaveState("saving");
      const result = await saveWritingCatalogEntry(snapshot.id, snapshot.title, snapshot.content);
      catalogEntryRef.current = result.entry;
      if (mountedRef.current && catalogDraftRef.current.id === snapshot.id) setCatalogEntry(result.entry);
      const currentWorkspace = workspaceRef.current;
      if (currentWorkspace?.activeBookId === result.entry.bookId) {
        const next = {
          ...currentWorkspace,
          catalogEntries: currentWorkspace.catalogEntries.map((item) => item.id === result.entry.id ? {
            id: result.entry.id,
            kind: result.entry.kind,
            title: result.entry.title,
            updatedAt: result.entry.updatedAt,
            wordCount: result.entry.wordCount
          } : item)
        };
        workspaceRef.current = next;
        onWorkspaceChange(next);
      }
      const latestDraft = catalogDraftRef.current;
      if (mountedRef.current && latestDraft.id === snapshot.id && latestDraft.title === snapshot.title && latestDraft.content === snapshot.content) {
        setCatalogSaveState("saved");
        setError("");
      }
    });
    catalogSaveChainRef.current = operation.then(() => undefined, () => undefined);
    try {
      await operation;
    } catch (saveError: unknown) {
      if (mountedRef.current && catalogDraftRef.current.id === snapshot.id) {
        setCatalogSaveState("error");
        setError(getErrorMessage(saveError));
      }
      throw saveError;
    }
  }, [onWorkspaceChange]);
  saveCatalogSnapshotRef.current = saveCatalogSnapshot;

  const flushSave = useCallback(async (): Promise<void> => {
    if (activePanel === "catalog" && activeCatalogEntryId) {
      if (catalogSaveTimerRef.current !== null) {
        window.clearTimeout(catalogSaveTimerRef.current);
        catalogSaveTimerRef.current = null;
      }
      const pendingEntry = catalogDraftRef.current;
      const knownEntry = catalogEntryRef.current;
      if (knownEntry?.id === pendingEntry.id && (pendingEntry.title !== knownEntry.title || pendingEntry.content !== knownEntry.content)) {
        await saveCatalogSnapshot({ id: pendingEntry.id!, title: pendingEntry.title, content: pendingEntry.content });
      }
      return;
    }
    if (isOutlineActive) {
      if (outlineSaveTimerRef.current !== null) {
        window.clearTimeout(outlineSaveTimerRef.current);
        outlineSaveTimerRef.current = null;
      }
      const pendingOutline = outlineDraftRef.current;
      if (pendingOutline.bookId && (pendingOutline.bookId !== synchronizedOutlineRef.current.bookId || pendingOutline.content !== synchronizedOutlineRef.current.content)) {
        await saveOutlineSnapshot({ bookId: pendingOutline.bookId, content: pendingOutline.content });
      }
      return;
    }
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = draftRef.current;
    if (pending.chapterId && (pending.title !== synchronizedRef.current.title || pending.content !== synchronizedRef.current.content)) {
      await saveSnapshot({ chapterId: pending.chapterId, title: pending.title, content: pending.content });
    }
  }, [activeCatalogEntryId, activePanel, isOutlineActive, saveCatalogSnapshot, saveOutlineSnapshot, saveSnapshot]);

  useEffect(() => {
    onRegisterFlush(flushSave);
    return () => onRegisterFlush(null);
  }, [flushSave, onRegisterFlush]);

  useEffect(() => {
    if (!chapter || synchronizedRef.current.chapterId !== chapter.id) return;
    if (chapterTitle === synchronizedRef.current.title && content === synchronizedRef.current.content) return;
    setSaveState("dirty");
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    const snapshot = { chapterId: chapter.id, title: chapterTitle, content };
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveSnapshot(snapshot).catch(() => undefined);
    }, 750);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [chapter?.id, chapterTitle, content, saveSnapshot]);

  useEffect(() => {
    if (!isOutlineActive || !activeBookId || synchronizedOutlineRef.current.bookId !== activeBookId) return;
    if (outlineContent === synchronizedOutlineRef.current.content) return;
    setOutlineSaveState("dirty");
    if (outlineSaveTimerRef.current !== null) window.clearTimeout(outlineSaveTimerRef.current);
    const snapshot = { bookId: activeBookId, content: outlineContent };
    outlineSaveTimerRef.current = window.setTimeout(() => {
      outlineSaveTimerRef.current = null;
      void saveOutlineSnapshot(snapshot).catch(() => undefined);
    }, 750);
    return () => {
      if (outlineSaveTimerRef.current !== null) window.clearTimeout(outlineSaveTimerRef.current);
      outlineSaveTimerRef.current = null;
    };
  }, [activeBookId, isOutlineActive, outlineContent, saveOutlineSnapshot]);

  useEffect(() => {
    if (activePanel !== "catalog" || !activeCatalogEntryId || catalogEntry?.id !== activeCatalogEntryId) return;
    if (catalogTitle === catalogEntry.title && catalogContent === catalogEntry.content) return;
    setCatalogSaveState("dirty");
    if (catalogSaveTimerRef.current !== null) window.clearTimeout(catalogSaveTimerRef.current);
    const snapshot = { id: activeCatalogEntryId, title: catalogTitle, content: catalogContent };
    catalogSaveTimerRef.current = window.setTimeout(() => {
      catalogSaveTimerRef.current = null;
      void saveCatalogSnapshot(snapshot).catch(() => undefined);
    }, 750);
    return () => {
      if (catalogSaveTimerRef.current !== null) window.clearTimeout(catalogSaveTimerRef.current);
      catalogSaveTimerRef.current = null;
    };
  }, [activeCatalogEntryId, activePanel, catalogContent, catalogEntry, catalogTitle, saveCatalogSnapshot]);

  async function showPanel(panel: WritingPanel): Promise<void> {
    await flushSave();
    setActivePanel(panel);
    setIsOutlineActive(false);
    setActiveCatalogEntryId(null);
    setCatalogEntry(null);
    setCatalogTitle("");
    setCatalogContent("");
    if (panel !== "skills") setActiveSkillId(null);
  }

  async function selectCatalogCategory(kind: WritingCatalogKind): Promise<void> {
    await flushSave();
    setActivePanel("catalog");
    setActiveCatalogKind(kind);
    setIsOutlineActive(false);
    setActiveCatalogEntryId(null);
    setCatalogEntry(null);
    setCatalogTitle("");
    setCatalogContent("");
  }

  async function selectCatalogEntry(entryId: string): Promise<void> {
    await flushSave();
    setCatalogLoading(true);
    setError("");
    try {
      const result = await loadWritingCatalogEntry(entryId);
      setActivePanel("catalog");
      setIsOutlineActive(false);
      setActiveCatalogKind(result.entry.kind);
      setActiveCatalogEntryId(result.entry.id);
      setCatalogEntry(result.entry);
      catalogEntryRef.current = result.entry;
      setCatalogTitle(result.entry.title);
      setCatalogContent(result.entry.content);
      setCatalogSaveState("saved");
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      setCatalogLoading(false);
    }
  }

  function startCatalogEntry(kind: WritingCatalogKind): void {
    setCreateCatalogKind(kind);
    setCreateCatalogTitle("");
    setCreateCatalogOpen(true);
  }

  async function createCatalogEntry(): Promise<void> {
    if (!activeBookId) return;
    const title = createCatalogTitle.trim();
    if (!title) return;
    setActionBusy(true);
    setError("");
    try {
      await flushSave();
      const result = await createWritingCatalogEntryRequest(activeBookId, createCatalogKind, title);
      const current = workspaceRef.current;
      if (current?.activeBookId === result.entry.bookId) {
        const next = { ...current, catalogEntries: [
          { id: result.entry.id, kind: result.entry.kind, title: result.entry.title, updatedAt: result.entry.updatedAt, wordCount: result.entry.wordCount },
          ...current.catalogEntries
        ] };
        workspaceRef.current = next;
        onWorkspaceChange(next);
      }
      setActivePanel("catalog");
      setActiveCatalogKind(result.entry.kind);
      setActiveCatalogEntryId(result.entry.id);
      setCatalogEntry(result.entry);
      catalogEntryRef.current = result.entry;
      setCatalogTitle(result.entry.title);
      setCatalogContent(result.entry.content);
      setCatalogSaveState("saved");
      setCreateCatalogOpen(false);
    } catch (createError: unknown) {
      setError(getErrorMessage(createError));
    } finally {
      setActionBusy(false);
    }
  }

  async function removeCatalogEntry(): Promise<void> {
    if (!catalogEntry) return;
    Modal.confirm({
      title: `删除“${catalogEntry.title}”？`,
      content: "此条目及其正文将被永久删除。",
      okText: "删除条目",
      cancelText: "取消",
      okButtonProps: { danger: true },
      getContainer: () => document.querySelector(".workbench-shell") ?? document.body,
      onOk: async () => {
        await flushSave();
        await deleteWritingCatalogEntryRequest(catalogEntry.id);
        const current = workspaceRef.current;
        if (current?.activeBookId === catalogEntry.bookId) {
          const next = { ...current, catalogEntries: current.catalogEntries.filter((item) => item.id !== catalogEntry.id) };
          workspaceRef.current = next;
          onWorkspaceChange(next);
        }
        setActiveCatalogEntryId(null);
        setCatalogEntry(null);
        setCatalogTitle("");
        setCatalogContent("");
        setActivePanel("catalog");
      }
    });
  }

  async function selectBook(bookId: string): Promise<void> {
    await flushSave();
    setActionBusy(true);
    setError("");
    try {
      const result = await selectWritingLocation(bookId, null);
      setIsOutlineActive(false);
      setActivePanel("writing");
      setActiveCatalogEntryId(null);
      setCatalogEntry(null);
      workspaceRef.current = result.workspace;
      onWorkspaceChange(result.workspace);
    } catch (selectError: unknown) {
      setError(getErrorMessage(selectError));
    } finally {
      setActionBusy(false);
    }
  }

  async function selectChapter(chapterId: string): Promise<void> {
    if (!workspace?.activeBookId) return;
    await flushSave();
    setActionBusy(true);
    setError("");
    try {
      const result = await selectWritingLocation(workspace.activeBookId, chapterId);
      setIsOutlineActive(false);
      setActivePanel("writing");
      setActiveCatalogEntryId(null);
      setCatalogEntry(null);
      workspaceRef.current = result.workspace;
      onWorkspaceChange(result.workspace);
    } catch (selectError: unknown) {
      setError(getErrorMessage(selectError));
    } finally {
      setActionBusy(false);
    }
  }

  async function selectOutline(): Promise<void> {
    if (!activeBookId) return;
    try {
      await flushSave();
      setError("");
      setIsOutlineActive(true);
      setActivePanel("writing");
      setActiveCatalogEntryId(null);
      setCatalogEntry(null);
    } catch (flushError: unknown) {
      setError(getErrorMessage(flushError));
    }
  }

  async function createBook(): Promise<void> {
    const title = bookTitleDraft.trim();
    if (!title) return;
    setActionBusy(true);
    setError("");
    try {
      await flushSave();
      const result = await createWritingBook(title);
      workspaceRef.current = result.workspace;
      onWorkspaceChange(result.workspace);
      setBookTitleDraft("");
      setCreateBookOpen(false);
    } catch (createError: unknown) {
      setError(getErrorMessage(createError));
    } finally {
      setActionBusy(false);
    }
  }

  async function createVolume(): Promise<void> {
    if (!workspace?.activeBookId) return;
    const title = volumeTitleDraft.trim();
    if (!title) return;
    setActionBusy(true);
    setError("");
    try {
      await flushSave();
      const result = await createWritingVolume(workspace.activeBookId, title);
      workspaceRef.current = result.workspace;
      onWorkspaceChange(result.workspace);
      setVolumeTitleDraft("");
      setCreateVolumeOpen(false);
    } catch (createError: unknown) {
      setError(getErrorMessage(createError));
    } finally {
      setActionBusy(false);
    }
  }

  async function addChapter(volumeId: string): Promise<void> {
    if (!workspace?.activeBookId) return;
    setActionBusy(true);
    setError("");
    try {
      await flushSave();
      const nextTitle = `第${workspace.chapters.length + 1}章`;
      const result = await createWritingChapter(workspace.activeBookId, nextTitle, volumeId);
      workspaceRef.current = result.workspace;
      onWorkspaceChange(result.workspace);
    } catch (createError: unknown) {
      setError(getErrorMessage(createError));
    } finally {
      setActionBusy(false);
    }
  }

  async function saveBookTitle(): Promise<void> {
    const book = workspace?.books.find((item) => item.id === workspace.activeBookId);
    const title = bookTitleDraft.trim();
    if (!book || !title) return;
    setActionBusy(true);
    setError("");
    try {
      const result = await renameWritingBook(book.id, title);
      const next = { ...workspace!, books: workspace!.books.map((item) => item.id === result.book.id ? result.book : item) };
      workspaceRef.current = next;
      onWorkspaceChange(next);
      setRenameBookOpen(false);
    } catch (renameError: unknown) {
      setError(getErrorMessage(renameError));
    } finally {
      setActionBusy(false);
    }
  }

  async function removeBook(): Promise<void> {
    const book = workspace?.books.find((item) => item.id === workspace.activeBookId);
    if (!book) return;
    Modal.confirm({
      title: `删除《${book.title}》？`,
      content: "作品大纲、章节和修订历史会一并删除。",
      okText: "删除作品",
      cancelText: "取消",
      okButtonProps: { danger: true },
      getContainer: () => document.querySelector(".workbench-shell") ?? document.body,
      onOk: async () => {
        await flushSave();
        await deleteWritingBook(book.id);
        const next = await loadWritingWorkspace();
        workspaceRef.current = next.workspace;
        onWorkspaceChange(next.workspace);
      }
    });
  }

  async function removeChapter(): Promise<void> {
    if (!chapter) return;
    Modal.confirm({
      title: `删除“${chapter.title}”？`,
      content: "章节正文和修订历史会一并删除。",
      okText: "删除章节",
      cancelText: "取消",
      okButtonProps: { danger: true },
      getContainer: () => document.querySelector(".workbench-shell") ?? document.body,
      onOk: async () => {
        await flushSave();
        const result = await deleteWritingChapter(chapter.id);
        workspaceRef.current = result.workspace;
        onWorkspaceChange(result.workspace);
      }
    });
  }

  async function openRevisions(): Promise<void> {
    if (isOutlineActive && activeBookId) {
      await flushSave();
      setRevisionsOpen(true);
      setRevisionLoading(true);
      try {
        const result = await loadWritingBookOutlineRevisions(activeBookId);
        setRevisions(result.revisions);
      } catch (revisionError: unknown) {
        setError(getErrorMessage(revisionError));
      } finally {
        setRevisionLoading(false);
      }
      return;
    }
    if (!chapter) return;
    await flushSave();
    setRevisionsOpen(true);
    setRevisionLoading(true);
    try {
      const result = await loadWritingChapterRevisions(chapter.id);
      setRevisions(result.revisions);
    } catch (revisionError: unknown) {
      setError(getErrorMessage(revisionError));
    } finally {
      setRevisionLoading(false);
    }
  }

  async function restoreRevision(revisionId: string): Promise<void> {
    if (isOutlineActive && activeBookId) {
      setActionBusy(true);
      setError("");
      try {
        const result = await restoreWritingBookOutlineRevision(activeBookId, revisionId);
        synchronizedOutlineRef.current = { bookId: result.outline.bookId, content: result.outline.content };
        outlineDraftRef.current = { bookId: result.outline.bookId, content: result.outline.content };
        setOutlineContent(result.outline.content);
        setOutlineSaveState("saved");
        const current = workspaceRef.current;
        if (current?.activeBookId === result.outline.bookId) {
          const next = {
            ...current,
            activeBookOutline: result.outline.content,
            books: current.books.map((item) => item.id === result.outline.bookId ? { ...item, updatedAt: result.outline.updatedAt } : item)
          };
          workspaceRef.current = next;
          onWorkspaceChange(next);
        }
        setRevisionsOpen(false);
      } catch (restoreError: unknown) {
        setError(getErrorMessage(restoreError));
      } finally {
        setActionBusy(false);
      }
      return;
    }
    if (!chapter) return;
    setActionBusy(true);
    setError("");
    try {
      const result = await restoreWritingChapterRevision(chapter.id, revisionId);
      const current = workspaceRef.current;
      if (current) {
        const next = {
          ...current,
          activeChapter: result.chapter,
          chapters: current.chapters.map((item) => item.id === result.chapter.id ? {
            id: result.chapter.id,
            volumeId: result.chapter.volumeId,
            title: result.chapter.title,
            sortOrder: result.chapter.sortOrder,
            updatedAt: result.chapter.updatedAt,
            wordCount: result.chapter.wordCount
          } : item)
        };
        workspaceRef.current = next;
        onWorkspaceChange(next);
      }
      synchronizedRef.current = { chapterId: result.chapter.id, title: result.chapter.title, content: result.chapter.content };
      setChapterTitle(result.chapter.title);
      setContent(result.chapter.content);
      setSaveState("saved");
      setRevisionsOpen(false);
    } catch (restoreError: unknown) {
      setError(getErrorMessage(restoreError));
    } finally {
      setActionBusy(false);
    }
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "s") {
      event.preventDefault();
      void flushSave().catch(() => undefined);
    }
  }

  if (loading || !workspace && !loadError) {
    return <div className="writing-workspace__loading"><Spin size="small" /><span>正在打开写作空间…</span></div>;
  }

  if (!workspace) return <div className="writing-workspace__load-error" role="alert"><WorkbenchIcon name="help" size={19} /><strong>写作数据暂时无法读取</strong><span>{loadError}</span><Button onClick={onRetry}>重试</Button></div>;

  const activeBook = workspace.books.find((item) => item.id === workspace.activeBookId) ?? null;
  const currentSaveState = activePanel === "catalog" && activeCatalogEntryId ? catalogSaveState : isOutlineActive ? outlineSaveState : saveState;
  const formattedSaveState = currentSaveState === "saving" ? "正在保存" : currentSaveState === "dirty" ? "等待自动保存" : currentSaveState === "error" ? "保存失败" : "已保存";
  const editorContent = isOutlineActive ? outlineContent : content;
  const pendingChapters = workspace.chapters.filter((item) => item.wordCount === 0);
  const selectedSkill = writingSkills.find((skill) => skill.id === activeSkillId) ?? null;
  const activeCatalogCategory = catalogGroups.flatMap((group) => group.categories).find((category) => category.kind === activeCatalogKind);
  const categoryEntries = workspace.catalogEntries.filter((entry) => entry.kind === activeCatalogKind);
  const formatUpdatedAt = (value: string) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  function renderCatalogCategory(kind: WritingCatalogKind, label: string) {
    const entries = workspace.catalogEntries.filter((entry) => entry.kind === kind);
    const active = activePanel === "catalog" && activeCatalogKind === kind;
    return <section className="writing-workspace__catalog-category" key={kind}>
      <div className="writing-workspace__catalog-category-row">
        <button className={`writing-workspace__menu-item${active && !activeCatalogEntryId ? " is-active" : ""}`} type="button" aria-current={active && !activeCatalogEntryId ? "page" : undefined} onClick={() => void selectCatalogCategory(kind)} title={label}>
          <WorkbenchIcon name="file" size={13} /><span>{label}</span><small>{entries.length}</small>
        </button>
        <Tooltip title={`新增${label}`}><button className="writing-workspace__menu-add" type="button" disabled={!activeBook || actionBusy} aria-label={`新增${label}`} onClick={() => startCatalogEntry(kind)}><WorkbenchIcon name="plus" size={13} /></button></Tooltip>
      </div>
      {active ? entries.map((entry) => <button className={`writing-workspace__catalog-entry${entry.id === activeCatalogEntryId ? " is-active" : ""}`} type="button" key={entry.id} aria-current={entry.id === activeCatalogEntryId ? "page" : undefined} onClick={() => void selectCatalogEntry(entry.id)} title={entry.title}>
        <WorkbenchIcon name="file" size={12} /><span>{entry.title}</span><small>{entry.wordCount}</small>
      </button>) : null}
    </section>;
  }

  return <section className="writing-workspace" aria-label="写作编辑器" aria-busy={actionBusy}>
    {libraryPortalTarget ? createPortal(<aside className="writing-workspace__library" role="dialog" aria-label="作品目录与章节">
      <header><span>作品目录</span><Tooltip title="新建作品"><button type="button" aria-label="新建作品" onClick={() => { setBookTitleDraft(""); setCreateBookOpen(true); }}><WorkbenchIcon name="plus" size={15} /></button></Tooltip></header>
      <div className="writing-workspace__books">
        {workspace.books.map((book) => <button className={`writing-workspace__book${book.id === workspace.activeBookId ? " is-active" : ""}`} key={book.id} type="button" aria-current={book.id === workspace.activeBookId ? "page" : undefined} onClick={() => void selectBook(book.id)} title={book.title}>
          <WorkbenchIcon name="folder" size={14} /><span>{book.title}</span>
        </button>)}
      </div>
      {activeBook ? <div className="writing-workspace__chapter-tree">
        <div className="writing-workspace__chapter-heading"><span>作品内容</span></div>
        <div className="writing-workspace__volumes">
          <button className={`writing-workspace__chapter${isOutlineActive ? " is-active" : ""}`} type="button" aria-current={isOutlineActive ? "page" : undefined} onClick={() => void selectOutline()} title="作品大纲">
            <WorkbenchIcon name="book" size={13} /><span>作品大纲</span><small>{wordCount(workspace.activeBookOutline)}</small>
          </button>
          <div className="writing-workspace__chapter-heading"><span>卷</span><Tooltip title="新建卷"><button type="button" aria-label="新建卷" disabled={actionBusy} onClick={() => { setVolumeTitleDraft(`第${workspace.volumes.length + 1}卷`); setCreateVolumeOpen(true); }}><WorkbenchIcon name="plus" size={14} /></button></Tooltip></div>
          {workspace.volumes.map((volume) => {
            const volumeChapters = workspace.chapters.filter((item) => item.volumeId === volume.id);
            return <section className="writing-workspace__volume" key={volume.id} aria-label={volume.title}>
              <div className="writing-workspace__volume-heading"><WorkbenchIcon name="folder" size={13} /><span title={volume.title}>{volume.title}</span><Tooltip title={`在“${volume.title}”中新建章节`}><button type="button" aria-label={`在${volume.title}中新建章节`} disabled={actionBusy} onClick={() => void addChapter(volume.id)}><WorkbenchIcon name="plus" size={13} /></button></Tooltip></div>
              {volumeChapters.map((item) => <button className={`writing-workspace__chapter${item.id === workspace.activeChapterId ? " is-active" : ""}`} key={item.id} type="button" aria-current={item.id === workspace.activeChapterId ? "page" : undefined} onClick={() => void selectChapter(item.id)} title={item.title}>
                <WorkbenchIcon name="file" size={13} /><span>{item.title}</span><small>{item.wordCount}</small>
              </button>)}
              {!volumeChapters.length ? <p className="writing-workspace__tree-empty">还没有章节</p> : null}
            </section>;
          })}
          {!workspace.volumes.length ? <p className="writing-workspace__tree-empty">还没有卷</p> : null}
        </div>
      </div> : <div className="writing-workspace__library-empty"><WorkbenchIcon name="book" size={17} /><span>新建作品后，章节会显示在这里。</span></div>}
      <footer><span className={`writing-workspace__save-dot writing-workspace__save-dot--${currentSaveState}`} />{formattedSaveState}</footer>
    </aside>, libraryPortalTarget) : null}

    <div className="writing-workspace__editor">
      {activeBook && (isOutlineActive || chapter) ? <>
        <header className="writing-workspace__editor-toolbar">
          <div className="writing-workspace__breadcrumb"><span title={activeBook.title}>{activeBook.title}</span><WorkbenchIcon name="chevron" size={13} /><span title={isOutlineActive ? "作品大纲" : chapter?.title}>{isOutlineActive ? "作品大纲" : chapter?.title}</span></div>
          <div className="writing-workspace__toolbar-actions">
            <Tooltip title="重命名作品"><button type="button" aria-label="重命名作品" onClick={() => { setBookTitleDraft(activeBook.title); setRenameBookOpen(true); }}><WorkbenchIcon name="new" size={15} /></button></Tooltip>
            <Tooltip title={isOutlineActive ? "大纲修订历史" : "章节修订历史"}><button type="button" aria-label={isOutlineActive ? "查看大纲修订历史" : "查看章节修订历史"} onClick={() => void openRevisions()}><WorkbenchIcon name="history" size={15} /></button></Tooltip>
            {!isOutlineActive && chapter ? <Tooltip title="删除当前章节"><button type="button" aria-label="删除当前章节" onClick={() => void removeChapter()}><WorkbenchIcon name="trash" size={15} /></button></Tooltip> : null}
            <Tooltip title="删除当前作品"><button type="button" aria-label="删除当前作品" onClick={() => void removeBook()}><WorkbenchIcon name="archive" size={15} /></button></Tooltip>
          </div>
        </header>
        <div className="writing-workspace__paper">
          {isOutlineActive ? <h1 className="writing-workspace__outline-title">作品大纲</h1> : <Input className="writing-workspace__chapter-title" aria-label="章节标题" value={chapterTitle} onChange={(event) => { setChapterTitle(event.target.value); setSaveState("dirty"); }} maxLength={120} placeholder="章节标题" />}
          <textarea className="writing-workspace__body" aria-label={isOutlineActive ? "作品大纲编辑区" : "正文编辑区"} value={editorContent} onChange={(event) => {
            if (isOutlineActive) { setOutlineContent(event.target.value); setOutlineSaveState("dirty"); }
            else { setContent(event.target.value); setSaveState("dirty"); }
          }} onBlur={() => { void flushSave().catch(() => undefined); }} onKeyDown={handleEditorKeyDown} placeholder={isOutlineActive ? "整理作品大纲" : "请输入正文"} spellCheck />
          <footer className="writing-workspace__editor-footer"><span>{wordCount(editorContent).toLocaleString("zh-CN")} 字</span><span>Ctrl + S 保存</span></footer>
        </div>
      </> : <div className="writing-workspace__empty">
        <span className="writing-workspace__empty-mark"><WorkbenchIcon name="book" size={22} /></span>
        <h1>{activeBook ? "当前作品没有章节" : workspace.books.length ? "选择一本作品开始写作" : "从一个故事开始"}</h1>
        <p>{activeBook ? "可以先选择左侧的作品大纲继续整理；新建章节后也可继续写正文。" : workspace.books.length ? "从作品目录中选择作品，继续编辑章节正文。" : "新建作品后，在中央正文区写下第一章。章节会自动保存并保留修订历史。"}</p>
        {workspace.books.length ? null : <Button type="primary" onClick={() => { setBookTitleDraft(""); setCreateBookOpen(true); }}><WorkbenchIcon name="plus" size={15} />新建作品</Button>}
      </div>}
    </div>

    {error ? <div className="writing-workspace__error" role="alert"><WorkbenchIcon name="help" size={14} /><span>{error}</span></div> : null}

    <Modal title="新建作品" open={createBookOpen} onCancel={() => setCreateBookOpen(false)} onOk={() => void createBook()} okText="创建并开始写作" cancelText="取消" confirmLoading={actionBusy} getContainer={() => document.querySelector(".workbench-shell") ?? document.body}>
      <Input autoFocus maxLength={80} value={bookTitleDraft} onChange={(event) => setBookTitleDraft(event.target.value)} onPressEnter={() => void createBook()} placeholder="输入作品名" aria-label="作品名" />
    </Modal>
    <Modal title="新建卷" open={createVolumeOpen} onCancel={() => setCreateVolumeOpen(false)} onOk={() => void createVolume()} okText="创建" cancelText="取消" confirmLoading={actionBusy} getContainer={() => document.querySelector(".workbench-shell") ?? document.body}>
      <Input autoFocus maxLength={80} value={volumeTitleDraft} onChange={(event) => setVolumeTitleDraft(event.target.value)} onPressEnter={() => void createVolume()} placeholder="输入卷名" aria-label="卷名" />
    </Modal>
    <Modal title="重命名作品" open={renameBookOpen} onCancel={() => setRenameBookOpen(false)} onOk={() => void saveBookTitle()} okText="保存" cancelText="取消" confirmLoading={actionBusy} getContainer={() => document.querySelector(".workbench-shell") ?? document.body}>
      <Input autoFocus maxLength={80} value={bookTitleDraft} onChange={(event) => setBookTitleDraft(event.target.value)} onPressEnter={() => void saveBookTitle()} aria-label="作品名" />
    </Modal>
    <Modal title={isOutlineActive ? "作品大纲 · 修订历史" : chapter ? `${chapter.title} · 修订历史` : "修订历史"} open={revisionsOpen} footer={null} onCancel={() => setRevisionsOpen(false)} getContainer={() => document.querySelector(".workbench-shell") ?? document.body}>
      {revisionLoading ? <div className="writing-workspace__revision-loading"><Spin size="small" /></div> : revisions.length ? <div className="writing-workspace__revisions">{revisions.map((revision) => <div className="writing-workspace__revision" key={revision.id}>
        <div><strong>{revision.title}</strong><span>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(revision.createdAt))} · {revision.wordCount} 字</span></div>
        <Button size="small" disabled={actionBusy} onClick={() => void restoreRevision(revision.id)}>恢复</Button>
      </div>)}</div> : <div className="writing-workspace__revisions-empty">编辑并保存后会在这里保留修订快照。</div>}
    </Modal>
  </section>;
}
