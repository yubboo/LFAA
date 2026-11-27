// 订阅工作台插件标签贡献；同一工作台实例管理它们的打开、切换与清理。
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { IconLayoutGrid } from "@tabler/icons-react";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";

const emptySnapshot = () => null;
const emptySubscribe = () => () => {};

export function useWorkbenchTabs(
  workbench: WorkbenchClientService | undefined,
  projectId: string | null,
  isZh: boolean,
  request: unknown,
  onOpenFromStartPage?: () => void,
) {
  const snapshot = useSyncExternalStore(workbench?.subscribe ?? emptySubscribe, workbench?.getSnapshot ?? emptySnapshot, emptySnapshot);
  const [opened, setOpened] = useState<string[]>([]);
  const [selection, setSelection] = useState<{ id: string; request: unknown } | null>(null);
  const contributions = snapshot?.tabs ?? [];
  const id = selection?.request === request ? selection?.id : undefined;
  const active = contributions.find((entry) => entry.id === id && opened.includes(entry.id));
  const show = (tabId: string) => {
    setOpened((current) => current.includes(tabId) ? current : [...current, tabId]);
    setSelection({ id: tabId, request });
  };
  const leave = () => setSelection(null);
  const content: ReactNode = active?.render({ projectId: projectId ?? snapshot?.activeProjectId ?? null, isZh });
  return {
    content: active ? content : undefined,
    active: Boolean(active),
    leave,
    shortcuts: contributions.map((entry) => (
      <button
        key={entry.id}
        type="button"
        onClick={() => {
          onOpenFromStartPage?.();
          show(entry.id);
        }}
      >
        <IconLayoutGrid size={19} stroke={1.7} aria-hidden="true" />
        <span>{isZh ? entry.title.zh : entry.title.en}</span>
      </button>
    )),
    tabs: contributions.filter((entry) => opened.includes(entry.id)).map((entry) => ({
      id: entry.id, title: isZh ? entry.title.zh : entry.title.en, active: entry.id === active?.id,
      select: () => show(entry.id),
      close: () => {
        setOpened((current) => current.filter((tabId) => tabId !== entry.id));
        if (active?.id === entry.id) leave();
      },
    })),
  };
}
