// 在浏览器步骤卡中按需加载已认证的截图证据，关闭预览时释放图片资源。
import { useEffect, useState } from "react";
import styles from "./Browser-Subagent-Card.module.css";

export function BrowserEvidence({
  id,
  sessionId,
  isZh,
  compact = false,
}: {
  id: string;
  sessionId: string;
  isZh: boolean;
  compact?: boolean | undefined;
}) {
  const [src, setSrc] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ id, sessionId });
    let objectUrl: string | undefined;
    void fetch(`/api/browser/evidence?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Screenshot request returned ${response.status}`);
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, sessionId]);

  if (failed || !src) {
    return (
      <div className={compact ? styles.evidenceThumbPlaceholder : styles.resultBox} role="status">
        {failed ? (isZh ? "截图已失效" : "Unavailable")
          : (isZh ? "加载截图…" : "Loading…")}
      </div>
    );
  }
  return (
    <img
      className={compact ? styles.evidenceThumbImage : styles.evidenceImage}
      src={src}
      alt={isZh ? "浏览器验收截图" : "Browser verification screenshot"}
      onError={() => setFailed(true)}
    />
  );
}
