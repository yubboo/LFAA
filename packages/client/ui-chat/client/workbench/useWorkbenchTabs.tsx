// 订阅工作台插件标签贡献；同一工作台实例管理它们的打开、切换、持久化恢复与清理。
import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
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
  initialOpened: string[] = [],
  initialActive: string | null = null,
) {
  const snapshot = useSyncExternalStore(workbench?.subscribe ?? emptySubscribe, workbench?.getSnapshot ?? emptySnapshot, emptySnapshot);
  const [opened, setOpened] = useState<string[]>(initialOpened);
  const [selection, setSelection] = useState<{ id: string; request: unknown } | null>(() =>
    initialActive && initialOpened.includes(initialActive) ? { id: initialActive, request } : null,
  );
  const contributions = snapshot?.tabs ?? [];
  const activeId = selection && selection.request === request ? selection.id : null;
  const active = contributions.find((entry) => entry.id === activeId && opened.includes(entry.id));

  const show = (tabId: string) => {
    setOpened((current) => (current.includes(tabId) ? current : [...current, tabId]));
    setSelection({ id: tabId, request });
  };

  const leave = () => setSelection(null);

  // 切换会话或刷新恢复：按持久化记录还原已打开插件标签及激活态，不依赖插件是否已完成注册。
  const restoreTabs = useCallback((savedOpened: string[], savedActive: string | null) => {
    setOpened(savedOpened);
    setSelection(savedActive && savedOpened.includes(savedActive) ? { id: savedActive, request } : null);
  }, [request]);

  const content: ReactNode = active?.render({ projectId: projectId ?? snapshot?.activeProjectId ?? null, isZh });
  return {
    opened,
    activeId,
    content: active ? content : undefined,
    active: Boolean(active),
    leave,
    restoreTabs,
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
        if (activeId === entry.id) leave();
      },
    })),
  };
}
