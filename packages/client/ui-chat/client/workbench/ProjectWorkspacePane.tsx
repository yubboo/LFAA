// 左二「项目工作区」内容：复用右栏同款工作区文件树，点文件仍由聊天 store 打开到中间工作台。
import type { ChatClientStore } from "../store/chat-store";
import { useChatSelector } from "../store/use-chat-selector";
import { RightFileTreePane } from "./RightFileTreePane";
import styles from "./ProjectWorkspacePane.module.css";

export function ProjectWorkspacePane({
  store,
  projectId,
  projectName,
  worktreeId,
  isZh,
  ensurePanelOpen,
}: {
  store: ChatClientStore;
  projectId: string | null;
  projectName: string | null;
  /** 当前会话绑定的工作树；缺省读项目根。 */
  worktreeId?: string | undefined;
  isZh: boolean;
  /** 点文件后确保右侧工作台展开。 */
  ensurePanelOpen?: (() => void) | undefined;
}) {
  // 只订阅「当前打开的文件路径」，用于树内高亮；文件仍在中间工作台打开。
  const activeFilePath = useChatSelector(store, (snap) => {
    const tab = snap.filePreviewTabs.find((item) => item.id === snap.activeFilePreviewId);
    return tab?.path;
  });

  return (
    <div className={styles.pane}>
      <RightFileTreePane
        projectId={projectId}
        worktreeId={worktreeId}
        projectName={projectName}
        activeFilePath={activeFilePath}
        isZh={isZh}
        store={store}
        ensurePanelOpen={ensurePanelOpen}
      />
    </div>
  );
}