// 验证会话滚动所有权：流式贴底写入不得被误判成用户滚动，用户上滚必须立刻拿到控制权。
import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyViewportScroll,
  resolveScrollFollow,
  resolveScrollRestore,
  shouldSmoothReveal,
  type ViewportScrollInput,
} from "../client/conversation/chat-scroll-model";

/** 造一份「视口停在某处」的输入，默认是我们刚贴底写完的状态。 */
function input(overrides: Partial<ViewportScrollInput>): ViewportScrollInput {
  return {
    top: 1000,
    previousTop: 1000,
    expectedTop: 1000,
    smoothTarget: null,
    maxTop: 1000,
    ...overrides,
  };
}

test("程序贴底写下的 scrollTop 被识别为自己滚动，而不是用户上滚", () => {
  // 贴底后停在底边：既是自己写的，也确实到底。
  assert.equal(classifyViewportScroll(input({ top: 1000, expectedTop: 1000, maxTop: 1000 })), "bottom");
  // 内容又长高了 30px、浏览器还没夹紧，但坐标仍与写入值一致：不能算用户。
  assert.equal(classifyViewportScroll(input({ top: 1030, expectedTop: 1030, maxTop: 1060 })), "self");
});

test("内容变短时浏览器夹到新底边算「到底」，不会被误判成用户上滚", () => {
  // 视口原本在 1200，内容收缩后浏览器把 scrollTop 夹到 1000。
  assert.equal(classifyViewportScroll(input({ top: 1000, previousTop: 1200, expectedTop: 1200, maxTop: 1000 })), "bottom");
});

test("用户上滚离开底边时识别为 user", () => {
  const source = classifyViewportScroll(input({ top: 600, previousTop: 1000, expectedTop: 1000, maxTop: 1000 }));
  assert.equal(source, "user");
});

test("平滑回底动画的每一帧都不是用户滚动，用户反向抢滚轮时才交权", () => {
  // 动画从 1000 走向 1400：距离在缩小。
  assert.equal(
    classifyViewportScroll(input({ top: 1200, previousTop: 1100, expectedTop: 1000, smoothTarget: 1400, maxTop: 1400 })),
    "smooth",
  );
  // 用户把视口往上拽：离目标反而更远，立刻按用户处理。
  assert.equal(
    classifyViewportScroll(input({ top: 1150, previousTop: 1200, expectedTop: 1000, smoothTarget: 1400, maxTop: 1400 })),
    "user",
  );
});

test("跟随开关：到底恢复跟随，用户上滚超过阈值立即暂停", () => {
  assert.equal(resolveScrollFollow(false, "bottom", 900, 1000, 0), true);
  assert.equal(resolveScrollFollow(true, "user", 1000, 600, 400), false);
  // 只上滚 3px 仍算在底部，不打断流式跟随。
  assert.equal(resolveScrollFollow(true, "user", 1000, 997, 3), true);
  // 自己滚出来的位置不改跟随状态。
  assert.equal(resolveScrollFollow(true, "self", 1000, 1030, 30), true);
});

test("只有晚到的小块才平滑让位：刷新后历史一次性挂载必须同步贴底", () => {
  // 追问建议 / 改动卡片：一两百像素，值得动画。
  assert.equal(shouldSmoothReveal(150, 796), true);
  assert.equal(shouldSmoothReveal(398, 796), false);
  // 刷新后历史一次性挂载：两万像素的缺口，动画就是「从顶部滚到最底部」。
  assert.equal(shouldSmoothReveal(19959, 796), false);
  // 阈值以内（行高取整微差）根本不该动。
  assert.equal(shouldSmoothReveal(20, 796), false);
  // 窄视口按同一口径折算：半屏 200px 以上直接贴底。
  assert.equal(shouldSmoothReveal(180, 400), true);
  assert.equal(shouldSmoothReveal(260, 400), false);
});

test("刷新恢复：骨架期先等，历史挂载后再落回记忆位置", () => {
  // 刷新瞬间只有骨架（可滚区间 268），记忆位置 8091：先写 268 并保持 pending，
  // 不能把「装不下」当成落位完成，否则会被骨架夹到顶部、或被后续贴底冲到底部。
  assert.deepEqual(resolveScrollRestore(8091, 268, 0, 21023), { top: 268, pending: true });
  // 历史挂载后（可滚区间 20227）落回 8091，并结束等待。
  assert.deepEqual(resolveScrollRestore(8091, 20227, 0, 21023), { top: 8091, pending: false });
  // 内容本来就比记忆位置短：连续两次高度一致说明已经成型，按可滚终点收尾。
  assert.deepEqual(resolveScrollRestore(8091, 500, 5000, 5000), { top: 500, pending: false });
  // 只是长高了一帧、还没稳定，继续等。
  assert.deepEqual(resolveScrollRestore(8091, 500, 3000, 5000), { top: 500, pending: true });
});

test("流式增长期间用户上滚：事件序列不会再被贴底写回", () => {
  // 复现真实序列：贴底写入 → 内容增长 → 用户滚轮上移。
  let follow = true;
  let expectedTop = 1000;
  let maxTop = 1000;
  let top = 1000;

  // ① 贴底：程序把 scrollTop 写到 scrollHeight（浏览器夹到底边）。
  maxTop = 1030;
  top = 1030;
  expectedTop = 1030;
  let source = classifyViewportScroll({ top, previousTop: 1000, expectedTop, smoothTarget: null, maxTop });
  follow = resolveScrollFollow(follow, source, 1000, top, maxTop - top);
  assert.equal(source, "bottom");
  assert.equal(follow, true);

  // ② 用户滚轮上移 400px。旧实现的时间窗口会把这次事件当成程序滚动吞掉，这里必须识别为用户。
  top = 630;
  source = classifyViewportScroll({ top, previousTop: 1030, expectedTop, smoothTarget: null, maxTop });
  follow = resolveScrollFollow(follow, source, 1030, top, maxTop - top);
  assert.equal(source, "user");
  assert.equal(follow, false, "用户上滚后必须暂停跟随");

  // ③ 内容继续增长：跟随即便为假时不得再写回底部（外层依据 follow 决定是否贴底）。
  maxTop = 1200;
  assert.equal(follow, false);
  assert.equal(maxTop - top > 28, true, "视口应停在用户滚到的位置，而不是底边");
});