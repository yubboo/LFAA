// @lfaa/agent-profile Agents 页工具条：刷新、导出、导入与新建，避免列表页继续膨胀。
import { useRef } from "react";
import { IconDownload, IconPlus, IconRefresh, IconUpload } from "@tabler/icons-react";
import type { AgentsMessages } from "../locales";
import styles from "./Agents-View.module.css";

export interface AgentsToolbarProps {
  t: AgentsMessages;
  busy: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onExport: () => void;
  /** 选中文件后交给页面解析与提交。 */
  onImport: (file: File) => void;
}

export function AgentsToolbar({ t, busy, onRefresh, onCreate, onExport, onImport }: AgentsToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.headerActions}>
      <button type="button" className={styles.ghost} onClick={onRefresh} disabled={busy}>
        <IconRefresh size={14} /> {t.refresh}
      </button>
      <button type="button" className={styles.ghost} onClick={onExport} disabled={busy} title={t.exportLabel}>
        <IconDownload size={14} /> {t.exportLabel}
      </button>
      <button type="button" className={styles.ghost} onClick={() => fileRef.current?.click()} disabled={busy} title={t.importLabel}>
        <IconUpload size={14} /> {t.importLabel}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          // 清空 value：同一个文件连选两次也能再次触发 onChange。
          event.target.value = "";
        }}
      />
      <button type="button" className={styles.primary} onClick={onCreate} disabled={busy}>
        <IconPlus size={14} /> {t.newAgent}
      </button>
    </div>
  );
}