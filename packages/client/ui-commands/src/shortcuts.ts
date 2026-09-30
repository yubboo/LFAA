/** 功能：提供 lfaa-client-ui-commands 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */

export function shortcutMatches(event: KeyboardEvent, chord: string): boolean {
  const parts = chord.split("+").map((part) => part.toLocaleLowerCase());
  const key = parts.at(-1) ?? "";
  return event.key.toLocaleLowerCase() === key
    && Boolean(event.ctrlKey || event.metaKey) === parts.includes("ctrl")
    && Boolean(event.altKey) === parts.includes("alt")
    && Boolean(event.shiftKey) === parts.includes("shift");
}
