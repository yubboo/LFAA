// 渲染已发送用户消息中的图片：上传附件按会话读取附件库，引用图按路径读取会话内生成媒体。
import { useEffect, useRef, useState } from "react";
import type { ChatMessageAttachment, ChatMessageReference } from "@lfaa/memory";
import { mediaChatMessages } from "../locales";
import styles from "./UserMessageAttachments.module.css";

/** 一条待显示的用户图片：会话附件库引用，或会话内已生成图片的路径引用。 */
type UserImageItem =
  | { key: string; kind: "attachment"; id: string }
  | { key: string; kind: "reference"; path: string };

/** 生成媒体预览地址；路径按查询参数编码，避免中文与反斜杠被截断。 */
function mediaFileUrl(path: string): string {
  return `/api/media/file?path=${encodeURIComponent(path)}`;
}

/** 按来源取回可显示的图片地址；引用图返回需要调用方释放的 blob URL。 */
async function loadUserImage(item: UserImageItem, sessionId: string | null, signal: AbortSignal): Promise<string | null> {
  if (item.kind === "attachment") {
    if (!sessionId) return null;
    const query = new URLSearchParams({ sessionId });
    const response = await fetch(`/api/attachments/${encodeURIComponent(item.id)}?${query}`, { signal });
    if (!response.ok) return null;
    const result = await response.json() as { item?: { mime?: string }; contentBase64?: string };
    if (!result?.item?.mime?.startsWith("image/") || !result.contentBase64) return null;
    return `data:${result.item.mime};base64,${result.contentBase64}`;
  }
  const response = await fetch(mediaFileUrl(item.path), { signal });
  if (!response.ok) return null;
  const blob = await response.blob();
  return /^image\//u.test(blob.type) ? URL.createObjectURL(blob) : null;
}

/** 展示一张用户图片，失败时保留可读状态并允许重试。 */
function UserMessageImage({ item, sessionId, isZh }: {
  item: UserImageItem;
  sessionId: string | null;
  isZh: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // 横图与方图按横向缩略卡裁切，竖图保留完整比例：加载完成后按真实尺寸标记。
  const [orientation, setOrientation] = useState<"wide" | "tall" | undefined>();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const labels = mediaChatMessages[isZh ? "zh" : "en"];
  const sourceKey = item.kind === "attachment" ? item.id : item.path;

  useEffect(() => {
    setSrc(null);
    setFailed(false);
    setOrientation(undefined);
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void loadUserImage(item, sessionId, controller.signal)
      .then((next) => {
        // 请求已被新的重试/卸载取代时，回收刚创建的 blob URL，避免泄漏。
        if (controller.signal.aborted) {
          if (next?.startsWith("blob:")) URL.revokeObjectURL(next);
          return;
        }
        if (!next) {
          setFailed(true);
          return;
        }
        if (next.startsWith("blob:")) objectUrl = next;
        setSrc(next);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // 只依赖来源标识：父组件每次渲染都会重建 item 对象，直接依赖它会导致反复请求。
  }, [item.kind, sourceKey, retryKey, sessionId]);

  // 图片可能命中缓存、load 事件早于监听：挂载后先看 complete，再等一次 load，
// 按真实宽高标记横/竖图，供样式选择缩略卡或完整比例。
  useEffect(() => {
    const media = imgRef.current;
    if (!media) return;
    const apply = () => {
      if (!media.naturalWidth) return;
      setOrientation(media.naturalWidth >= media.naturalHeight ? "wide" : "tall");
    };
    if (media.complete) {
      apply();
      return;
    }
    media.addEventListener("load", apply, { once: true });
    return () => media.removeEventListener("load", apply);
  }, [src]);

  if (failed) {
    return (
      <span className={styles.state} role="status">
        {item.kind === "reference" ? labels.referenceFailed : labels.attachmentFailed}
        <button type="button" onClick={() => setRetryKey((key) => key + 1)}>{labels.retry}</button>
      </span>
    );
  }
  if (!src) return <span className={styles.state} role="status">{labels.loading}</span>;
  return (
    <img
      ref={imgRef}
      className={styles.image}
      src={src}
      alt={item.kind === "reference" ? labels.referenceImage : labels.userImage}
      data-source={item.kind}
      data-orientation={orientation}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** 在用户文本上方先按上传顺序显示附件，再显示当时引用的生成图片。 */
export function UserMessageAttachments({ attachments = [], references = [], sessionId, isZh }: {
  attachments?: ChatMessageAttachment[] | undefined;
  references?: ChatMessageReference[] | undefined;
  sessionId: string | null;
  isZh: boolean;
}) {
  const items: UserImageItem[] = [
    ...attachments.map((attachment) => ({ key: `a-${attachment.id}`, kind: "attachment" as const, id: attachment.id })),
    ...references.map((reference) => ({ key: `r-${reference.messageId}-${reference.path}`, kind: "reference" as const, path: reference.path })),
  ];
  if (items.length === 0) return null;
  return (
    <div
      className={styles.list}
      role="group"
      aria-label={isZh ? "消息图片附件" : "Message image attachments"}
      data-count={Math.min(items.length, 3)}
    >
      {items.map((item) => (
        <UserMessageImage key={item.key} item={item} sessionId={sessionId} isZh={isZh} />
      ))}
    </div>
  );
}