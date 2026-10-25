/**
 * 功能：生成电脑操控时间线的动作标题与回执摘要。
 * 作用：展示真实驱动状态，同时不保存桌面截图或用户输入正文。
 * 关联文件：execute-turn.ts、../README.md。
 */

const computerUseActivityTitles: Record<string, string> = {
  "computer-use.observe": "观察本机桌面",
  "computer-use.click": "点击桌面坐标",
  "computer-use.type-text": "向目标窗口输入文本",
  "computer-use.hotkey": "向目标窗口发送快捷键",
  "computer-use.scroll": "滚动桌面位置"
};

export function computerUseActivityTitle(toolId: string): string | null {
  return computerUseActivityTitles[toolId] ?? null;
}

export function computerUseActivitySummary(value: unknown, toolId: string, parameters?: Record<string, unknown> | null): string | null {
  if (!toolId.startsWith("computer-use.")) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "本机桌面驱动没有返回可用回执；不能据此确认屏幕状态。";

  const result = value as Record<string, unknown>;
  if (toolId === "computer-use.observe") {
    return result.screenshotForwarded === true
      ? "已将一张桌面截图临时交给本轮模型；截图未保存，屏幕结论须以本轮实际观察为准。"
      : "没有向模型交付可用截图；本次不能据此确认屏幕状态。";
  }

  const args = parameters ?? {};
  const targetWindow = Number.isSafeInteger(args.pid) && typeof args.windowId === "string" && /^[1-9][0-9]{0,19}$/u.test(args.windowId)
    ? `窗口 ${args.windowId}（进程 ${args.pid}）`
    : "主显示器前景";
  if (result.isError === true) {
    const errorCode = typeof result.errorCode === "string" && /^[A-Za-z0-9_.-]{1,48}$/u.test(result.errorCode) ? `（${result.errorCode}）` : "";
    return `本机桌面驱动报告操作失败${errorCode}；界面结果未核实。`;
  }

  if (toolId === "computer-use.click") {
    const coordinate = Number.isSafeInteger(args.x) && Number.isSafeInteger(args.y) ? `坐标 (${args.x}, ${args.y})` : "屏幕坐标";
    const buttons: Record<string, string> = { left: "左键", right: "右键", middle: "中键" };
    const button = typeof args.button === "string" ? buttons[args.button] ?? "左键" : "左键";
    const count = args.count === 2 ? "双击" : "点击";
    const effects: Record<string, string> = {
      confirmed: "驱动确认请求已执行",
      partial: "驱动报告部分执行",
      unverifiable: "驱动未能确认是否执行",
      suspected_noop: "驱动判断动作可能未生效",
      refused: "驱动拒绝执行"
    };
    const effect = typeof result.effect === "string" ? effects[result.effect] ?? "驱动回执状态未知" : "驱动回执状态未知";
    return `在${coordinate} ${button}${count}；${effect}，界面变化仍需后续观察核实。`;
  }
  if (toolId === "computer-use.type-text") return `已收到向${targetWindow}输入文本的驱动回执（正文未保存）；是否输入成功及界面效果仍需后续观察核实。`;
  if (toolId === "computer-use.hotkey") {
    const keys = Array.isArray(args.keys) ? args.keys.filter((key): key is string => typeof key === "string" && /^[A-Za-z0-9+ _.-]{1,24}$/u.test(key)).slice(0, 6).join("+") : "快捷键";
    return `已收到向${targetWindow}发送 ${keys || "快捷键"} 的驱动回执；是否生效及界面效果仍需后续观察核实。`;
  }
  if (toolId === "computer-use.scroll") {
    const directions: Record<string, string> = { up: "向上", down: "向下", left: "向左", right: "向右" };
    const direction = typeof args.direction === "string" ? directions[args.direction] ?? "指定方向" : "指定方向";
    const amount = Number.isSafeInteger(args.amount) && Number(args.amount) >= 1 && Number(args.amount) <= 10 ? ` ${args.amount} 格` : "";
    const coordinate = Number.isSafeInteger(args.x) && Number.isSafeInteger(args.y) ? `坐标 (${args.x}, ${args.y})` : "指定位置";
    return `已收到在${coordinate}${direction}滚动${amount}的驱动回执；是否生效及界面变化仍需后续观察核实。`;
  }
  return "本机桌面驱动已返回操作回执；截图、输入正文与其他屏幕内容未写入记录。";
}
