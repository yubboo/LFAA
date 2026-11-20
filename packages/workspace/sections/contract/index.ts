// 定义自定义分区包在 Host 与 Client 间共享的无 DOM 领域数据结构。
import type { WorkbenchSectionItem } from "@lfaa/ui-layout";

/** 描述向工作台公开的分区标识、名称和显示信息。 */
export interface WorkspaceSectionSummary extends WorkbenchSectionItem {}

/** 定义新建分区提交给 Host 的字段。 */
export interface CreateSectionInput {
  name: string;
}

/** 定义分区重命名或更新时可选的字段。 */
export interface UpdateSectionInput {
  name: string;
}
