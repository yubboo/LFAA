// 主题实时预览面板：用真实主题色渲染一枚迷你工作台窗口，切换主题时颜色平滑过渡；供外观页与主题库共用。
import type { CSSProperties, ReactNode } from "react";
import styles from "./ThemePreview.module.css";

/** 预览所需的主题取样：背景、前景与强调色（来自主题预设或当前配置）。 */
export interface ThemePreviewSample {
  background: string;
  foreground: string;
  accent: string;
  /** 是否启用液态玻璃质感（仅影响预览里的悬浮层浓度）。 */
  glass?: boolean;
  /** 深/浅底标记，供缩略图判断是否需要更轻的边框。 */
  scheme?: "light" | "dark";
  /** 已解析的背景图 URL；有图时铺在取样底色上，并让面板变成半透明玻璃。 */
  image?: string | null;
}

/**
 * 渲染迷你工作台：左一图标栏 + 左二会话栏 + 中间对话区 + 输入条。
 * `variant="tile"` 时收敛为缩略图（省掉正文细节），`secondarySample` 存在时左右各半，用于「跟随系统」。
 */
export function ThemePreview({
  sample,
  secondarySample,
  variant = "panel",
  className,
  children,
}: {
  sample: ThemePreviewSample;
  secondarySample?: ThemePreviewSample | undefined;
  variant?: "panel" | "tile";
  className?: string;
  /** 叠加在预览上的额外内容（如主题名标签）。 */
  children?: ReactNode;
}) {
  const style = toStyle(sample);
  const rootClass = [
    styles.frame,
    variant === "tile" ? styles.tile : styles.panel,
    secondarySample ? styles.split : "",
    className ?? "",
  ].filter(Boolean).join(" ");
  const hasImage = Boolean(sample.image || secondarySample?.image);

  return (
    <div className={rootClass} style={style} data-image={hasImage ? "true" : undefined} aria-hidden="true">
      <div className={secondarySample ? styles.half : styles.fill} style={secondarySample ? toStyle(sample) : undefined}>
        <Backdrop sample={sample} />
        <MiniWindow compact={variant === "tile"} />
      </div>
      {secondarySample && (
        <div className={styles.half} style={toStyle(secondarySample)}>
          <Backdrop sample={secondarySample} />
          <MiniWindow compact={variant === "tile"} />
        </div>
      )}
      {children}
    </div>
  );
}

/** 把取样转成 CSS 变量，样式表只消费变量、不写死颜色。 */
function toStyle(sample: ThemePreviewSample): CSSProperties {
  return {
    "--pv-bg": sample.background,
    "--pv-fg": sample.foreground,
    "--pv-accent": sample.accent,
    "--pv-glass": sample.glass ? "1" : "0",
  } as CSSProperties;
}

/** 背景图层：图片上叠一层取样底色的薄纱，图片层与面板之间不再垫实色。 */
function Backdrop({ sample }: { sample: ThemePreviewSample }) {
  return sample.image ? (
    <span className={styles.backdrop}>
      <img key={sample.image} className={styles.photo} src={sample.image} alt="" decoding="async" loading="lazy" />
    </span>
  ) : null;
}

/** 迷你窗口骨架：纯装饰，不承载交互与文案。 */
function MiniWindow({ compact }: { compact: boolean }) {
  return (
    <div className={styles.window}>
      <span className={styles.rail}>
        <span className={styles.railDot} />
        <span className={styles.railDot} />
        <span className={styles.railDot} />
      </span>
      <span className={styles.sidebar}>
        <span className={styles.sidebarTitle} />
        <span className={styles.sidebarLine} />
        <span className={styles.sidebarLine} />
        <span className={styles.sidebarLineShort} />
        {!compact && (
          <>
            <span className={styles.sidebarGap} />
            <span className={styles.sidebarLine} />
            <span className={styles.sidebarLineShort} />
          </>
        )}
      </span>
      <span className={styles.canvas}>
        <span className={styles.canvasInner}>
          <span className={styles.canvasTitle} />
          {!compact && (
            <>
              <span className={styles.bubble} />
              <span className={styles.agentCard}>
                <span className={styles.agentLine} />
                <span className={styles.agentLineShort} />
              </span>
            </>
          )}
          <span className={styles.composer}>
            <span className={styles.composerLine} />
            <span className={styles.composerSend} />
          </span>
        </span>
      </span>
    </div>
  );
}