/**
 * 功能：展示写作应用当前作品、章节与模式上下文。
 * 作用：让常规编辑器和 AI Work 共用同一份服务端作品状态，并说明 Agent 提案及用户审阅应用边界。
 * 关联文件：packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-writing/src/normal/WritingWorkspace.tsx、WritingAiContext.css。
 */
import { useState } from "react";
import { Select } from "antd";
import { getErrorMessage, saveWritingBookRole, type ApplicationMode, type WritingWorkspace } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { WritingBookSkillsPanel } from "./WritingBookSkillsPanel.js";
import "./WritingAiContext.css";

interface WritingAiContextProps {
  mode: ApplicationMode;
  workspace: WritingWorkspace | null;
  workspaceLoading: boolean;
  sessionTitle: string;
  providerStatus: string | null;
  onWorkspaceChange: (workspace: WritingWorkspace) => void;
  onOpenNormal: () => void;
  onOpenAiWork: () => void;
  onClose: () => void;
}

export function WritingAiContext({ mode, workspace, workspaceLoading, sessionTitle, providerStatus, onWorkspaceChange, onOpenNormal, onOpenAiWork, onClose }: WritingAiContextProps) {
  const [roleSaving, setRoleSaving] = useState(false);
  const [error, setError] = useState("");
  const aiWork = mode === "ai-work";
  const activeBook = workspace?.books.find((book) => book.id === workspace.activeBookId) ?? null;
  const activeChapter = workspace?.activeChapter ?? null;
  const hasContext = Boolean(activeBook);

  return <>
    <header className="module-context__heading writing-ai-context__heading">
      <div><strong>{aiWork ? "写作上下文" : "作品信息"}</strong><span>{aiWork ? "当前 AI Work 对话" : "常规写作模式"}</span></div>
      <button className="module-shell-icon-button module-context__close" type="button" aria-label="收起创作上下文" title="收起创作上下文" onClick={onClose}><WorkbenchIcon name="close" size={15} /></button>
    </header>
    <div className="writing-ai-context">
      <section className="writing-ai-context__section" aria-labelledby="writing-ai-context-book">
        <header><span id="writing-ai-context-book">当前作品</span><span className={`writing-ai-context__status${hasContext ? " is-open" : ""}`}><i aria-hidden="true" />{workspaceLoading ? "读取中" : hasContext ? "已打开" : "未打开"}</span></header>
        <div className="writing-ai-context__book">
          <span className="writing-ai-context__book-icon" aria-hidden="true"><WorkbenchIcon name="book" size={18} /></span>
          <div><strong>{workspaceLoading ? "正在读取作品…" : activeBook?.title ?? "尚未打开作品"}</strong><p>{workspaceLoading ? "" : activeBook ? `${activeChapter ? `${activeChapter.title} · ${activeChapter.wordCount.toLocaleString("zh-CN")} 字` : "尚未选择章节"} · 大纲 ${workspace?.activeBookOutline.length.toLocaleString("zh-CN") ?? 0} 字` : "去常规模式新建作品并开始写作。"}</p></div>
        </div>
        <button className="writing-ai-context__mode-link" type="button" onClick={aiWork ? onOpenNormal : onOpenAiWork}>{aiWork ? "回到正文编辑" : "进入 AI Work"}<WorkbenchIcon name="chevron" size={13} /></button>
      </section>

      {aiWork ? <>
        <section className="writing-ai-context__section" aria-labelledby="writing-ai-context-session">
          <header><span id="writing-ai-context-session">当前会话</span></header>
          <div className="writing-ai-context__session"><WorkbenchIcon name="history" size={15} /><span title={sessionTitle}>{sessionTitle}</span></div>
          <div className="writing-ai-context__provider"><span>活动模型</span><strong title={providerStatus ?? "正在读取模型配置"}>{providerStatus ?? "正在读取模型配置…"}</strong></div>
        </section>
        {activeBook ? <section className="writing-ai-context__section" aria-labelledby="writing-ai-context-role">
          <header><span id="writing-ai-context-role">作品专职角色</span></header>
          <Select
            aria-label="当前作品专职写作角色"
            value={activeBook.aiRoleId}
            disabled={roleSaving || workspaceLoading}
            options={(workspace?.writingRoleOptions ?? []).map((role) => ({ value: role.id, label: role.name }))}
            onChange={(roleId: typeof activeBook.aiRoleId) => {
              setRoleSaving(true);
              setError("");
              void saveWritingBookRole(activeBook.id, roleId).then(({ workspace: updated }) => onWorkspaceChange(updated)).catch((saveError: unknown) => setError(getErrorMessage(saveError))).finally(() => setRoleSaving(false));
            }}
          />
          <p className="writing-ai-context__role-description">{workspace?.writingRoleOptions.find((role) => role.id === activeBook.aiRoleId)?.description ?? "角色只影响写作方法，不改变作品范围和提案审阅权限。"}</p>
          {error ? <p className="writing-ai-context__error" role="alert">{error}</p> : null}
        </section> : null}
        <WritingBookSkillsPanel bookId={activeBook?.id ?? null} bookTitle={activeBook?.title ?? "当前作品"} skills={workspace?.bookSkills ?? []} onWorkspaceChange={onWorkspaceChange} />
        <section className="writing-ai-context__section writing-ai-context__guide" aria-labelledby="writing-ai-context-guide">
          <header><span id="writing-ai-context-guide">本轮参考内容</span></header>
          <p>{hasContext ? "模型会参考当前作品大纲和章节正文，根据你说的“大纲”或“正文”选择目标并生成待审修改。默认追加，明确指定位置时按唯一原文锚点插入；位置不清会先询问。只有你在审阅界面查看新旧正文并点击“确认并应用”后，作品才会更新。" : "先在常规模式新建或选择作品。模型生成的修改只会成为待审提案；你需要打开审阅并明确点击应用，作品正文才会更新。"}</p>
        </section>
      </> : <section className="writing-ai-context__section writing-ai-context__guide" aria-labelledby="writing-ai-context-guide">
        <header><span id="writing-ai-context-guide">作品保存</span></header>
        <p>{hasContext ? "大纲和章节正文自动保存到当前账户，并分别保留最近 50 个修订版本，可从中央编辑区历史按钮恢复。" : "新建作品后即可在中央编辑区编辑大纲和正文。"}</p>
      </section>}
    </div>
  </>;
}
