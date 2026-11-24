// 媒体生成中的消息占位：按目标画幅显示骨架卡片与进度，替换输入框上方那一行旧式状态提示。
import { mediaChatMessages } from "../media-locales";
import styles from "./Media-Generating-Card.module.css";

const KIND_LABEL = {
  image: "generatingImage",
  video: "generatingVideo",
  audio: "generatingAudio",
} as const;

/** 解析 "9:16" 这类比例；非法或缺省时按方图处理。 */
function parseRatio(ratio: string | undefined): [number, number] {
  const match = /^(\d{1,2})[:：](\d{1,2})$/u.exec(ratio ?? "");
  const width = Number(match?.[1] ?? 1);
  const height = Number(match?.[2] ?? 1);
  return width > 0 && height > 0 ? [width, height] : [1, 1];
}

/** 生成中占位：骨架尺寸跟随目标比例（竖图收窄、横图放宽），高度上限 21rem。 */
export function MediaGeneratingCard({ kind, ratio, isZh }: {
  kind: "image" | "video" | "audio";
  ratio?: string | undefined;
  isZh: boolean;
}) {
  const labels = mediaChatMessages[isZh ? "zh" : "en"];
  const [width, height] = parseRatio(ratio);
  const widthRem = Math.min(22, (21 * width) / height);
  return (
    <div className={styles.card} role="status" aria-live="polite" data-kind={kind}>
      <div className={styles.skeleton} style={{ width: `${widthRem}rem`, aspectRatio: `${width} / ${height}` }}>
        <span className={styles.pulse} aria-hidden="true" />
      </div>
      <div className={styles.meta}>
        <span className={styles.spinner} aria-hidden="true" />
        <span>{labels[KIND_LABEL[kind]]}</span>
        {ratio ? <span className={styles.ratioChip}>{ratio}</span> : null}
      </div>
    </div>
  );
}