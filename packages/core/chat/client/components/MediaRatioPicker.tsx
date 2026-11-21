// 输入栏图片比例选择器：自动识别，或固定 9:16 / 2:3 / 3:4 / 1:1 / 4:3 / 3:2 / 16:9。
import { useRef, useState } from "react";
import { IconCheck, IconCrop } from "@tabler/icons-react";
import { PopoverCard } from "@lfaa/ui-primitives/client";
import { MEDIA_RATIO_OPTIONS, type MediaRatioChoice } from "../chat-media";
import { mediaChatMessages } from "../locales";
import styles from "./MediaRatioPicker.module.css";

/** 只有选中生图模型时才显示；选择结果由输入栏状态持有并随生成请求发送。 */
export function MediaRatioPicker({ isZh, value, onChange, initialOpen = false }: {
  isZh: boolean;
  value: MediaRatioChoice;
  onChange: (value: MediaRatioChoice) => void;
  /** 初始是否展开浮层：预览与静态渲染测试使用，正常交互保持收起。 */
  initialOpen?: boolean;
}) {
  const labels = mediaChatMessages[isZh ? "zh" : "en"];
  const [open, setOpen] = useState(initialOpen);
  const anchorRef = useRef<HTMLDivElement>(null);
  const activeLabel = value === "auto" ? labels.ratioAuto : value;

  return (
    <div className={styles.anchor} ref={anchorRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={labels.ratioTitle}
        onClick={() => setOpen((prev) => !prev)}
      >
        <IconCrop size={14} aria-hidden="true" className={styles.icon} />
        <span className={styles.label}>{labels.ratio}</span>
        <span className={styles.value}>{activeLabel}</span>
      </button>

      <PopoverCard
        open={open}
        label={labels.ratioTitle}
        placement="top-end"
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        className={styles.popover ?? ""}
      >
        <div className={styles.title}>{labels.ratioTitle}</div>
        <div className={styles.grid} role="listbox" aria-label={labels.ratioTitle}>
          {MEDIA_RATIO_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              className={styles.option}
              data-active={option === value ? "true" : undefined}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <span>{option === "auto" ? labels.ratioAuto : option}</span>
              {option === value ? <IconCheck size={12} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </PopoverCard>
    </div>
  );
}