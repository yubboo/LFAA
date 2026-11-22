// 管理项目简介草稿：目录变化时自动生成初稿，用户编辑后不再覆盖，并暴露手动重新生成。
import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalProjectStore } from "../store/local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";

export function useProjectBrief(
  store: LocalProjectStore,
  rootPath: string,
  projectName: string,
  locale: WorkspaceLocaleMessages,
  initialBrief = "",
) {
  const [brief, setBrief] = useState(initialBrief);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  // 已有简介时不自动覆盖，只有空简介的项目才按目录生成初稿。
  const editedRef = useRef(initialBrief.trim().length > 0);
  const requestSeqRef = useRef(0);

  const generate = useCallback(async (path: string, name: string) => {
    const trimmed = path.trim();
    if (!trimmed) {
      setNotice(locale.briefNeedsFolder);
      return;
    }
    // 只接受最后一次请求的结果，避免快速切换目录时旧响应覆盖新草稿。
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setBusy(true);
    setNotice("");
    try {
      const draft = await store.draftProjectBrief(trimmed, name.trim());
      if (seq === requestSeqRef.current) setBrief(draft.brief);
    } catch (error) {
      if (seq === requestSeqRef.current) {
        setNotice(error instanceof Error ? error.message : locale.briefGenerationFailed);
      }
    } finally {
      if (seq === requestSeqRef.current) setBusy(false);
    }
  }, [locale, store]);

  // 只随目录变化生成：名称通常在选定目录时一并确定，避免每敲一个字都请求。
  useEffect(() => {
    if (!rootPath || editedRef.current) return;
    void generate(rootPath, projectName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath]);

  return {
    brief,
    busy,
    notice,
    updateBrief: (value: string) => {
      editedRef.current = true;
      setBrief(value);
      setNotice("");
    },
    regenerate: (overridePath?: string) => {
      editedRef.current = true;
      void generate(overridePath ?? rootPath, projectName);
    },
  };
}