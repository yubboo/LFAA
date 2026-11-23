// 行内批注框：输入建议并提交到对话输入框；Esc 取消、Ctrl/Cmd+Enter 提交，挂载即聚焦。
// 从 FileChangePreview 拆出：草稿与焦点只服务这一小块 UI，留在查看器里会稀释它的主体职责。
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatClientStore } from "../store/chat-store";
import commentStyles from "./FileChangePreview.comment.module.css";

/** 单行批注：提交后拼成带文件行号与代码片段的引用写进输入框。 */
export function InlineComment({ lineNumber, lineText, displayPath, isZh, store, onClose }: {
  lineNumber: number;
  lineText: string;
  displayPath: string;
  isZh: boolean;
  store: ChatClientStore;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const note = draft.trim();
    if (!note) return;
    const snippet = lineText.trim().slice(0, 140);
    const refText = `针对 \`${displayPath}#L${lineNumber}\`${snippet ? `\n> \`${snippet}\`` : ""}\n${note}`;
    store.enqueueComposerInsert(refText);
    onClose();
  };

  return (
    <form className={commentStyles.inlineCommentBox} onSubmit={submit}>
      <div className={commentStyles.commentMeta}>
        {isZh ? `第 ${lineNumber} 行批注 · 提交后写入对话输入框` : `Line ${lineNumber} comment · inserts into chat`}
      </div>
      <textarea
        ref={inputRef}
        className={commentStyles.commentTextarea}
        rows={2}
        value={draft}
        placeholder={isZh ? "输入修改建议或提问 (Ctrl+Enter 添加)…" : "Leave a comment (Ctrl+Enter to add)..."}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
          } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            submit(event);
          }
        }}
      />
      <div className={commentStyles.commentActions}>
        <button type="button" className={commentStyles.commentCancel} onClick={onClose}>{isZh ? "取消" : "Cancel"}</button>
        <button type="submit" className={commentStyles.commentSubmit} disabled={!draft.trim()}>{isZh ? "添加到对话" : "Add Comment"}</button>
      </div>
    </form>
  );
}