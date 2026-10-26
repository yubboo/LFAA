/**
 * 功能：在 Vite 开发服务中尽力注入 LFAA Control Plane 装配好的 DSH Client 启动图。
 * 作用：启动图暂不可用时继续提供 LFAA 页面，由客户端本地 React 根降级运行，不让可选 DSH 扩展阻断 LFAA。
 * 关联文件：vite.config.ts、packages/host/webserver/src/server.ts。
 */
import type { IndexInjection } from "@deepseek-ai/dsh-host-webserver";
import type { Plugin } from "vite";

const requestTimeoutMs = 1_000;

export function createDshDevBootstrapPlugin(
  serverTarget: string,
  renderInjections: (html: string, injections: readonly IndexInjection[]) => string,
  warn: (message: string) => void
): Plugin {
  let lastWarning: string | null = null;
  return {
    name: "lfaa-dsh-dev-bootstrap",
    apply: "serve",
    transformIndexHtml: {
      order: "pre",
      async handler(html) {
        try {
          const response = await fetch(`${serverTarget}/__dsh/index-injections`, {
            signal: AbortSignal.timeout(requestTimeoutMs)
          });
          if (!response.ok) throw new Error(`Control Plane 页面启动图返回 HTTP ${response.status}。`);
          const injections: unknown = await response.json();
          if (!Array.isArray(injections)) throw new Error("Control Plane 返回的 DSH 页面注入不是列表。");
          const transformed = renderInjections(html, injections);
          lastWarning = null;
          return transformed;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          const warning = `DSH Client 启动图暂不可用（${reason}）；继续提供 LFAA 页面，DSH 扩展槽暂不可用。Control Plane 恢复后刷新页面即可重新装载扩展。`;
          if (warning !== lastWarning) warn(warning);
          lastWarning = warning;
          return html;
        }
      }
    }
  };
}
