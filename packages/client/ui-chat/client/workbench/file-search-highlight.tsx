// 行内搜索高亮：把一行文本按查询切分并输出带 <mark> 的 React 节点，供文件预览复用。
import type { ReactNode } from "react";
import searchStyles from "./FileChangePreview.search.module.css";

export function renderLineWithSearch(
  line: string,
  query: string,
  caseSensitive: boolean,
  highlighted: ReactNode[],
): ReactNode[] {
  if (!query) return highlighted;
  const hay = caseSensitive ? line : line.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  if (!needle || !hay.includes(needle)) return highlighted;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let idx = hay.indexOf(needle, cursor);
  while (idx >= 0) {
    if (idx > cursor) nodes.push(line.slice(cursor, idx));
    nodes.push(<mark key={idx} className={searchStyles.searchHighlight}>{line.slice(idx, idx + query.length)}</mark>);
    cursor = idx + query.length;
    idx = hay.indexOf(needle, cursor);
  }
  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
}