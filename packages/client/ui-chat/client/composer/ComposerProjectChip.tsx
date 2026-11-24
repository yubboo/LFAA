// 渲染聊天模式与停靠态输入栏内紧跟 + 按钮右侧的独立项目胶囊，点击开关统一项目选择器。
import { IconFolder } from "@tabler/icons-react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { ChatLocaleMessages } from "../locales";
import composerStyles from "../conversation/ChatWorkspace.composer.module.css";

/** 展示当前绑定的项目名；点击后由上层切换共享项目选择器浮层。 */
export function ComposerProjectChip({
  locale,
  project,
  open,
  disabled,
  onToggle,
}: {
  locale: ChatLocaleMessages;
  project: WorkbenchProjectItem;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const tipLabel = disabled
    ? (locale.isZh ? "运行或保存结束后可更改项目" : "Change the project when the run or save finishes")
    : (project.rootPath || (locale.isZh ? "更改此聊天的项目" : "Change project for this chat"));

  return (
    <HoverTip label={tipLabel} disabled={open}>
      <button
        type="button"
        className={composerStyles.projectChip}
        data-project-picker-trigger="true"
        data-open={open ? "true" : undefined}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${locale.bindProject} · ${project.name}`}
        onClick={onToggle}
      >
        <IconFolder size={14} aria-hidden="true" />
        <span className={composerStyles.projectChipLabel}>{project.name}</span>
      </button>
    </HoverTip>
  );
}
