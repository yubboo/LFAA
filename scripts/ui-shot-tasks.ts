// 截图任务清单：每条任务 = 名称 + 分组 + 说明 + 视口/主题 + 交互步骤。
// 供 scripts/ui-shot.mts 执行；新增任务时同时补一条同名断言（见 .agent/skills/ui-screenshot/SKILL.md）。
import type { Page } from "playwright-core";

/** 一步交互；按顺序执行，执行完再截图。 */
export type ShotStep =
  | { click: string }
  | { clickText: string }
  | { hover: string }
  | { press: string }
  | { wait: number };

/** 一条截图任务。 */
export interface ShotTask {
  name: string;
  group: "app" | "settings" | "pages";
  description: string;
  width?: number;
  height?: number;
  theme?: "light" | "dark";
  steps?: ShotStep[];
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

  // 设置中心弹窗：外观、常规、模型、Git、代码审查、手机布局。
  settingsTask("settings-appearance-light", "设置中心 · 外观（浅色）", [], { theme: "light" }),
  settingsTask("settings-appearance-dark", "设置中心 · 外观（深色）", [], { theme: "dark" }),
  settingsTask("settings-general", "设置中心 · 常规", [{ clickText: "常规" }, { wait: 800 }], { theme: "dark" }),
  settingsTask("settings-models", "设置中心 · 模型与规则配置", [{ clickText: "模型与规则配置" }, { wait: 900 }], { theme: "dark" }),
  settingsTask("settings-git", "设置中心 · Git", [{ clickText: "Git" }, { wait: 800 }], { theme: "dark" }),
  settingsTask("settings-review", "设置中心 · 代码审查", [{ clickText: "代码审查" }, { wait: 900 }], { theme: "dark" }),
  settingsTask("settings-mobile", "设置中心 · 手机布局", [], { theme: "dark", width: 390, height: 844 }),

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
    await page.locator(step.hover).first().hover({ timeout: 15000 });
    return;
  }
  if ("press" in step) {
    await page.keyboard.press(step.press);
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