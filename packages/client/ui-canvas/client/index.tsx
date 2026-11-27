// 无限画布客户端通过工作台契约添加可卸载的右侧标签，并延迟加载编辑器。
import { lazy, Suspense } from "react";
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";

const CanvasWorkspace = lazy(() => import("./canvas/Canvas-Workspace"));

export const canvasClientPlugin: Plugin.Object<void> = {
  name: "@lfaa/client-ui-canvas/client",
  inject: ["workbench"],
  apply(ctx: Context) {
    ctx.effect(() => ctx.workbench.registerTab({
      id: "infinite-canvas",
      title: { zh: "无限画布", en: "Infinite canvas" },
      render: ({ projectId, isZh }) => (
        <Suspense fallback={<span role="status">{isZh ? "正在打开画布…" : "Opening canvas…"}</span>}>
          <CanvasWorkspace key={projectId ?? "none"} projectId={projectId} isZh={isZh} />
        </Suspense>
      ),
    }));
  },
};
