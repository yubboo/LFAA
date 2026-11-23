// 生成素材缩略图：进入视口附近才按需读取，浏览器内缩到 480px 并写入缓存；完整原图仍由 useMediaBlob 供右栏使用。
import { useEffect, useRef, useState } from "react";
import { IconMusic, IconPhoto, IconVideo } from "@tabler/icons-react";
import { mediaLibraryFileUrl, type MediaLibraryItem } from "./media-library";
import { getMediaThumbnail } from "./media-thumb-cache";

/** 读取完整素材文件为 blob URL，供右栏大图/播放器使用；路径变化或卸载时中止请求并回收 URL。 */
export function useMediaBlob(path: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();
    void fetch(mediaLibraryFileUrl(path), { signal: controller.signal })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return url;
}

/** 素材缩略图：图片/视频只在接近视口时读取并展示小图，语音直接用图标，不发起原图请求。 */
export function MediaThumb({
  item,
  mediaClassName,
  fallbackClassName,
}: {
  item: MediaLibraryItem;
  mediaClassName?: string | undefined;
  fallbackClassName?: string | undefined;
}) {
  const holderRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const isAudio = item.kind === "audio";

  // 缩略图只对接近视口的卡片生效，首屏不会一次性拉取全部原图。
  useEffect(() => {
    if (isAudio) return;
    const element = holderRef.current;
    if (!element) return;
    if (typeof IntersectionObserver !== "function") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "240px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isAudio]);

  useEffect(() => {
    if (isAudio || !visible) return;
    let cancelled = false;
    setDone(false);
    void getMediaThumbnail(item).then((next) => {
      if (cancelled) return;
      setUrl(next);
      setDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isAudio, item, visible]);

  if (isAudio) {
    return (
      <span className={fallbackClassName} aria-hidden="true">
        <IconMusic size={28} stroke={1.6} />
      </span>
    );
  }
  if (url) {
    return (
      <img
        className={mediaClassName}
        src={url}
        alt={item.name}
        decoding="async"
        onError={() => {
          setFailed(true);
          setUrl(null);
        }}
      />
    );
  }
  return (
    <span className={fallbackClassName} ref={holderRef} aria-hidden="true">
      {failed || done ? (item.kind === "video" ? <IconVideo size={26} stroke={1.6} /> : <IconPhoto size={26} stroke={1.6} />) : null}
    </span>
  );
}