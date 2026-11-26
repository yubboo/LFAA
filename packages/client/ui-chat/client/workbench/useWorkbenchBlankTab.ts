// 右栏空态占位标签的生命周期：面板一个标签都没有时补一个「新标签页」，出现真实内容标签后自动让位。
import { useEffect } from "react";

export function useWorkbenchBlankTab({ shouldBootstrap, shouldDrop, bootstrap, dismiss }: {
  /** 面板空着且没有任何标签：补一个占位「新标签页」，避免只剩一个孤零零的「+」。 */
  shouldBootstrap: boolean;
  /** 已出现文件 / 辅助 / 子智能体 / 审查等真实内容标签：占位必须收起。 */
  shouldDrop: boolean;
  bootstrap: () => void;
  dismiss: () => void;
}) {
  useEffect(() => {
    if (shouldBootstrap) bootstrap();
  }, [bootstrap, shouldBootstrap]);

  // 用户没点「+」就不该多出一个标签：真实内容标签一出现，就把空态占位收掉。
  useEffect(() => {
    if (shouldDrop) dismiss();
  }, [dismiss, shouldDrop]);
}
