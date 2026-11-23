// 工作树客户端展示类型：字段由 /api/worktrees 返回，Host 侧契约在 @lfaa/worktree。
export interface ProjectWorktreeItem {
  id: string;
  projectId: string;
  repositoryRoot: string;
  path: string;
  branch: string;
  baseCommit: string;
  /** 起点分支名；旧记录可能缺省。 */
  baseRef?: string;
  createdAt: number;
  exists: boolean;
  dirtyCount: number;
  ahead: number;
  behind: number;
  sessionCount: number;
}

/** 只读合并预演结果。 */
export interface ProjectWorktreeMergePreview {
  worktreeId: string;
  baseRef: string;
  branch: string;
  baseBranchCheckedOut: boolean;
  mainDirty: boolean;
  upToDate: boolean;
  clean: boolean;
  conflicts: string[];
  error?: string;
}