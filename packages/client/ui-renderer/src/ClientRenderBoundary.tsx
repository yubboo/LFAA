/**
 * 功能：为共享 React 根提供可见的渲染失败恢复界面。
 * 作用：懒加载模块或页面运行时出错时保留刷新入口，不让工作台静默变成空白。
 * 关联文件：packages/client/ui-renderer/src/render.tsx、packages/client/modules/src/client/stale-chunk-recovery.ts。
 */
import { Component, type ReactNode } from "react";
import { Alert, Button } from "antd";
import { getClientRenderErrorSummary } from "./render-error-summary.js";

interface ClientRenderBoundaryState {
  failed: boolean;
  errorSummary: string | null;
}

export class ClientRenderBoundary extends Component<{ children: ReactNode }, ClientRenderBoundaryState> {
  state: ClientRenderBoundaryState = { failed: false, errorSummary: null };

  static getDerivedStateFromError(error: Error): ClientRenderBoundaryState {
    return { failed: true, errorSummary: getClientRenderErrorSummary(error) };
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
            description={<div>发生客户端渲染错误。刷新后会重新加载当前页面；错误摘要：<code>{this.state.errorSummary ?? "Error: 未知客户端异常"}</code></div>}
            style={{ maxWidth: 520 }}
          />
          <Button type="primary" onClick={() => window.location.reload()}>刷新页面</Button>
        </main>
      );
    }
    return this.props.children;
  }
}
