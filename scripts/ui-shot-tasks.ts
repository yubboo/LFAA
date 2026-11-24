// 截图任务清单：每条任务 = 名称 + 分组 + 说明 + 视口/主题 + 交互步骤。
// 供 scripts/ui-shot.mts 执行；新增任务时同时补一条同名断言（见 .agent/skills/ui-screenshot/SKILL.md）。
import type { Page } from "playwright-core";

/** 一步交互；按顺序执行，执行完再截图。 */
export type ShotStep =
  | { click: string }
  | { clickText: string }
  | { hover: string }
  | { press: string }
  | { wait: number }
  /** 把指针移到匹配滚动容器的滚动条上，验证滑块悬停态。 */
  | { hoverScrollbar: string }
  /** 让匹配的滚动容器滚一段，验证滚动中的滑块高亮。 */
  | { scroll: string }
  /** 把匹配元素的水平中线拖到视口 x 坐标，用于复现中间栏收窄后的布局。 */
  | { drag: string; toX: number };

/** 一条截图任务。 */
export interface ShotTask {
  name: string;
  group: "app" | "settings" | "pages";
  description: string;
  width?: number;
  height?: number;
  theme?: "light" | "dark";
  steps?: ShotStep[];
  /** 需要看到滚动条的任务：用不带 --hide-scrollbars 的浏览器实例出图。 */
  scrollbars?: boolean;
}

/** 打开设置弹窗的标准步骤：用户菜单 → 设置（设置中心改成弹窗后仍需这两步）。 */
const OPEN_SETTINGS: ShotStep[] = [
  { click: 'button[aria-label="用户菜单"]' },
  { wait: 500 },
  { clickText: "设置" },
  { wait: 900 },
];

/** 生成一条「设置中心」任务，省掉重复的打开步骤。 */
function settingsTask(name: string, description: string, steps: ShotStep[] = [], options: Partial<ShotTask> = {}): ShotTask {
  return { name, group: "settings", description, steps: [...OPEN_SETTINGS, ...steps], ...options };
}

