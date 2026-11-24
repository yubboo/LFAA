// 浏览器专属子智能体辅助：工具白名单判定、可读步骤标签映射、浏览器类型识别与专属系统指令拼装。
import type { Context } from "@deepseek-ai/cordis";

const BROWSER_STEP_LABELS: Record<string, string> = {
  browser_navigate: "打开网页",
  browser_tabs: "管理标签页",
  browser_click: "点击元素",
  browser_hover: "悬停元素",
  browser_type: "输入内容",
  browser_press_key: "发送按键",
  browser_scroll: "滚动页面",
  browser_screenshot: "截取页面画面",
  browser_visual_check: "视觉截图验收",
  browser_evaluate: "页面脚本核查",
  browser_console: "检查控制台日志",
  browser_network: "检查网络请求",
  read_image: "解析页面截图",
};

/** 判定工具是否属于浏览器专属子智能体允许调用的隔离集合。 */
export function isBrowserSubagentTool(name: string): boolean {
  return name.startsWith("browser_") || name === "read_image";
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

/** 构造浏览器专属子智能体的聚焦指令，约束其闭环实测并回传精简结构化结论。 */
export function buildBrowserSubagentPrompt(role: string, prompt: string, browserLabel: string): string {
  return [
    `[专属浏览器子智能体：${role} · 运行环境：${browserLabel}]`,
    "你专门负责替主 Agent 操控右侧工作台的浏览器完成网页浏览、交互实测与视觉验收，严禁编造未验证的结果：",
    "1. 先使用 browser_navigate（需要对照多页面时用 browser_tabs 新建/切换标签）打开目标地址；",
    "2. 按任务要求执行真实的点击、输入、滚动或按键交互，并检查 browser_console 与 browser_network 确认是否存在报错或失败请求；",
    "3. 调用 browser_screenshot 与 browser_visual_check（传入验收要点 requirements）核对页面视觉表现；若当前模型不支持看图，立即改用 browser_evaluate 读取关键元素的尺寸、样式与运行状态，不要重复失败的看图调用；",
    "4. 若遇到用户已手动接管浏览器暂停自动化，立即如实汇报并停止继续操作；",
    "5. 完成后向主 Agent 返回简明结构化报告：访问 URL、已执行操作、控制台/网络异常数、视觉或 DOM 验收结论（PASS / NEEDS_FIX）以及发现的具体问题列表。",
    "",
    `任务目标：\n${prompt}`,
  ].join("\n");
}
