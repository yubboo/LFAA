import { Button } from "antd";

export interface PendingAttachmentPreview {
  id: string;
  name: string;
  previewUrl: string;
}

export interface PendingAttachmentListProps {
  items: readonly PendingAttachmentPreview[];
  onRemove: (id: string) => void;
}

export function PendingAttachmentList({ items, onRemove }: PendingAttachmentListProps) {
  if (items.length === 0) return null;

  return <div className="ai-work-chat__attachments" aria-label="待发送附件">
    {items.map(file => (
      <span key={file.id} className="ai-work-chat__attachment">
        <img className="ai-work-chat__attachment-thumb" src={file.previewUrl} alt={file.name} loading="lazy" />
        <span className="ai-work-chat__attachment-name" title={file.name}>{file.name.length > 18 ? file.name.slice(0, 18) + "…" : file.name}</span>
        <Button type="text" size="small" aria-label={"移除附件 " + file.name} onClick={() => onRemove(file.id)}>×</Button>
      </span>
    ))}
  </div>;
}
