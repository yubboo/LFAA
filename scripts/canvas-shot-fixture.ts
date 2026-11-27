// 画布截图夹具：使用编辑器现有直达参数与内存接口，避免改动本机项目数据。
import type { Page } from "playwright-core";
import type { CanvasBoard } from "@lfaa/canvas/contract";

export async function installCanvasShotFixture(page: Page, baseUrl: string, empty: boolean): Promise<string> {
  const projectId = "canvas-shot-project";
  const canvasId = "canvas-shot-board";
  const listPath = `/api/canvas/projects/${projectId}/boards`;
  const board: CanvasBoard = {
    schemaVersion: 1, projectId, canvasId, title: "镜头草稿", revision: 0,
    viewport: { x: 0, y: 0, zoom: 0.75 },
    nodes: empty ? [] : [
      { id: "prompt", kind: "prompt", position: { x: 160, y: 160 }, settings: { prompt: "暖光落在林间步道，清晨缓慢推进。" } },
      { id: "image", kind: "image", position: { x: 500, y: 180 }, settings: { ratio: "16:9" } },
    ],
    edges: empty ? [] : [{ id: "prompt-image", source: "prompt", sourcePort: "text", target: "image", targetPort: "prompt" }],
  };
  await page.route(new RegExp(`${listPath}(?:/|$)`, "u"), (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === listPath && route.request().method() === "GET") {
      return route.fulfill({ json: [{ canvasId, title: board.title }] });
    }
    if (pathname === `${listPath}/${canvasId}` && route.request().method() === "GET") {
      return route.fulfill({ json: { board, assets: [], runs: [] } });
    }
    if (pathname === `${listPath}/${canvasId}` && route.request().method() === "PUT") {
      return route.fulfill({ json: { ...board, revision: board.revision + 1 } });
    }
    return route.fulfill({ status: 404, json: { error: "未定义的截图夹具路由" } });
  });
  const url = new URL(baseUrl);
  url.searchParams.set("canvasProject", projectId);
  url.searchParams.set("canvasBoard", canvasId);
  return url.href;
}
