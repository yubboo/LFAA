import { useRef } from "react";
import { Button, Tooltip } from "antd";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

export interface ComposerAttachmentControlProps {
  busy: boolean;
  error: string | null;
  pendingCount: number;
  onSelectFiles: (files: FileList | null) => void;
}

export function ComposerAttachmentControl({ busy, error, pendingCount, onSelectFiles }: ComposerAttachmentControlProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return <>
    <Tooltip trigger={["hover", "focus"]} placement="top" title={error ?? "添加图片或文本附件（最多 4 个，单个不超过 8 MiB）"}>
      <Button
        className="ai-work-chat__composer-control ai-work-chat__composer-control--icon"
        type="text"
        aria-label="添加附件"
        loading={busy}
        disabled={busy || pendingCount >= 4}
        icon={<WorkbenchIcon name="plus" size={18} />}
        onClick={() => fileInputRef.current?.click()}
      />
    </Tooltip>
    <input
      ref={fileInputRef}
      type="file"
      multiple
      hidden
      accept="image/png,image/jpeg,image/gif,image/webp,text/plain"
      onChange={event => {
        onSelectFiles(event.target.files);
        event.target.value = "";
      }}
    />
  </>;
}
