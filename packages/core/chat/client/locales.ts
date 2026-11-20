// 管理 @lfaa/chat 浏览器端界面中英文文案字典：聚合数据表与双语字典，并提供按语言取字典的入口。
import { readLocaleOverride } from "./general-settings-client";
import type { ChatLocaleMessages } from "./locales.types";
import { enMessages } from "./locales.en";
import { zhMessages } from "./locales.zh";

export * from "./locales.data";
export type { ChatLocaleMessages } from "./locales.types";

/** 优先使用设置中的语言，未指定时按浏览器语言选择字典。 */
export function getChatLocale(): ChatLocaleMessages {
  const override = readLocaleOverride();
  if (override === "zh") return zhMessages;
  if (override === "en") return enMessages;
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return zhMessages;
  }
  return typeof navigator === "undefined" ? zhMessages : enMessages;
}
