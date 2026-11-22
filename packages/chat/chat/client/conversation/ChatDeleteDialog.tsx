// 删除当前对话的二次确认弹窗：说明删除不可恢复，并由调用方执行真正的删除。
import { ModalDialog } from "@lfaa/ui-primitives/client";
import type { ChatLocaleMessages } from "../locales";
import modalStyles from "../models/ModelProviderGrid.module.css";

export function ChatDeleteDialog({
  locale,
  open,
  subtitle,
  onClose,
  onConfirm,
}: {
  locale: ChatLocaleMessages;
  open: boolean;
  subtitle: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalDialog
      open={open}
      title={locale.isZh ? "删除当前对话" : "Delete Current Chat"}
      subtitle={subtitle}
      size="sm"
      closeLabel={locale.isZh ? "关闭" : "Close"}
      onClose={onClose}
      footer={(
        <div className={modalStyles.footerRight}>
          <button
            type="button"
            className={modalStyles.btn}
            onClick={onClose}
          >
            {locale.isZh ? "取消" : "Cancel"}
          </button>
          <button
            type="button"
            className={modalStyles.dangerBtn}
            onClick={onConfirm}
          >
            {locale.isZh ? "确认删除" : "Delete"}
          </button>
        </div>
      )}
    >
      <p style={{ margin: 0, fontSize: "0.86em", color: "var(--color-muted)" }}>
        {locale.isZh
          ? "确定要删除当前对话吗？删除后该会话的所有聊天记录将永久移除，无法恢复。"
          : "Delete this chat session permanently? This cannot be undone."}
      </p>
    </ModalDialog>
  );
}