export const TASKS: ShotTask[] = [
  // 应用壳层：四栏、宽屏、窄窗、手机、空白新聊天。
  { name: "app-home-light", group: "app", description: "工作区首页（浅色四栏）", theme: "light" },
  { name: "app-home-dark", group: "app", description: "工作区首页（深色四栏）", theme: "dark" },
  { name: "app-home-wide", group: "app", description: "1920 宽屏首页", theme: "dark", width: 1920, height: 1080 },
  { name: "app-home-narrow", group: "app", description: "1024 窄窗首页", theme: "dark", width: 1024, height: 768 },
  { name: "app-mobile-home", group: "app", description: "390 手机首页", theme: "dark", width: 390, height: 844 },
  {
    name: "app-chat-empty",
    group: "app",
    description: "新建聊天后的空态输入台",
    theme: "dark",
    steps: [{ clickText: "新聊天" }, { wait: 1200 }],
  },
  // 折叠交互：左二栏收起后中间工作区应平滑填满，折叠按钮改由共享组件渲染。
  {
    name: "app-sidebar-collapsed",
    group: "app",
    description: "收起左二栏后的工作区（折叠按钮与面板过渡）",
    theme: "dark",
    steps: [{ click: 'header button[data-side="left"]' }, { wait: 700 }],
  },
  // 中心区「工作」形态：分段切到工作后，输入栏应带项目、权限与会话模式全套入口。
  {
    name: "app-center-work",
    group: "app",
    description: "中心区「工作」形态（项目 / 权限 / 会话模式全量输入栏）",
    theme: "dark",
    steps: [{ clickText: "工作" }, { wait: 800 }],
  },
  // 项目内空会话的范围提示条：只在「工作」模式出现，聊天模式不该有。
  {
    name: "app-center-work-project",
    group: "app",
    description: "项目内「工作」模式：输入栏上方的项目范围提示条（深色）",
    theme: "dark",
    steps: [
      { hover: "text=app1" },
      { wait: 500 },
      { click: 'button[aria-label^="在该项目里开新聊天"]' },
      { wait: 1100 },
      { clickText: "工作" },
      { wait: 800 },
    ],
  },
  // 收窄右栏后中间栏只剩约 400px：项目/位置并入输入卡片头行，模式与模型收成图标且工具栏不溢出。
  {
    name: "app-center-work-narrow",
    group: "app",
    description: "窄中间栏「工作」输入栏（图标化模式/模型，位置/项目在卡片头行）",
    theme: "dark",
    steps: [
      { hover: "text=app1" },
      { wait: 500 },
      { click: 'button[aria-label^="在该项目里开新聊天"]' },
      { wait: 1100 },
      { clickText: "工作" },
      { wait: 800 },
      { drag: '[data-resize-side="right"]', toX: 760 },
      { wait: 800 },
    ],
  },
  {
    name: "app-center-work-narrow-light",
    group: "app",
    description: "窄中间栏「工作」输入栏（浅色）",
    theme: "light",
    steps: [
      { hover: "text=app1" },
      { wait: 500 },
      { click: 'button[aria-label^="在该项目里开新聊天"]' },
      { wait: 1100 },
      { clickText: "工作" },
      { wait: 800 },
      { drag: '[data-resize-side="right"]', toX: 760 },
      { wait: 800 },
    ],
  },
  {
    name: "app-center-work-project-light",
    group: "app",
    description: "项目内「工作」模式：输入栏上方的项目范围提示条（浅色）",
    theme: "light",
    steps: [
      { hover: "text=app1" },
      { wait: 500 },
      { click: 'button[aria-label^="在该项目里开新聊天"]' },
      { wait: 1100 },
      { clickText: "工作" },
      { wait: 800 },
    ],
  },
  {
    name: "app-center-chat-project",
    group: "app",
    description: "项目内「聊天」模式：不应出现项目范围提示条",
    theme: "light",
    steps: [
      { hover: "text=app1" },
      { wait: 500 },
      { click: 'button[aria-label^="在该项目里开新聊天"]' },
      { wait: 1100 },
    ],
  },

  // 设置中心弹窗：外观、常规、模型、Git、代码审查、手机布局。
  settingsTask("settings-appearance-light", "设置中心 · 外观（浅色）", [{ clickText: "外观" }, { wait: 800 }], { theme: "light" }),
  settingsTask("settings-appearance-dark", "设置中心 · 外观（深色）", [{ clickText: "外观" }, { wait: 800 }], { theme: "dark" }),
  // 外观页下拉菜单必须画在设置弹窗之上：之前菜单被弹窗遮罩压住，触发器看得见、选项点不到。
  settingsTask("settings-appearance-menu", "设置中心 · 外观下拉菜单（层级高于弹窗）", [
    { clickText: "外观" },
    { wait: 700 },
    { click: 'button[aria-label="主题预设"]' },
    { wait: 500 },
  ], { theme: "dark" }),
  settingsTask("settings-general", "设置中心 · 常规", [{ clickText: "常规" }, { wait: 800 }], { theme: "dark" }),
  settingsTask("settings-models", "设置中心 · 模型与规则", [{ clickText: "模型与规则" }, { wait: 900 }], { theme: "dark" }),
  settingsTask("settings-mcp-light", "设置中心 · MCP（浅色）", [{ clickText: "MCP" }, { wait: 600 }], { theme: "light" }),
  settingsTask("settings-mcp-dark", "设置中心 · MCP 添加表单（深色）", [{ clickText: "MCP" }, { clickText: "添加服务器" }, { wait: 400 }], { theme: "dark" }),
  settingsTask("settings-mcp-mobile", "设置中心 · MCP 导入表单（手机）", [{ clickText: "MCP" }, { clickText: "导入 JSON" }, { wait: 400 }], { theme: "light", width: 390, height: 844 }),
  settingsTask("settings-git", "设置中心 · Git", [{ clickText: "Git" }, { wait: 800 }], { theme: "dark" }),
  settingsTask("settings-review", "设置中心 · 代码审查", [{ clickText: "代码审查" }, { wait: 900 }], { theme: "dark" }),
  settingsTask("settings-mobile", "设置中心 · 手机布局", [], { theme: "dark", width: 390, height: 844 }),
  // 滚动条外观：Playwright 默认隐藏滚动条，这两条任务单独去掉该参数，才能看到强调色滑块。
  settingsTask("settings-scrollbar-light", "设置中心 · 外观（浅色，滚动条可见）", [], { theme: "light", scrollbars: true }),
  settingsTask("settings-scrollbar-dark", "设置中心 · 常规（深色，滚动条可见）", [{ clickText: "常规" }, { wait: 800 }], { theme: "dark", scrollbars: true }),
  settingsTask("settings-scrollbar-hover-light", "设置中心 · 目录滚动条悬停加深", [
    { hoverScrollbar: 'aside [data-axis="y"]' },
    { wait: 200 },
  ], { theme: "light", scrollbars: true }),
  settingsTask("settings-scrollbar-scroll-dark", "设置中心 · 正文滚动中的滑块高亮", [
    { clickText: "常规" },
    { wait: 800 },
    { scroll: 'section [data-axis="y"]' },
  ], { theme: "dark", scrollbars: true }),

  // 其它主页面：资料库、代码审查、Agents、群聊。
  { name: "library", group: "pages", description: "资料库", theme: "dark", steps: [{ click: 'button[aria-label="资料库"]' }, { wait: 1500 }] },
  {
    name: "review",
    group: "pages",
    description: "代码审查",
    theme: "dark",
    steps: [
      { click: 'button[aria-label="更多"]' },
      { wait: 500 },
      { clickText: "代码审查" },
      { wait: 1500 },
    ],
  },
  { name: "agents", group: "pages", description: "Agents 页", theme: "dark", steps: [{ click: 'button[aria-label="Agents"]' }, { wait: 1500 }] },
  { name: "group-chat", group: "pages", description: "群聊页", theme: "dark", steps: [{ click: 'button[aria-label="群聊"]' }, { wait: 1500 }] },
];

