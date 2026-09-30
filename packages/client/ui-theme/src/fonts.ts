/** 功能：提供 lfaa-client-ui-theme 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { type AppearanceCodeFont, type AppearanceTextFont } from "lfaa-client-connection/src/api.js";
export const appearanceTextFontStacks: Record<AppearanceTextFont, string> = {
  system: 'Geist, "Segoe UI Variable", "Microsoft YaHei", sans-serif',
  sans: 'Arial, "Microsoft YaHei", sans-serif',
  serif: 'Georgia, "Noto Serif CJK SC", serif'
};

export const appearanceCodeFontStacks: Record<AppearanceCodeFont, string> = {
  system: 'Consolas, "Cascadia Code", monospace',
  cascadia: '"Cascadia Code", Consolas, monospace',
  consolas: 'Consolas, "Cascadia Code", monospace',
  jetbrains: '"JetBrains Mono", Consolas, monospace'
};
