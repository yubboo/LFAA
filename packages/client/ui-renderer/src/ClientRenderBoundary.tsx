/**
 * 功能：为共享 React 根提供可见的渲染失败恢复界面。
 * 作用：懒加载模块或页面运行时出错时保留刷新入口，不让工作台静默变成空白。
 * 关联文件：packages/client/ui-renderer/src/render.tsx、packages/client/web/src/stale-chunk-recovery.ts。
 */
import { Component, type ReactNode } from "react";
import { Alert, Button } from "antd";

interface ClientRenderBoundaryState {
  failed: boolean;
}

export class ClientRenderBoundary extends Component<{ children: ReactNode }, ClientRenderBoundaryState> {
  state: ClientRenderBoundaryState = { failed: false };

  static getDerivedStateFromError(): ClientRenderBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error("LFAA 工作区渲染失败。", error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="loading-page" role="alert">
          <Alert
            type="error"
            showIcon
            message="工作区暂时无法显示"
            description="页面内容加载失败。刷新后会重新读取当前 Web 版本；若问题持续，请查看控制端日志。"
            style={{ maxWidth: 520 }}
          />
          <Button type="primary" onClick={() => window.location.reload()}>刷新页面</Button>
        </main>
      );
    }
    return this.props.children;
  }
}
