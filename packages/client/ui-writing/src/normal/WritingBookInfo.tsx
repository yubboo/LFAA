/**
 * 功能：展示写作面板当前作品、章节和保存说明。
 * 作用：只读展示 Writing Owner 返回的作品状态；对话与 Agent 执行归共享工作区。
 * 关联文件：WritingWorkspace.tsx、WritingBookInfo.css、packages/client/ui-workspace/src/ApplicationWorkspace.tsx。
 */
import type { WritingWorkspace } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { WritingBookSkillsPanel } from "./WritingBookSkillsPanel.js";
import "./WritingBookInfo.css";

interface WritingBookInfoProps {
  workspace: WritingWorkspace | null;
  workspaceLoading: boolean;
  onWorkspaceChange: (workspace: WritingWorkspace) => void;
  onClose: () => void;
}

export function WritingBookInfo({ workspace, workspaceLoading, onWorkspaceChange, onClose }: WritingBookInfoProps) {
  const activeBook = workspace?.books.find(book => book.id === workspace.activeBookId) ?? null;
  const activeChapter = workspace?.activeChapter ?? null;

  return <>
    <header className="module-context__heading writing-book-info__heading">
      <div><strong>作品信息</strong><span>写作管理面板</span></div>
      <button className="module-shell-icon-button module-context__close" type="button" aria-label="收起作品信息" title="收起作品信息" onClick={onClose}><WorkbenchIcon name="close" size={15} /></button>
    </header>
    <div className="writing-book-info">
      <section className="writing-book-info__section" aria-labelledby="writing-book-info-book">
        <header><span id="writing-book-info-book">当前作品</span><span className={`writing-book-info__status${activeBook ? " is-open" : ""}`}><i aria-hidden="true" />{workspaceLoading ? "读取中" : activeBook ? "已打开" : "未打开"}</span></header>
        <div className="writing-book-info__book">
          <span className="writing-book-info__book-icon" aria-hidden="true"><WorkbenchIcon name="book" size={18} /></span>
          <div><strong>{workspaceLoading ? "正在读取作品…" : activeBook?.title ?? "尚未打开作品"}</strong><p>{workspaceLoading ? "" : activeBook ? `${activeChapter ? `${activeChapter.title} · ${activeChapter.wordCount.toLocaleString("zh-CN")} 字` : "尚未选择章节"} · 大纲 ${workspace?.activeBookOutline.length.toLocaleString("zh-CN") ?? 0} 字` : "从作品目录新建或选择作品并开始写作。"}</p></div>
        </div>
      </section>
      <WritingBookSkillsPanel bookId={activeBook?.id ?? null} bookTitle={activeBook?.title ?? "当前作品"} skills={workspace?.bookSkills ?? []} onWorkspaceChange={onWorkspaceChange} />
      <section className="writing-book-info__section writing-book-info__guide" aria-labelledby="writing-book-info-save">
        <header><span id="writing-book-info-save">作品保存</span></header>
        <p>{activeBook ? "大纲和章节正文自动保存到当前账户，并分别保留最近 50 个修订版本，可从中央编辑区历史按钮恢复。" : "新建作品后即可在中央编辑区编辑大纲和正文。"}</p>
      </section>
    </div>
  </>;
}
