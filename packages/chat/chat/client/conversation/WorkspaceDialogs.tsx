// 聊天工作区的会话级弹窗：新建项目对话框与删除会话确认框。
// 从 ChatWorkspace 拆出：两者都只依赖项目提供者、当前会话与打开状态，和主视图布局无关。
import type { ReactNode } from "react";
import type { ChatLocaleMessages } from "../locales";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatSessionDetail } from "../store/chat-types";
import { ChatDeleteDialog } from "./ChatDeleteDialog";

/** 项目提供者只需能渲染创建弹窗；由 layout 侧注入。 */
interface ProjectDialogProvider {
  renderCreateDialog: (options: { onCreated: (project: { id: string }) => void; onClose: () => void }) => ReactNode;
}

export function WorkspaceDialogs({ locale, store, activeSession, projectProvider, projectDialogOpen, deleteDialogOpen, onCreatedProject, onCloseProjectDialog, onCloseDeleteDialog }: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  activeSession: ChatSessionDetail | null | undefined;
  projectProvider: ProjectDialogProvider | null | undefined;
  projectDialogOpen: boolean;
  deleteDialogOpen: boolean;
  onCreatedProject: (project: { id: string }) => void;
  onCloseProjectDialog: () => void;
  onCloseDeleteDialog: () => void;
}) {
  return (
    <>
      {projectDialogOpen && projectProvider?.renderCreateDialog({
        onCreated: onCreatedProject,
        onClose: onCloseProjectDialog,
      })}

      <ChatDeleteDialog
        locale={locale}
        open={Boolean(deleteDialogOpen && activeSession)}
        subtitle={activeSession?.title ?? ""}
        onClose={onCloseDeleteDialog}
        onConfirm={() => {
          if (activeSession) void store.deleteSession(activeSession.id);
          onCloseDeleteDialog();
        }}
      />
    </>
  );
}