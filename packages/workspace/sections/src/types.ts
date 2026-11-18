// 定义自定义分区包在 Host 与 Client 间共享的无 DOM 领域数据结构。
import type { WorkbenchSectionItem } from "@lfaa/ui-layout";

export interface WorkspaceSectionSummary extends WorkbenchSectionItem {}

export interface CreateSectionInput {
  name: string;
}

export interface UpdateSectionInput {
  name: string;
}
