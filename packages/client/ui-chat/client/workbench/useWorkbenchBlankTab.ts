// 右栏空态引导：面板展开且一个标签都没有时，自动补一个「新标签页」，避免只剩一个孤零零的加号。
import { useEffect } from "react";

export function useWorkbenchBlankTab({ shouldBootstrap, bootstrap }: {
  shouldBootstrap: boolean;
  bootstrap: () => void;
}) {
  useEffect(() => {
    if (shouldBootstrap) bootstrap();
  }, [bootstrap, shouldBootstrap]);
}