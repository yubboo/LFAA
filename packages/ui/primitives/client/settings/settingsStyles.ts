// 合并设置中心两层样式模块（排版层 + 控件层），让各设置页仍只导入一个 settingsStyles 对象。
import surface from "./SettingsSurface.module.css";
import controls from "./SettingsControls.module.css";

/** 设置页可用的全部 class 名：排版层与控件层合并，冲突时以控件层为准。 */
export const settingsStyles: Readonly<Record<string, string>> = { ...surface, ...controls };