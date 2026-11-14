/**
 * 文件：ApplicationContentLoading.tsx
 * 功能：提供工作区懒加载区域共用的紧凑状态视图。
 * 作用：显示加载反馈，不启动请求或持有加载状态。
 * 关联文件：./workspace-lazy-modules.ts、./ApplicationCenterWorkspace.tsx。
 */
/** 工作区懒加载区域共用的紧凑加载占位。 */
export function ApplicationContentLoading() {
  return (
    <div className="loading-page loading-page--compact" role="status" aria-live="polite">
      <span className="loading-indicator" aria-hidden="true" />
      <span>正在加载工作区内容…</span>
    </div>
  );
}
