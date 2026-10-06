/**
 * 功能：在 AI Work 项目中审阅真实 Git 差异，并按用户操作查看或编辑项目文本文件。
 * 作用：Git 差异由 Daemon Git Owner 提供；文件读写绑定已登记项目并使用 SHA-256 防覆盖。
 * 不负责：执行 Git 命令、应用补丁、提交、推送或修改项目登记。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Modal, Spin, Tag, message } from "antd";
import { AiMarkdown } from "lfaa-client-ui-chat/src/AiMarkdown.js";
import { getErrorMessage, loadWorkspaceGitFileDiff, readWorkspaceProjectTextFile, writeWorkspaceProjectTextFile, type WorkspaceGitFileDiff, type WorkspaceGitStatus, type WorkspaceProject, type WorkspaceProjectApplicationId, type WorkspaceProjectTextFile } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

type DiffKind = "context" | "added" | "removed" | "meta";
interface DiffRow { text: string; kind: DiffKind }
interface SplitRow { left: DiffRow | null; right: DiffRow | null }

interface GitChangeReviewProps {
  appId: WorkspaceProjectApplicationId;
  project: WorkspaceProject;
  status: WorkspaceGitStatus;
  initialPath: string;
  open: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

function lineKind(line: string): DiffKind {
  if (line.startsWith("+") && !line.startsWith("+++")) return "added";
  if (line.startsWith("-") && !line.startsWith("---")) return "removed";
  if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++") || line.startsWith("\\ ")) return "meta";
  return "context";
}

function displayLines(diff: string, hideImports: boolean): DiffRow[][] {
  const hunks: DiffRow[][] = [];
  let current: DiffRow[] = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("@@")) {
      if (current.length) hunks.push(current);
      current = [{ text: line, kind: "meta" }];
      continue;
    }
    if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) continue;
    const kind = lineKind(line);
    const content = kind === "added" || kind === "removed" ? line.slice(1) : line;
    if (hideImports && (kind === "added" || kind === "removed") && /^\s*(?:import\b|export\s+.*\s+from\b)/u.test(content)) continue;
    current.push({ text: line, kind });
  }
  if (current.length) hunks.push(current);
  return hunks;
}

function splitHunk(lines: DiffRow[]): SplitRow[] {
  const result: SplitRow[] = [];
  let index = 0;
  while (index < lines.length) {
    const row = lines[index]!;
    if (row.kind === "meta") { result.push({ left: row, right: row }); index += 1; continue; }
    if (row.kind === "context") { result.push({ left: row, right: row }); index += 1; continue; }
    const removed: DiffRow[] = [];
    const added: DiffRow[] = [];
    while (index < lines.length && lines[index]!.kind === "removed") removed.push(lines[index++]!);
    while (index < lines.length && lines[index]!.kind === "added") added.push(lines[index++]!);
    const count = Math.max(removed.length, added.length);
    for (let part = 0; part < count; part += 1) result.push({ left: removed[part] ?? null, right: added[part] ?? null });
  }
  return result;
}

function statusText(status: string): string {
  if (status === "??" || status === "A") return "新增";
  if (status === "D") return "删除";
  if (status === "R") return "重命名";
  if (status === "C") return "基线差异";
  if (status.includes("M")) return "修改";
  return status.trim() || "变更";
}

function isMarkdown(path: string): boolean { return /\.(?:md|markdown)$/iu.test(path); }

function normalizeEditorText(value: string): string { return value.replace(/\r\n?/gu, "\n"); }

function preserveLineEnding(value: string, original: string): string {
  const normalized = normalizeEditorText(original);
  if (value === normalized) return original;
  const endings = original.match(/\r\n|\r|\n/gu) ?? [];
  const counts = new Map<string, number>();
  for (const ending of endings) counts.set(ending, (counts.get(ending) ?? 0) + 1);
  const preferred = [...counts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "\n";
  return value.replace(/\n/gu, preferred);
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

export function GitChangeReview({ appId, project, status, initialPath, open, onClose, onRefresh }: GitChangeReviewProps) {
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [filter, setFilter] = useState("");
  const [showFiles, setShowFiles] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [hideWhitespace, setHideWhitespace] = useState(false);
  const [hideImports, setHideImports] = useState(false);
  const [wordDiff, setWordDiff] = useState(false);
  const [expandHunks, setExpandHunks] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState(false);
  const [fileDiff, setFileDiff] = useState<WorkspaceGitFileDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState("");
  const [fileRead, setFileRead] = useState<WorkspaceProjectTextFile | null>(null);
  const [draft, setDraft] = useState("");
  const [readLoading, setReadLoading] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const [savingConflict, setSavingConflict] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [version, setVersion] = useState(0);
  const diffRequest = useRef(0);
  const fileRequest = useRef(0);
  const selected = status.files.find(file => file.path === selectedPath);
  const projectFilePath = selected?.projectPath ?? selectedPath;

  useEffect(() => {
    if (!open) return;
    diffRequest.current += 1;
    fileRequest.current += 1;
    setSelectedPath(initialPath || status.files[0]?.path || "");
    setFilter("");
    setShowSource(false);
    setEditMode(false);
    setMarkdownPreview(false);
    setFileDiff(null);
    setFileRead(null);
    setDraft("");
    setFileError("");
    setDiffError("");
  }, [open, project.id]);

  useEffect(() => {
    if (open) return;
    diffRequest.current += 1;
    fileRequest.current += 1;
  }, [open]);

  useEffect(() => {
    if (!open || !selectedPath || showSource) return;
    const request = ++diffRequest.current;
    let active = true;
    setDiffLoading(true);
    setDiffError("");
    setFileDiff(null);
    void loadWorkspaceGitFileDiff(project.id, appId, selectedPath, { ignoreWhitespace: hideWhitespace, wordDiff })
      .then(result => { if (active && request === diffRequest.current) setFileDiff(result.file); })
      .catch(error => { if (active && request === diffRequest.current) setDiffError(getErrorMessage(error)); })
      .finally(() => { if (active && request === diffRequest.current) setDiffLoading(false); });
    return () => { active = false; };
  }, [open, project.id, appId, selectedPath, hideWhitespace, wordDiff, showSource, version]);

  useEffect(() => {
    if (!open || !selectedPath || !showSource || fileRead) return;
    const request = ++fileRequest.current;
    let active = true;
    setReadLoading(true);
    setFileError("");
    void readWorkspaceProjectTextFile(project.id, appId, projectFilePath, 0, 40000)
      .then(result => {
        if (!active || request !== fileRequest.current) return;
        setFileRead(result.file);
        setDraft(normalizeEditorText(result.file.content));
      })
      .catch(error => { if (active && request === fileRequest.current) setFileError(getErrorMessage(error)); })
      .finally(() => { if (active && request === fileRequest.current) setReadLoading(false); });
    return () => { active = false; };
  }, [open, project.id, appId, selectedPath, projectFilePath, showSource, fileRead]);

  const filteredFiles = useMemo(() => status.files.filter(file => file.displayPath.toLocaleLowerCase().includes(filter.toLocaleLowerCase())), [status.files, filter]);
  const hunks = useMemo(() => displayLines(fileDiff?.diff ?? "", hideImports), [fileDiff?.diff, hideImports]);
  const dirty = editMode && fileRead !== null && draft !== normalizeEditorText(fileRead.content);
  const canEdit = fileRead !== null && !fileRead.truncated && selected?.status !== "D";
  const bytes = new TextEncoder().encode(draft).byteLength;
  const canCopyPatch = Boolean(fileDiff?.diff && !fileDiff.diffTruncated && !fileDiff.wordDiff && !fileDiff.ignoreWhitespace);

  const handleClose = useCallback(() => {
    if (saveBusy) return;
    if (dirty) {
      Modal.confirm({ title: "放弃未保存的修改？", content: "关闭后，当前编辑内容不会写入项目文件。", okText: "放弃修改", cancelText: "继续编辑", onOk: onClose });
      return;
    }
    onClose();
  }, [dirty, onClose, saveBusy]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLocaleLowerCase() === "f") {
        event.preventDefault();
        setFullScreen(value => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const selectFile = (path: string) => {
    if (saveBusy) return;
    if (dirty) {
      Modal.confirm({ title: "切换文件并放弃修改？", content: "当前草稿尚未保存。", okText: "切换文件", cancelText: "留在此处", onOk: () => { fileRequest.current += 1; setSelectedPath(path); setShowSource(false); setEditMode(false); setFileRead(null); setDraft(""); } });
      return;
    }
    fileRequest.current += 1;
    setSelectedPath(path);
    setShowSource(false);
    setEditMode(false);
    setMarkdownPreview(false);
    setFileRead(null);
    setDraft("");
    setFileError("");
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
      setVersion(value => value + 1);
    } finally { setRefreshing(false); }
  };

  const showCompleteFile = async () => {
    if (!fileRead || !fileRead.truncated) return;
    const request = ++fileRequest.current;
    setReadLoading(true);
    setFileError("");
    try {
      let content = fileRead.content;
      let offset = content.length;
      while (offset < fileRead.totalCharacters) {
        const result = await readWorkspaceProjectTextFile(project.id, appId, projectFilePath, offset, 100000);
        if (request !== fileRequest.current) return;
        if (result.file.sha256 !== fileRead.sha256 || result.file.totalCharacters !== fileRead.totalCharacters) throw new Error("文件在分段读取期间发生变化，请重新加载后再编辑。");
        if (!result.file.content.length) throw new Error("文件读取不完整，已停止继续加载。");
        content += result.file.content;
        offset += result.file.content.length;
      }
      setFileRead({ ...fileRead, content, truncated: false });
      setDraft(normalizeEditorText(content));
    } catch (error) { setFileError(getErrorMessage(error)); }
    finally { if (request === fileRequest.current) setReadLoading(false); }
  };

  const copyText = async (content: string, success: string) => {
    try { await navigator.clipboard.writeText(content); message.success(success); }
    catch { message.error("剪贴板不可用，请检查浏览器权限。"); }
  };

  const copyGitApplyCommand = async () => {
    if (!fileDiff || !canCopyPatch) return;
    const patchData = encodeBase64(fileDiff.diff);
    const temporaryPatch = `lfaa-review-${crypto.randomUUID()}.patch`;
    const script = `const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');const p=path.join(os.tmpdir(),'${temporaryPatch}');fs.writeFileSync(p,Buffer.from('${patchData}','base64'));try{cp.execFileSync('git',['apply','--',p],{stdio:'inherit'})}finally{fs.rmSync(p,{force:true})}`;
    await copyText(`node -e "eval(Buffer.from('${encodeBase64(script)}','base64').toString('utf8'))"`, "已复制 git apply 命令；执行前请确认终端位于目标仓库根目录");
  };

  const save = async () => {
    if (!fileRead || !canEdit || !dirty || bytes > 2 * 1024 * 1024) return;
    const content = preserveLineEnding(draft, fileRead.content);
    if (new TextEncoder().encode(content).byteLength > 2 * 1024 * 1024) {
      setFileError("UTF-8 文件内容超过 2 MiB，无法保存。");
      return;
    }
    setSaveBusy(true);
    setFileError("");
    setSavingConflict(false);
    try {
      const result = await writeWorkspaceProjectTextFile(project.id, appId, projectFilePath, content, fileRead.sha256);
      setFileRead({ ...fileRead, content, sha256: result.result.sha256, truncated: false });
      setDraft(normalizeEditorText(content));
      setEditMode(false);
      await onRefresh();
      setVersion(value => value + 1);
      message.success("文件已保存，Git 状态已刷新。");
    } catch (error) {
      const detail = getErrorMessage(error);
      setFileError(detail);
      setSavingConflict(/已变化|重新读取|并发/u.test(detail));
    } finally { setSaveBusy(false); }
  };

  const reloadFile = async () => {
    fileRequest.current += 1;
    setFileRead(null);
    setDraft("");
    setEditMode(false);
    setFileError("");
  };

  const renderedDiff = (row: DiffRow | null, side: "left" | "right" | "unified", index: number) => <div className={`git-review__line git-review__line--${row?.kind ?? "empty"}`} data-diff-type={row?.kind} key={`${side}-${index}`}><code>{row?.text ?? " "}</code></div>;

  return <Modal
    open={open}
    title={null}
    footer={null}
    onCancel={handleClose}
    width={fullScreen ? "calc(100vw - 24px)" : 1120}
    style={fullScreen ? { top: 12, maxWidth: "none", paddingBottom: 0 } : { top: 32, maxWidth: "calc(100vw - 48px)" }}
    wrapClassName={`git-change-review-modal${fullScreen ? " is-fullscreen" : ""}`}
    destroyOnClose
    keyboard={!dirty}
    maskClosable={!dirty}
    getContainer={() => document.querySelector(".workbench-shell") ?? document.body}
  >
    <div className="git-review" aria-label="Git 变更审阅器">
      <header className="git-review__header">
        <div className="git-review__title"><WorkbenchIcon name="branch" size={17} /><div><strong>{project.title || "项目变更"}</strong><span title={status.repository}>{status.branch} · {status.worktreeId ? "AI Worktree" : "源项目"} · {status.changedFileCount} 个文件</span></div></div>
        <div className="git-review__header-actions">
          <Button size="small" icon={<WorkbenchIcon name="refresh" size={14} />} loading={refreshing} onClick={() => void refresh()}>刷新</Button>
          <Button size="small" aria-label={fullScreen ? "退出完整视图" : "进入完整视图"} title="完整视图 · Ctrl+Shift+F" onClick={() => setFullScreen(value => !value)}>{fullScreen ? "退出完整视图" : "完整视图"}</Button>
            <Button size="small" aria-label="关闭变更审阅" icon={<WorkbenchIcon name="close" size={14} />} disabled={saveBusy} onClick={handleClose} />
        </div>
      </header>
      <div className="git-review__summary"><span>基线 {status.baseline.slice(0, 8)}</span><span className="is-added">+{status.insertions}</span><span className="is-removed">−{status.deletions}</span><span>{status.unknownLineCounts ? `${status.unknownLineCounts} 个文件未统计行数` : "真实 Git 差异"}</span></div>
      <div className="git-review__body">
        {showFiles ? <aside className="git-review__files">
          <div className="git-review__files-heading"><strong>变更文件</strong><span>{status.files.length}{status.statusTruncated ? "+" : ""}</span><Button size="small" type="text" title="隐藏文件列表" aria-label="隐藏文件列表" onClick={() => setShowFiles(false)}><WorkbenchIcon name="panelLeft" size={15} /></Button></div>
          <Input size="small" allowClear placeholder="筛选文件" value={filter} onChange={event => setFilter(event.target.value)} />
          <nav aria-label="Git 变更文件列表">{filteredFiles.map(file => <button type="button" disabled={saveBusy} className={`git-review__file${selectedPath === file.path ? " is-selected" : ""}`} key={file.path} title={file.displayPath} onClick={() => selectFile(file.path)}>
            <span className="git-review__file-name"><WorkbenchIcon name="file" size={14} /><code>{file.displayPath}</code></span>
            <span className="git-review__file-stats"><Tag>{statusText(file.status)}</Tag><span className="is-added">{file.insertions === null ? "·" : `+${file.insertions}`}</span><span className="is-removed">{file.deletions === null ? "·" : `−${file.deletions}`}</span></span>
          </button>)}</nav>
          {status.statusTruncated ? <p className="git-review__truncated">Daemon 最多返回 200 个文件；当前列表已截断。</p> : null}
        </aside> : null}
        <main className="git-review__main">
          <div className="git-review__toolbar">
            {!showFiles ? <Button size="small" title="显示文件" aria-label="显示文件" onClick={() => setShowFiles(true)}><WorkbenchIcon name="panelLeft" size={15} /></Button> : null}
            <strong title={selectedPath}>{selected?.displayPath ?? selectedPath ?? "选择一个变更文件"}</strong>
            <span className="git-review__toolbar-spacer" />
            <Button size="small" disabled={!canCopyPatch} title={!canCopyPatch ? "请使用未过滤、未截断的统一差异后再复制" : "复制完整补丁文本；不会自动执行"} onClick={() => fileDiff && void copyText(fileDiff.diff, "已复制 Git 补丁文本")}>复制补丁</Button>
            <Button size="small" disabled={!canCopyPatch} title={!canCopyPatch ? "请使用未过滤、未截断的统一差异后再复制" : "复制命令，不会自动执行；执行前确认终端位于目标仓库根目录"} onClick={() => void copyGitApplyCommand()}>复制 git apply 命令</Button>
            <Button size="small" title="自动换行" type={wrapLines ? "primary" : "default"} onClick={() => setWrapLines(value => !value)}>换行</Button>
            <Button size="small" title="隐藏空白差异" type={hideWhitespace ? "primary" : "default"} onClick={() => setHideWhitespace(value => !value)}>空白</Button>
            <Button size="small" title="隐藏 import/export 差异" type={hideImports ? "primary" : "default"} onClick={() => setHideImports(value => !value)}>隐藏导入</Button>
            <Button size="small" title="单词级差异" type={wordDiff ? "primary" : "default"} onClick={() => setWordDiff(value => !value)}>词级</Button>
            <Button size="small" title={expandHunks ? "折叠全部差异区块" : "展开全部差异区块"} onClick={() => setExpandHunks(value => !value)}>{expandHunks ? "折叠区块" : "展开区块"}</Button>
            <Button size="small" title="统一/并排视图" type={splitView ? "primary" : "default"} onClick={() => setSplitView(value => !value)}>{splitView ? "并排" : "统一"}</Button>
          </div>
          {selectedPath ? <div className="git-review__view-tabs">
            <Button size="small" type={!showSource ? "primary" : "text"} onClick={() => { setShowSource(false); setEditMode(false); }}>差异</Button>
            <Button size="small" type={showSource ? "primary" : "text"} onClick={() => { setShowSource(true); setMarkdownPreview(false); }}>完整文件</Button>
            {showSource && isMarkdown(selectedPath) ? <Button size="small" disabled={editMode} type={markdownPreview ? "primary" : "text"} onClick={() => setMarkdownPreview(value => !value)}>{markdownPreview ? "源码" : "渲染预览"}</Button> : null}
            {showSource && fileRead?.truncated ? <Button size="small" loading={readLoading} onClick={() => void showCompleteFile()}>加载完整文件</Button> : null}
            {showSource && fileRead && !editMode && canEdit ? <Button size="small" type="primary" onClick={() => { setDraft(normalizeEditorText(fileRead.content)); setEditMode(true); }}>编辑文件</Button> : null}
            {showSource && fileRead && !editMode ? <Button size="small" disabled={fileRead.truncated} onClick={() => void copyText(fileRead.content, "已复制完整文件")}>复制文件</Button> : null}
            {editMode ? <>
              <Button size="small" onClick={() => { setDraft(normalizeEditorText(fileRead?.content ?? "")); setEditMode(false); }}>放弃</Button>
              <Button size="small" type="primary" loading={saveBusy} disabled={!dirty || bytes > 2 * 1024 * 1024} onClick={() => void save()}>保存</Button>
            </> : null}
            {fileRead ? <span className="git-review__file-size">{fileRead.totalCharacters.toLocaleString()} 字符 · {fileRead.truncated ? "分段加载" : "完整"}</span> : null}
          </div> : null}
          <section className={`git-review__content${wrapLines ? " is-wrapped" : ""}`}>
            {!selectedPath ? <div className="git-review__empty">当前项目没有可审阅的变更文件。</div> : null}
            {!showSource && diffLoading ? <div className="git-review__loading"><Spin size="small" />正在读取文件差异…</div> : null}
            {!showSource && diffError ? <Alert type="warning" showIcon message={diffError} /> : null}
            {!showSource && fileDiff ? <>
              {fileDiff.diffTruncated ? <Alert type="warning" showIcon message="此文件差异超过 Daemon 返回上限，显示内容已截断；完整补丁和复制操作已禁用。" /> : null}
              {fileDiff.diff ? hunks.map((hunk, index) => <details className="git-review__hunk" open={expandHunks} key={`${selectedPath}-${index}`}>
                <summary>{hunk[0]?.text ?? `差异区块 ${index + 1}`}</summary>
                {splitView ? <div className="git-review__split">{splitHunk(hunk).map((row, rowIndex) => <div className="git-review__split-row" key={rowIndex}>{renderedDiff(row.left, "left", rowIndex)}{renderedDiff(row.right, "right", rowIndex)}</div>)}</div>
                  : <div className="git-review__unified">{hunk.slice(1).map((row, rowIndex) => renderedDiff(row, "unified", rowIndex))}</div>}
              </details>) : <div className="git-review__empty">Git 未返回可显示的文本差异。文件可能是二进制、较大未跟踪文件，或仅有模式变化。</div>}
            </> : null}
            {showSource && readLoading && !fileRead ? <div className="git-review__loading"><Spin size="small" />正在读取项目文件…</div> : null}
            {showSource && fileError ? <Alert type="warning" showIcon message={fileError} description={savingConflict ? "草稿仍保留在编辑器中。请重新加载文件、对照外部改动后再编辑保存。" : undefined} action={savingConflict ? <Button size="small" onClick={() => void reloadFile()}>重新读取</Button> : undefined} /> : null}
            {showSource && fileRead ? markdownPreview && !editMode && isMarkdown(selectedPath) && fileRead.content.length <= 256000 ? <div className="git-review__markdown"><AiMarkdown content={fileRead.content} /></div> : markdownPreview && !editMode && isMarkdown(selectedPath) ? <Alert type="info" showIcon message="此 Markdown 文件较大，暂不在主线程渲染预览；可切换到源码查看。" /> : editMode ? <Input.TextArea className="git-review__editor" value={draft} onChange={event => setDraft(event.target.value)} spellCheck={false} autoSize={false} aria-label={`编辑文件 ${selectedPath}`} /> : <pre className="git-review__source"><code>{fileRead.content}</code></pre> : null}
            {showSource && fileRead?.truncated ? <p className="git-review__truncated">当前内容仅为文件开头的一段；加载完整文件后才能编辑或复制。</p> : null}
            {showSource && fileRead && editMode && bytes > 2 * 1024 * 1024 ? <Alert type="error" showIcon message="UTF-8 文件内容超过 2 MiB，无法保存。" /> : null}
          </section>
          {fileDiff?.diffTruncated ? <footer className="git-review__footer">差异已截断；文件读取仍会由 Daemon 单独校验并限制为普通 UTF-8 文本。</footer> : null}
        </main>
      </div>
    </div>
  </Modal>;
}
