// 通过 /api/workspace/sections* 与 Host SectionsService 同步分区列表，并用本地缓存实现首屏无闪烁秒开与静默校对。
import type { WorkbenchSectionItem } from "@lfaa/ui-layout";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
import type { WorkspaceSectionSummary } from "@lfaa/sections/contract";

const SECTIONS_CACHE_KEY = "lfaa:cache-sections";

function isSectionArray(value: unknown): value is WorkspaceSectionSummary[] {
  return Array.isArray(value) && value.every(
    (item) => typeof item === "object"
      && item !== null
      && typeof (item as WorkspaceSectionSummary).id === "string"
      && typeof (item as WorkspaceSectionSummary).name === "string",
  );
}

/** 描述当前创建或重命名分区弹窗的可订阅状态。 */
export type SectionDialogState =
  | { kind: "create" }
  | { kind: "rename"; section: WorkbenchSectionItem }
  | null;

async function readJsonSafe<T>(response: Response): Promise<(T & { error?: string }) | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return null;
  }
}

/** 维护分区列表与相关弹窗状态，将持久化委托给 Host。 */
export class SectionStore {
  private readonly listeners = new Set<() => void>();
  private readonly dialogListeners = new Set<() => void>();
  private sections: WorkspaceSectionSummary[] = readStoredJson(SECTIONS_CACHE_KEY, [], isSectionArray);
  private dialogState: SectionDialogState = null;
  private disposed = false;

  constructor(private readonly onDeleted?: (sectionId: string) => void) {
    if (typeof window !== "undefined") {
      void this.refreshSections();
    }
  }

  private commitSections(nextSections: WorkspaceSectionSummary[]): void {
    const changed = JSON.stringify(nextSections) !== JSON.stringify(this.sections);
    this.sections = nextSections;
    writeStoredJson(SECTIONS_CACHE_KEY, nextSections);
    if (changed) this.emit();
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
    this.dialogListeners.clear();
  }

  private emit(): void {
    if (this.disposed) return;
    for (const listener of this.listeners) listener();
  }

  private emitDialog(): void {
    if (this.disposed) return;
    for (const listener of this.dialogListeners) listener();
  }

  getSections = (): WorkbenchSectionItem[] => this.sections;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getDialogState = (): SectionDialogState => this.dialogState;

  subscribeDialog = (listener: () => void): (() => void) => {
    this.dialogListeners.add(listener);
    return () => {
      this.dialogListeners.delete(listener);
    };
  };

  hasSectionName(name: string, excludeId?: string): boolean {
    const key = name.trim().toLowerCase();
    if (!key) return false;
    return this.sections.some(
      (item) => item.id !== excludeId && item.name.trim().toLowerCase() === key,
    );
  }

  openCreateDialog = (): void => {
    this.dialogState = { kind: "create" };
    this.emitDialog();
  };

  openRenameDialog = (section: WorkbenchSectionItem): void => {
    this.dialogState = { kind: "rename", section };
    this.emitDialog();
  };

  closeDialog = (): void => {
    this.dialogState = null;
    this.emitDialog();
  };

  async refreshSections(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const response = await fetch("/api/workspace/sections");
      if (!response.ok) return;
      const data = await readJsonSafe<{ sections?: WorkspaceSectionSummary[] }>(response);
      if (data && Array.isArray(data.sections)) {
        this.commitSections(data.sections);
      }
    } catch {
      // 保留当前快照，避免短暂请求异常清空分区列表。
    }
  }

  async createSection(name: string): Promise<WorkspaceSectionSummary> {
    const response = await fetch("/api/workspace/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await readJsonSafe<{ section?: WorkspaceSectionSummary }>(response);
    if (!response.ok || !data?.section) {
      throw new Error(data?.error ?? `创建分区失败（HTTP ${response.status}）。`);
    }
    this.commitSections([...this.sections, data.section]);
    return data.section;
  }

  async renameSection(sectionId: string, name: string): Promise<WorkspaceSectionSummary> {
    const response = await fetch(`/api/workspace/sections/${encodeURIComponent(sectionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await readJsonSafe<{ section?: WorkspaceSectionSummary }>(response);
    if (!response.ok || !data?.section) {
      throw new Error(data?.error ?? `重命名分区失败（HTTP ${response.status}）。`);
    }
    this.commitSections(this.sections.map((item) => (item.id === data.section?.id ? data.section : item)));
    return data.section;
  }

  async removeSection(sectionId: string): Promise<boolean> {
    const response = await fetch(`/api/workspace/sections/${encodeURIComponent(sectionId)}`, {
      method: "DELETE",
    });
    if (!response.ok) return false;
    this.commitSections(this.sections.filter((item) => item.id !== sectionId));
    this.onDeleted?.(sectionId);
    return true;
  }
}
