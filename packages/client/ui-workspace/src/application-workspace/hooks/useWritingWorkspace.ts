/**
 * 文件：useWritingWorkspace.ts
 * 功能：加载并维护当前账户写作工作区数据。
 * 作用：封装既有 Writing API、错误反馈和离开页面前刷新回调，不保存第二份业务事实。
 * 关联文件：../../ApplicationWorkspace.tsx、packages/client/ui-writing、Writing Connection Owner。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage, loadWritingWorkspace, type ApplicationId, type WritingWorkspace as WritingWorkspaceData } from "lfaa-client-connection/src/api.js";

export function useWritingWorkspace(app: ApplicationId, userId: string) {
  const [workspace, setWorkspace] = useState<WritingWorkspaceData | null>(null);
  const [loading, setLoading] = useState(app === "writing");
  const [error, setError] = useState("");
  const flushRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let alive = true;
    if (app !== "writing") {
      setWorkspace(null);
      setLoading(false);
      setError("");
      return () => { alive = false; };
    }
    setWorkspace(null);
    setLoading(true);
    setError("");
    void loadWritingWorkspace().then(result => { if (alive) setWorkspace(result.workspace); })
      .catch((loadError: unknown) => { if (alive) setError(getErrorMessage(loadError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [app, userId]);

  const retry = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadWritingWorkspace();
      setWorkspace(result.workspace);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);
  const registerFlush = useCallback((flush: (() => Promise<void>) | null) => { flushRef.current = flush; }, []);
  const flushBeforeNavigation = useCallback(async () => {
    const flush = flushRef.current;
    if (!flush) return true;
    try {
      await flush();
      return true;
    } catch {
      // 编辑器已显示保存错误；阻止切换，避免未保存正文与后续写回并发。
      return false;
    }
  }, []);

  return { workspace, setWorkspace, loading, error, retry, registerFlush, flushBeforeNavigation };
}
