// 验证左二栏工具提示的贴边位移：位移量只由锚点中心与气泡宽度决定，重复计算不再变化。
// 背景：旧实现读「已经位移过的矩形」再补一次，贴边时会在 0 与补偿值之间无限来回，
// React 触发 Maximum update depth exceeded，整棵树被卸载成白屏（平板宽度展开左二栏即可复现）。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
    }
    return nextLoad(url, context);
  },
});

const { resolveTipShift } = await import("../client/navigation/Toolbar-Tip");

test("气泡放得下时不位移", () => {
  assert.equal(resolveTipShift({ center: 300, width: 126, viewportWidth: 780 }), 0);
});

test("贴着左边缘的气泡整体右移，且以同一几何重算不再变化", () => {
  // 现场实测：抽屉滑入时按钮中心在 x=70.5，长文案气泡宽 156.5，居中会越过左边界约 7.8px。
  const input = { center: 70.5, width: 156.5, viewportWidth: 780 };
  const shift = resolveTipShift(input);
  assert.ok(Math.abs(shift - 15.75) < 0.01, `位移应为 15.75，实际 ${shift}`);
  assert.ok(70.5 - 156.5 / 2 + shift >= 8 - 1e-9, "位移后左边缘仍越过留白");
  // 旧实现的反馈环会在这里得到相反的值；新实现重复计算恒等，渲染一次即收敛。
  assert.equal(resolveTipShift(input), shift);
});

test("贴着右边缘的气泡左移回视口内", () => {
  const input = { center: 770, width: 200, viewportWidth: 780 };
  const shift = resolveTipShift(input);
  assert.ok(shift < 0, "贴右边时位移应为负");
  assert.ok(770 - 200 / 2 + shift + 200 <= 780 - 8 + 1e-9, "位移后右边缘仍越过留白");
  assert.equal(resolveTipShift(input), shift);
});

test("气泡比视口还宽时贴左边留白，不产生越界位移", () => {
  assert.equal(resolveTipShift({ center: 390, width: 800, viewportWidth: 780 }), 8 - (390 - 400));
});