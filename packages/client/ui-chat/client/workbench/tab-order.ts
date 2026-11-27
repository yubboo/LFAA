// 右侧工作台标签栏稳定排序纯函数：按真实打开顺序保序，且空白「新标签页」变身为内容标签时原位替换不跳位。

/** 判断标签 key 是否属于可被原位替换的空白/浏览器标签。 */
function isBrowserKey(key: string): boolean {
  return key === "browser:blank" || key.startsWith("browser:");
}

/**
 * 合并上一帧的标签顺序与当前存在的标签集合：
 * 1. 已存在的标签严格保持原顺序，绝不因类型不同自动换位；
 * 2. 若本帧恰好有 1 个浏览器空白标签消失且冒出 1 个新内容标签（如无限画布/侧边聊天/变更/终端），
 *    直接把新标签填回原槽位实现原位变身；
 * 3. 其它新标签一律追加到最右侧（紧挨「+」按钮）。
 */
export function reconcileTabOrder(prevOrder: readonly string[], currentKeys: readonly string[]): string[] {
  const currentSet = new Set(currentKeys);
  const prevSet = new Set(prevOrder);

  const removed = prevOrder.filter((key) => !currentSet.has(key));
  const added = currentKeys.filter((key) => !prevSet.has(key));

  // 单空白标签原位替换为新内容标签（如选中第 2 个「新标签页」点击「无限画布」）。
  if (removed.length === 1 && added.length === 1 && isBrowserKey(removed[0]!) && !isBrowserKey(added[0]!)) {
    const replacedKey = removed[0]!;
    const nextKey = added[0]!;
    return prevOrder.map((key) => (key === replacedKey ? nextKey : key));
  }

  const kept = prevOrder.filter((key) => currentSet.has(key));
  return [...kept, ...added];
}
