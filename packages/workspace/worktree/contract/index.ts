// 定义 Git 工作树的公开契约：记录、创建/删除输入、状态与目录检查结果，无 Node 或 DOM 依赖。
export interface WorktreeRecord {
  id: string;
  projectId: string;
  /** 项目主工作区（git rev-parse --show-toplevel）。 */
  repositoryRoot: string;
  /** 工作树目录绝对路径，位于项目仓库同级。 */
  path: string;
  branch: string;
  /** 创建时检出的提交，供审计与后续合并参考。 */
  baseCommit: string;
  /** 起点分支名（HEAD 会解析成当前分支）；旧记录可能缺省。 */
  baseRef?: string;
  createdAt: number;
}

/** 创建输入：分支必填，起点缺省为 HEAD；只接受本地 ref 或提交哈希。 */
export interface CreateWorktreeInput {
  projectId: string;
  branch: string;
  from?: string;
}

/** 工作树对外状态：记录 + 实时目录/变更/绑定会话数量。 */
export interface WorktreeStatus extends WorktreeRecord {
  exists: boolean;
  dirtyCount: number;
  /** 相对起点分支领先/落后的提交数；目录不可用时为 0。 */
  ahead: number;
  behind: number;
  /** 由装配层注入的会话计数器汇总，工作树服务本身不读取会话。 */
  sessionCount: number;
}

/** 删除选项：默认拒绝有绑定会话或未提交改动的目录。 */
export interface RemoveWorktreeOptions {
  force?: boolean;
}

/** 工作树目录中的一条只读条目。 */
export interface WorktreeInspectionEntry {
  name: string;
  kind: "directory" | "file";
  size?: number;
  updatedAt: number;
}

/** 合并预演结果：只读检查，不写入主工作区或 Git 索引。 */
export interface WorktreeMergePreview {
  worktreeId: string;
  baseRef: string;
  branch: string;
  /** 主工作区当前分支是否就是起点分支。 */
  baseBranchCheckedOut: boolean;
  /** 主工作区是否有未提交改动；有改动时合并前需要先处理。 */
  mainDirty: boolean;
  /** 工作树是否没有领先提交（已全部合入）。 */
  upToDate: boolean;
  /** Git merge-tree 判定为可干净合并。 */
  clean: boolean;
  /** 预演发现的冲突文件。 */
  conflicts: string[];
  error?: string;
}

/** 工作树目录的只读快照，供右栏文件树复用。 */
export interface WorktreeInspection {
  worktreeId: string;
  path: string;
  /** 与 path 相同，兼容工作区文件树读取 rootPath 的既有客户端。 */
  rootPath: string;
  exists: boolean;
  directoryCount: number;
  fileCount: number;
  entries: WorktreeInspectionEntry[];
}