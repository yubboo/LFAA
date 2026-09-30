/** 功能：提供 lfaa-client-ui-shortcuts 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { useState, type KeyboardEvent } from "react";
import { Button, Input } from "antd";
import { type UserSettings } from "lfaa-client-connection/src/api.js";
export function shortcutFromEvent(event: KeyboardEvent<HTMLInputElement>): string {
  const modifiers = [event.ctrlKey || event.metaKey ? "Ctrl" : "", event.altKey ? "Alt" : "", event.shiftKey ? "Shift" : ""].filter(Boolean);
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return "";
  return [...modifiers, key].join("+");
}

export function shortcutIdentity(value: string): string {
  return value.split("+").map((part) => part.trim().toLocaleLowerCase()).sort().join("+");
}

export function hasShortcutConflicts(shortcuts: UserSettings["shortcuts"]): boolean {
  const identities = Object.values(shortcuts).flat().filter(Boolean).map(shortcutIdentity);
  return new Set(identities).size !== identities.length;
}

export function ShortcutRow({ title, value, onChange }: { title: string; value: string[]; onChange: (value: string[]) => void }) {
  function updateBinding(index: number, binding: string): void {
    onChange(value.map((item, itemIndex) => itemIndex === index ? binding : item));
  }

  function removeBinding(index: number): void {
    onChange(value.filter((_item, itemIndex) => itemIndex !== index));
  }

  const [listening, setListening] = useState(false);
  return <div className="settings-row settings-row--shortcuts"><div className="settings-row__copy"><strong>{title}</strong><span>每个动作最多绑定四组快捷键；组合键冲突时会暂停自动保存并提示。</span></div><div className="settings-row__control"><div className="settings-shortcut-list">{value.map((binding, index) => <div className="settings-shortcut-binding" key={`${index}-${binding}`}><Input readOnly value={listening ? "按下快捷键…" : binding || "点击录入快捷键"} onFocus={() => setListening(true)} onBlur={() => setListening(false)} onKeyDown={(event) => { if (!listening) return; event.preventDefault(); if (event.key === "Escape") { setListening(false); return; } const next = shortcutFromEvent(event); if (next) { updateBinding(index, next); setListening(false); event.currentTarget.blur(); } }} aria-label={`${title}快捷键 ${index + 1}`} /><Button type="text" danger aria-label={`移除${title}快捷键 ${index + 1}`} onClick={() => removeBinding(index)}>移除</Button></div>)}</div><Button className="settings-shortcut-add" type="dashed" disabled={value.length >= 4} onClick={() => onChange([...value, ""])}>＋ 添加快捷键</Button><small>{listening ? "按 Esc 取消录入" : `${value.filter(Boolean).length}/4 组绑定`}</small></div></div>;
}
