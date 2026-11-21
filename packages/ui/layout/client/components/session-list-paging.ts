// 左二栏会话分页：每批显示 6 条会话，项目子会话与「最近」分组共用同一套窗口计算与展开/收起控件。
export const SESSION_PAGE_SIZE = 6;

/** 会话窗口的计算结果：当前可见条数、剩余条数与下一批数量。 */
export interface SessionListWindow {
  visible: number;
  remaining: number;
  nextBatch: number;
  fullyExpanded: boolean;
}

/** 展开/收起控件的展示数据；由列表构建器转换为侧栏行。 */
export interface SessionListControl {
  label: string;
  expanded: boolean;
  onClick: () => void;
}

/** 按总量与已展开条数计算当前窗口；已展开数越界时收敛到合法范围。 */
export function resolveSessionWindow(total: number, shown: number): SessionListWindow {
  const safeTotal = Math.max(0, Math.trunc(total));
  const visible = Math.min(safeTotal, Math.max(0, Math.trunc(shown)));
  const remaining = safeTotal - visible;
  return {
    visible,
    remaining,
    nextBatch: Math.min(SESSION_PAGE_SIZE, remaining),
    fullyExpanded: remaining === 0,
  };
}

/** 计算再展开一批后的已展开条数，不超过会话总量。 */
export function nextSessionWindow(total: number, shown: number): number {
  const window = resolveSessionWindow(total, shown);
  return Math.min(Math.max(0, Math.trunc(total)), window.visible + SESSION_PAGE_SIZE);
}

/** 超过一批时才生成控件；全部展开后切换为收起，点击回到默认 6 条。 */
export function createSessionWindowControl({
  total,
  shown,
  expandLabel,
  collapseLabel,
  onShowMore,
  onCollapse,
}: {
  total: number;
  shown: number;
  expandLabel: (count: number) => string;
  collapseLabel: string;
  onShowMore: () => void;
  onCollapse: () => void;
}): SessionListControl | null {
  if (total <= SESSION_PAGE_SIZE) return null;
  const window = resolveSessionWindow(total, shown);
  if (window.fullyExpanded) return { label: collapseLabel, expanded: true, onClick: onCollapse };
  return { label: expandLabel(window.nextBatch), expanded: false, onClick: onShowMore };
}