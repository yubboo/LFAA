// 无限画布的拖拽与缩放手感校验：用浏览器内隔离画布夹具（本地 5173）检查拖拽只落盘一次、
// 拖拽/缩放期间连线流光隐藏、缩放不改节点数量、控制台无报错，并把截图写到 shots/。
// 需要先 `pnpm lfaa web` 起本地服务；加 `--fixed` 把数值断言打开（默认只打印观察值，便于对比修复前）。
// 用法：pnpm verify:canvas-motion --fixed [--light]
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright-core";

/** 请求体里的画布图快照：只声明本脚本读写的字段。 */
interface BoardGraph {
  nodes: { id: string; position: { x: number; y: number } }[];
  viewport: { x: number; y: number; zoom: number };
}

const fixed = process.argv.includes("--fixed");
const dark = !process.argv.includes("--light");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1480, height: 900 }, locale: "zh-CN" });
  await context.addInitScript(mode => {
    localStorage.setItem("lfaa:appearance-mode", mode);
    localStorage.setItem("lfaa:appearance-config-v1", JSON.stringify({ mode }));
  }, dark ? "dark" : "light");
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", m => { if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text()); });

  // 夹具：32 个节点 + 16 条连线，模拟重画布的拖拽与缩放压力。
  const canvasId = randomUUID();
  const nodes = Array.from({ length: 32 }, (_, i) => ({
    id: randomUUID(), kind: i % 2 ? "image" : "prompt",
    position: { x: 80 + (i % 4) * 380, y: 135 + Math.floor(i / 4) * 245 },
    settings: { prompt: "节点 " + (i + 1) },
  }));
  const edges = nodes.flatMap((node, i) => i % 2 ? [] : [{ id: randomUUID(), source: node.id, target: nodes[i + 1].id, sourcePort: "text", targetPort: "prompt" }]);
  const writes: BoardGraph[] = [];
  let board: BoardGraph & { canvasId: string; schemaVersion: number; title: string; revision: number; edges: unknown[] } = {
    canvasId, schemaVersion: 1, title: "画布交互检查", revision: 0, nodes, edges, viewport: { x: 15, y: 10, zoom: 0.8 },
  };

  // 拦截画布接口：列表、读图、写图都用内存夹具替换，不落地到真实数据目录。
  await page.route(/\/api\/canvas\/projects\/[^/]+\/boards(?:\/[^/]+)?$/u, async route => {
    if (route.request().url().endsWith("/boards")) {
      await route.fulfill({ json: [{ canvasId, title: board.title }] });
    } else if (route.request().method() === "PUT") {
      const { graph } = route.request().postDataJSON() as { graph: BoardGraph };
      writes.push(graph);
      board = { ...board, ...graph, revision: board.revision + 1 };
      await route.fulfill({ json: board });
    } else {
      await route.fulfill({ json: { board, assets: [], runs: [] } });
    }
  });

  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "新建浏览器标签页" }).click({ timeout: 15000 });
  await page.getByRole("button", { name: "无限画布", exact: true }).click({ timeout: 15000 });
  const surface = page.locator(".react-flow");
  await surface.waitFor({ timeout: 15000 });
  const w = await surface.boundingBox();
  assert(w);
  const first = page.locator('.react-flow__node[data-id="' + nodes[0].id + '"]');
  const glow = page.locator('.react-flow__edge[data-id="' + edges[0].id + '"] path[pathLength],.react-flow__edge[data-id="' + edges[0].id + '"] path[class*="edgeGlow"]').first();
  await first.waitFor();
  await glow.waitFor({ state: "attached" });
  await page.waitForTimeout(500);
  console.log("Readied", await page.locator(".react-flow__node").count(), "nodes", "idle glow", await glow.evaluate(el => getComputedStyle(el).strokeDasharray));

  // 拖拽：中途不能落盘，松手后必须正好落盘一次；拖拽期间连线流光隐藏。
  const start = await first.boundingBox();
  assert(start);
  await page.mouse.move(start.x + 65, start.y + 10);
  await page.mouse.down();
  await page.mouse.move(start.x + 110, start.y + 45, { steps: 8 });
  const during = { dragging: await first.evaluate(el => el.classList.contains("dragging")), glow: await glow.evaluate(el => getComputedStyle(el).visibility) };
  await page.waitForTimeout(360);
  const inFlight = writes.length;
  await page.mouse.move(start.x + 175, start.y + 90, { steps: 18 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const dragSaved = writes.length;
  const positions = board.nodes.find(node => node.id === nodes[0].id)?.position;
  console.log({ during, inFlight, dragSaved, positions, visualNodes: await page.locator(".react-flow__node:visible").count() });
  if (fixed) {
    assert.equal(inFlight, 0, "drag frame must not save");
    assert.equal(dragSaved, 1, "drop must save once");
    assert.equal(during.dragging, true);
    assert.equal(during.glow, "hidden");
    assert(positions !== undefined && positions.x > nodes[0].position.x + 60);
  }

  // 缩放：滚轮期间流光隐藏，停下来恢复，且不丢节点。
  await page.mouse.move(w.x + w.width * 0.48, w.y + w.height * 0.51);
  for (let n = 0; n < 8; n++) await page.mouse.wheel(0, n % 2 ? -165 : 185);
  const scrolling = await glow.evaluate(el => getComputedStyle(el).visibility);
  await page.waitForTimeout(700);
  const idle = await glow.evaluate(el => getComputedStyle(el).visibility);
  console.log({ scrolling, idle, zoom: board.viewport.zoom, errors });
  if (fixed) {
    assert.equal(scrolling, "hidden");
    assert.equal(idle, "visible");
    assert.equal(await page.locator(".react-flow__node").count(), nodes.length);
    assert.deepEqual(errors, []);
  }
  await page.screenshot({ path: "shots/infinite-canvas-motion-" + (fixed ? (dark ? "dark" : "light") : "before") + ".png" });
} finally {
  await browser.close();
}
