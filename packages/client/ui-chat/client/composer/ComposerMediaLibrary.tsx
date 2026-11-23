// 输入框工具栏的「生成素材库」入口：图标按钮 + 素材库弹窗，复用提示词回填输入框。
import { useState } from "react";
import { IconPhoto } from "@tabler/icons-react";
import { MediaLibraryDialog } from "@lfaa/client-ui-tool-media/client";
import styles from "../conversation/ChatWorkspace.composer.module.css";

/** 生成素材库入口：按钮在输入栏工具栏内，弹窗 portal 到 body。 */
export function ComposerMediaLibrary({
  isZh,
  onUsePrompt,
}: {
  isZh: boolean;
  onUsePrompt: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.toolButton}
        aria-label={isZh ? "生成素材库" : "Generated media library"}
        title={isZh ? "生成素材库" : "Generated media library"}
        onClick={() => setOpen(true)}
      >
        <IconPhoto size={16} stroke={1.7} />
      </button>
      <MediaLibraryDialog
        isZh={isZh}
        open={open}
        onClose={() => setOpen(false)}
        onUsePrompt={onUsePrompt}
      />
    </>
  );
}