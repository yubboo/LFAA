// 聊天内媒体预览：/api/media/* 需要令牌头，img 标签无法携带，改为 fetch 后转 blob URL 渲染。
import { useContext, useEffect, useRef, useState } from "react";
import { IconDownload, IconQuote, IconRefresh } from "@tabler/icons-react";
import { ratioFromSize, readMediaPath } from "../media/chat-media";
import { mediaChatMessages } from "../media-locales";
import { MediaResultContext } from "../media/media-result-context";
import styles from "./LocalMediaImage.module.css";

/** 渲染图片；本机媒体走带鉴权的 fetch 取 blob，外链图片直接使用。 */
export function LocalMediaImage({ src, alt }: { src: string; alt: string }) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | "audio">("image");
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [recipe, setRecipe] = useState<string>();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const actions = useContext(MediaResultContext);
  const path = readMediaPath(src);
  const messageId = actions?.messageId;
  const sessionId = actions?.sessionId;
  const labels = mediaChatMessages[actions?.isZh === false ? "en" : "zh"];

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setResolved(null);
    setFailed(false);
    if (!src.startsWith("/api/media/")) {
      setMediaType(/\.(mp4|webm|mov)(\?|$)/iu.test(src) ? "video" : /\.(mp3|wav|ogg|m4a)(\?|$)/iu.test(src) ? "audio" : "image");
      setResolved(src);
      return;
    }
    const controller = new AbortController();
    void fetch(src, { signal: controller.signal })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setFailed(true);
          return;
        }
        // 宿主未重启时接口可能回落到 HTML（blob 不是媒体类型）：明确失败，避免显示破图。
        if (!/^(image|video|audio)\//u.test(blob.type)) {
          setFailed(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setMediaType(blob.type.startsWith("video/") ? "video" : blob.type.startsWith("audio/") ? "audio" : "image");
        setResolved(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, retryKey]);

  useEffect(() => {
    if (!resolved || mediaType !== "image" || !path || !messageId || !sessionId) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ sessionId, messageId, path });
    void fetch(`/api/media/recipe?${query}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ canRegenerate?: boolean }> : null)
      .then((result) => { if (result?.canRegenerate && !controller.signal.aborted) setRecipe(src); })
      .catch(() => { /* 无法恢复历史参数时保留下载和引用。 */ });
    return () => controller.abort();
  }, [mediaType, messageId, path, resolved, sessionId, src]);

  if (failed) {
    return (
      <span className={styles.mediaFallback}>
        {labels.failed}
        <button type="button" className={styles.mediaRetry} onClick={() => setRetryKey((key) => key + 1)}>{labels.retry}</button>
      </span>
    );
  }
  if (!resolved) return <span className={styles.mediaFallback}>{labels.loading}</span>;
  const preview = mediaType === "video"
    ? <video className={styles.mediaVideo} src={resolved} controls playsInline preload="metadata" aria-label={alt} />
    : mediaType === "audio" ? <audio className={styles.mediaAudio} src={resolved} controls preload="metadata" aria-label={alt} />
      : <img ref={imgRef} className={styles.mediaImage} src={resolved} alt={alt} loading="lazy" />;
  if (!actions || !path || !messageId) return preview;
  const source = { messageId, path };
  const fileName = path.split(/[\\/]/u).at(-1) || "media";

  // 图片操作收进图片内部：悬停或键盘聚焦时浮现图标，画面本身始终是干净的。
  if (mediaType === "image") {
    return (
      <span className={styles.result}>
        <span className={styles.frame}>
          {preview}
          {actions.brandWatermark ? <span className={styles.brandMark} aria-hidden="true">小鱼 agent 生成</span> : null}
          <span className={styles.overlay} role="group" aria-label={labels.previewActions}>
            <a
              className={styles.iconAction}
              href={resolved}
              download={fileName}
              title={labels.download}
              aria-label={labels.download}
            >
              <IconDownload size={15} aria-hidden="true" />
            </a>
            <button
              type="button"
              className={styles.iconAction}
              disabled={actions.busy}
              title={labels.quote}
              aria-label={labels.quote}
              onClick={() => actions.onQuote(source, src, alt || labels.quote)}
            >
              <IconQuote size={15} aria-hidden="true" />
            </button>
            {recipe === src && (
              <button
                type="button"
                className={styles.iconAction}
                disabled={actions.busy}
                title={labels.regenerate}
                aria-label={labels.regenerate}
                onClick={() => actions.onRegenerate(
                  source,
                  ratioFromSize(imgRef.current?.naturalWidth ?? 0, imgRef.current?.naturalHeight ?? 0),
                )}
              >
                <IconRefresh size={15} aria-hidden="true" />
              </button>
            )}
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className={styles.result}>
      {preview}
      <span className={styles.actions}>
        <a href={resolved} download={fileName}><IconDownload size={15} aria-hidden="true" />{labels.download}</a>
      </span>
    </span>
  );
}
