/** 功能：在 LFAA React 根中呈现 DSH Client Slot。作用：统一透传 Slot key 与空内容 fallback。关联文件：client/index.ts、ui-renderer/src/render.tsx、各 Slot 消费页面。 */
import * as React from "react";

export type DshSlotRenderer = (name: string, owner: object, options?: { entryKey?: string; only?: string; fallback?: React.ReactNode }) => React.ReactNode;

export interface DshSlotEntrySummary {
  id: string;
  key?: string;
  label?: string;
  order?: number;
}

export interface DshSlotRegistryReader {
  entries(name: string): readonly DshSlotEntrySummary[];
  subscribe(name: string, listener: () => void): () => void;
}

/** Public client extension contract used to replace the post-authentication entrance animation. */
export const LFAA_AUTH_TRANSITION_SLOT = "auth.transition";
export type AuthTransitionPhase = "idle" | "preparing" | "entering";
export interface AuthTransitionSlotOwner {
  phase: Exclude<AuthTransitionPhase, "idle">;
  reducedMotion: boolean;
}

const dshSlotRendererContext = React.createContext<DshSlotRenderer | null>(null);
const dshSlotRegistryContext = React.createContext<DshSlotRegistryReader | null>(null);
const EMPTY_SLOT_OWNER = Object.freeze({});

export function DshSlotRoot({ renderer, registry, children }: { renderer: DshSlotRenderer; registry?: DshSlotRegistryReader; children: React.ReactNode }): React.ReactElement {
  return React.createElement(dshSlotRendererContext.Provider, { value: renderer },
    React.createElement(dshSlotRegistryContext.Provider, { value: registry ?? null }, children));
}

export function useDshSlotRenderer(): DshSlotRenderer | null {
  return React.useContext(dshSlotRendererContext);
}

export function useDshSlotEntries(name: string): readonly DshSlotEntrySummary[] {
  const registry = React.useContext(dshSlotRegistryContext);
  const [entries, setEntries] = React.useState<readonly DshSlotEntrySummary[]>(() => registry?.entries(name) ?? []);
  React.useEffect(() => {
    if (!registry) {
      setEntries(current => current.length === 0 ? current : []);
      return;
    }
    const update = () => {
      const next = registry.entries(name);
      setEntries(current => current.length === next.length && current.every((entry, index) => {
        const candidate = next[index];
        return candidate !== undefined && entry.id === candidate.id && entry.key === candidate.key
          && entry.label === candidate.label && entry.order === candidate.order;
      }) ? current : next);
    };
    const unsubscribe = registry.subscribe(name, update);
    update();
    return unsubscribe;
  }, [name, registry]);
  return entries;
}

export function DshSlotOutlet({ name, owner = EMPTY_SLOT_OWNER, entryKey, only, fallback }: { name: string; owner?: object; entryKey?: string; only?: string; fallback?: React.ReactNode }): React.ReactElement {
  const renderer = useDshSlotRenderer();
  const options = entryKey || only || fallback !== undefined
    ? { ...(entryKey ? { entryKey } : {}), ...(only ? { only } : {}), ...(fallback !== undefined ? { fallback } : {}) }
    : undefined;
  return React.createElement(React.Fragment, null, renderer ? renderer(name, owner, options) : fallback ?? null);
}