/** 执行一步交互；找不到元素时抛错，由调用方记为该任务失败。 */
async function applyStep(page: Page, step: ShotStep): Promise<void> {
  if ("click" in step) {
    await page.locator(step.click).first().click({ timeout: 15000 });
    return;
  }
  if ("clickText" in step) {
    await page.getByText(step.clickText, { exact: true }).first().click({ timeout: 15000 });
    return;
  }
  if ("hover" in step) {
    // force：行内操作按钮浮出后可能盖住行标题，强制按位置移动鼠标即可触发行悬停。
    await page.locator(step.hover).first().hover({ timeout: 15000, force: true });
    return;
  }
  if ("press" in step) {
    await page.keyboard.press(step.press);
    return;
  }
  if ("hoverScrollbar" in step) {
    const box = await page.locator(step.hoverScrollbar).first().boundingBox();
    if (!box) throw new Error(`找不到滚动容器：${step.hoverScrollbar}`);
    // 纵向滚动条占据内联末端 10px，取胶囊中线下缘即可命中滑块。
    await page.mouse.move(box.x + box.width - 5, box.y + box.height / 2);
    return;
  }
  if ("scroll" in step) {
    await page.locator(step.scroll).first().evaluate((element) => {
      (element as HTMLElement).scrollBy({ top: 160 });
    });
    return;
  }
  if ("drag" in step) {
    const box = await page.locator(step.drag).first().boundingBox();
    if (!box) throw new Error(`找不到拖拽目标：${step.drag}`);
    const midY = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, midY);
    await page.mouse.down();
    await page.mouse.move(step.toX, midY, { steps: 12 });
    await page.mouse.up();
    return;
  }
  await page.waitForTimeout(step.wait);
}

/** 依次执行任务步骤。 */
export async function applySteps(page: Page, steps: ShotStep[] | undefined): Promise<void> {
  for (const step of steps ?? []) {
    await applyStep(page, step);
  }
}