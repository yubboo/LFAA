// 输入栏图片风格选择器：自动，或写真 / 电影感 / 插画 / 二次元 / 水彩 / 3D。
import { useRef, useState } from "react";
import { IconCheck, IconPalette } from "@tabler/icons-react";
import { PopoverCard } from "@lfaa/ui-primitives/client";
import { MEDIA_STYLE_OPTIONS, type MediaStyleChoice } from "../media/chat-media";
import { mediaChatMessages } from "../media-locales";
import styles from "./MediaStylePicker.module.css";

/** 只有选中生图模型时才显示；选择结果随生成请求发送，提示词导演会按它扩写。 */
export function MediaStylePicker({ isZh, value, onChange, initialOpen = false }: {
  isZh: boolean;
  value: MediaStyleChoice;
  onChange: (value: MediaStyleChoice) => void;
  /** 初始是否展开浮层：预览与静态渲染测试使用，正常交互保持收起。 */
  initialOpen?: boolean;
}) {
  const labels = mediaChatMessages[isZh ? "zh" : "en"];
  const [open, setOpen] = useState(initialOpen);
  const anchorRef = useRef<HTMLDivElement>(null);
  const activeLabel = labels.styleNames[value];

  return (
    <div className={styles.anchor} ref={anchorRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={labels.styleTitle}
        onClick={() => setOpen((prev) => !prev)}
      >
        <IconPalette size={14} aria-hidden="true" className={styles.icon} />
        <span className={styles.label}>{labels.styleLabel}</span>
        <span className={styles.value}>{activeLabel}</span>
      </button>

      <PopoverCard
        open={open}
        label={labels.styleTitle}
        placement="top-end"
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        className={styles.popover ?? ""}
      >
        <div className={styles.title}>{labels.styleTitle}</div>
        <div className={styles.grid} role="listbox" aria-label={labels.styleTitle}>
          {MEDIA_STYLE_OPTIONS.map((option) => (
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
              <span>{labels.styleNames[option]}</span>
              {option === value ? <IconCheck size={12} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </PopoverCard>
    </div>
  );
}