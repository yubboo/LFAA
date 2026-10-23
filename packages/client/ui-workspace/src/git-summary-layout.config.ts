/**
 * 文件：git-summary-layout.config.ts
 * 作用：按 /work 工作台根容器和右侧菜单的实宽决定 Git 摘要的响应式默认状态。
 * 负责：提供可复核的窄/宽边界计算。
 * 不负责：浮层开合状态、Git 数据读取、样式和用户布局偏好。
 */

// 76% 的工作台根宽区分参考图中的较窄右栏（约 67%）和较宽右栏（约 85%）。
export const GIT_SUMMARY_AUTO_OPEN_RIGHT_RATIO = 0.76;

/** 尺寸有效时返回摘要默认状态；面板未布局或已收起时返回 null，保留当前手动开合状态。 */
export function shouldAutoOpenGitSummary(rightWidth: number, workbenchWidth: number): boolean | null {
  if (!Number.isFinite(rightWidth) || !Number.isFinite(workbenchWidth) || rightWidth <= 0 || workbenchWidth <= 0) return null;
  return rightWidth / workbenchWidth <= GIT_SUMMARY_AUTO_OPEN_RIGHT_RATIO;
}
