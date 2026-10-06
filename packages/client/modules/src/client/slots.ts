/** 功能：在 LFAA React 根中呈现 DSH Client Slot。作用：统一透传 Slot key 与空内容 fallback。关联文件：client/index.ts、ui-renderer/src/render.tsx、各 Slot 消费页面。 */
import * as React from "react";

export type DshSlotRenderer = (name: string, owner: object, options?: { entryKey?: string; fallback?: React.ReactNode }) => React.ReactNode;

const dshSlotRendererContext = React.createContext<DshSlotRenderer | null>(null);
const EMPTY_SLOT_OWNER = Object.freeze({});

export function DshSlotRoot({ renderer, children }: { renderer: DshSlotRenderer; children: React.ReactNode }): React.ReactElement {
  return React.createElement(dshSlotRendererContext.Provider, { value: renderer }, children);
}

export function useDshSlotRenderer(): DshSlotRenderer | null {
  return React.useContext(dshSlotRendererContext);
}

export function DshSlotOutlet({ name, owner = EMPTY_SLOT_OWNER, entryKey, fallback }: { name: string; owner?: object; entryKey?: string; fallback?: React.ReactNode }): React.ReactElement {
  const renderer = useDshSlotRenderer();
  const options = entryKey || fallback !== undefined
    ? { ...(entryKey ? { entryKey } : {}), ...(fallback !== undefined ? { fallback } : {}) }
    : undefined;
  return React.createElement(React.Fragment, null, renderer ? renderer(name, owner, options) : fallback ?? null);
}
