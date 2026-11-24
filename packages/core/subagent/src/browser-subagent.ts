// 浏览器专属子智能体辅助：工具白名单判定、可读步骤标签映射、浏览器类型识别与专属系统指令拼装。
import type { Context } from "@deepseek-ai/cordis";

const BROWSER_STEP_LABELS: Record<string, string> = {
  browser_navigate: "打开网页",
  browser_snapshot: "定位页面元素",
  browser_tabs: "管理标签页",
  browser_click: "点击元素",
  browser_hover: "悬停元素",
  browser_type: "输入内容",
  browser_press_key: "发送按键",
  browser_scroll: "滚动页面",
  browser_set_viewport: "切换设备视口",
  browser_screenshot: "截取页面画面",
  browser_visual_check: "视觉截图验收",
  browser_evaluate: "页面脚本核查",
  browser_console: "检查控制台日志",
  browser_network: "检查网络请求",
  read_image: "解析页面截图",
};

/** 判定工具是否属于浏览器专属子智能体允许调用的隔离集合。 */
export function isBrowserSubagentTool(name: string): boolean {
  return (name.startsWith("browser_") && name !== "browser_present") || name === "read_image";
}

/** 将工具名转为面向用户思维链卡片的可读动作名。 */
export function formatSubagentToolLabel(toolName: string): string {
  return BROWSER_STEP_LABELS[toolName] ?? toolName;
}

/** 安全探测宿主当前浏览器形态（不强耦合 @lfaa/browser 源码，且遵守 Cordis inject 校验）：区分「内置浏览器」与「桌面浏览器」。 */
export async function detectBrowserLabel(ctx: Context): Promise<string> {
  try {
    const getter = (ctx as { get?: (name: string) => unknown }).get;
    const browserSvc = (typeof getter === "function" ? getter.call(ctx, "browser") : undefined) as
      | { getSettings?: () => Promise<{ headless?: boolean }> }
      | undefined;
    if (!browserSvc?.getSettings) return "内置浏览器";
    const cfg = await browserSvc.getSettings();
    return cfg?.headless === false ? "桌面浏览器" : "内置浏览器";
  } catch {
    return "内置浏览器";
  }
}

/** 构造浏览器专属子智能体的聚焦指令，约束其按清单定向实测、禁止盲扫并在步数预算内快速回传结构化结论。 */
export function buildBrowserSubagentPrompt(role: string, prompt: string, browserLabel: string): string {
  return [
    `[专属浏览器子智能体：${role} · 运行环境：${browserLabel}]`,
    "步数预算：默认最多 15 步，力争 6–10 步内高效完成。只完成下方委派的检查项，绝不擅自扩大范围。",
    "1. 定位页面：先用 browser_tabs(list) 确认活动标签，仅在目标页未打开时调一次 browser_navigate。若任务只是打开/定位页面，到达后立即返回。",
    "2. 真人交互：先调一次 browser_snapshot 拿元素 ref，再按清单真实调用 browser_click、browser_type、browser_scroll、browser_press_key 验证核心交互，并尽量填写 target（用户认得的控件/区域名）。严禁用 browser_evaluate 修改 scrollTop / window.scrollTo 逐屏盲扫或模拟点击。",
    "3. 精简取证：视觉核查直接调用 browser_visual_check（内部已自动截图，严禁先调 browser_screenshot 再调 browser_visual_check 双重截图），整轮视觉抽检控制在 1–3 次关键区域；控制台和网络检查各最多 1 次。",
    "4. 立即收口：委派清单测完、发现明确需修复的缺陷、遇到用户接管或连续 2 步无新证据时立即返回。按「清单结论（通过/需修复/未验证）→ 实际操作与观察 → 具体缺陷位置与复现」精简汇报。",
    "",
    `任务目标：\n${prompt}`,
  ].join("\n");
}
