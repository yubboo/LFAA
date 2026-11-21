// 左二栏会话窗口状态：项目子会话按行记录展开批次，「最近」分组共享一条窗口；折叠项目时重置。
import { useState } from "react";
import {
  SESSION_PAGE_SIZE,
  createSessionWindowControl,
  nextSessionWindow,
  resolveSessionWindow,
  type SessionListControl,
} from "./session-list-paging";

/** 会话窗口控件所需的本地化文案，由调用方按当前语言传入。 */
export interface SessionWindowLabels {
  expandLabel: (count: number) => string;
  collapseLabel: string;
}

/** 提供项目行与「最近」分组的可见条数和展开/收起控件。 */
export function useSessionWindow({ expandLabel, collapseLabel }: SessionWindowLabels) {
  const [projectShown, setProjectShown] = useState<Record<string, number>>({});
  const [recentShown, setRecentShown] = useState(SESSION_PAGE_SIZE);

  /** 项目行当前应显示的会话条数。 */
  const projectVisibleCount = (rowId: string, total: number) => resolveSessionWindow(
    total,
    projectShown[rowId] ?? SESSION_PAGE_SIZE,
  ).visible;

  /** 项目行末尾的展开/收起控件；不足一批或未展开项目时返回 null。 */
  const projectControl = (rowId: string, total: number): SessionListControl | null => createSessionWindowControl({
    total,
    shown: projectShown[rowId] ?? SESSION_PAGE_SIZE,
    expandLabel,
    collapseLabel,
    onShowMore: () => setProjectShown((current) => ({
      ...current,
      [rowId]: nextSessionWindow(total, current[rowId] ?? SESSION_PAGE_SIZE),
    })),
    onCollapse: () => {
      setProjectShown((current) => {
        if (!(rowId in current)) return current;
        const next = { ...current };
        delete next[rowId];
        return next;
      });
    },
  });

  /** 折叠项目时清除该行的批次，下次展开回到默认 6 条。 */
  const resetProject = (rowId: string) => {
    setProjectShown((current) => {
      if (!(rowId in current)) return current;
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  };

  /** 「最近」分组当前应显示的会话条数。 */
  const recentVisibleCount = (total: number) => resolveSessionWindow(total, recentShown).visible;

  /** 「最近」分组末尾的展开/收起控件。 */
  const recentControl = (total: number): SessionListControl | null => createSessionWindowControl({
    total,
    shown: recentShown,
    expandLabel,
    collapseLabel,
    onShowMore: () => setRecentShown((current) => nextSessionWindow(total, current)),
    onCollapse: () => setRecentShown(SESSION_PAGE_SIZE),
  });

  return { projectVisibleCount, projectControl, resetProject, recentVisibleCount, recentControl };
}