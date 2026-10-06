/**
 * 功能：回归 AI Work 空闲虚化计时与 UI 状态接线。
 * 作用：验证活动复位、到期虚化、隐藏/卸载清理，以及设置控制正文/刻度/滚动条的同一状态。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createOutputIdleBlurController } from "../../../packages/client/ui-chat/src/output-idle-blur.ts";

function createFakeClock() {
  let time = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => time,
    setTimeout(callback, delayMs) {
      const id = ++nextId;
      timers.set(id, { at: time + delayMs, callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(durationMs) {
      const end = time + durationMs;
      while (true) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        time = timer.at;
        timer.callback();
      }
      time = end;
    },
    pendingCount: () => timers.size
  };
}

test("空闲达到设置时长后虚化，任何新活动立即清晰并重新计时", () => {
  const clock = createFakeClock();
  const transitions = [];
  const controller = createOutputIdleBlurController({
    idleDelayMs: 500,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    onIdleChange: idle => transitions.push({ idle, at: clock.now() })
  });

  controller.resume();
  clock.advance(400);
  controller.notifyActivity();
  assert.equal(clock.pendingCount(), 1);
  clock.advance(100);
  assert.deepEqual(transitions, []);
  clock.advance(399);
  assert.deepEqual(transitions, []);
  clock.advance(1);
  assert.deepEqual(transitions, [{ idle: true, at: 900 }]);

  controller.notifyActivity();
  assert.deepEqual(transitions, [{ idle: true, at: 900 }, { idle: false, at: 900 }]);
  assert.equal(clock.pendingCount(), 1);
  controller.dispose();
  assert.equal(clock.pendingCount(), 0);
});

test("高频活动不重复安排计时器，隐藏时暂停，恢复后重计时", () => {
  const clock = createFakeClock();
  const transitions = [];
  const controller = createOutputIdleBlurController({
    idleDelayMs: 250,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    onIdleChange: idle => transitions.push(idle)
  });

  controller.resume();
  for (let index = 0; index < 100; index += 1) {
    clock.advance(1);
    controller.notifyActivity();
    assert.equal(clock.pendingCount(), 1);
  }
  controller.suspend();
  assert.equal(clock.pendingCount(), 0);
  clock.advance(1000);
  assert.deepEqual(transitions, []);
  controller.notifyActivity();
  assert.deepEqual(transitions, []);

  controller.resume();
  clock.advance(249);
  assert.deepEqual(transitions, []);
  clock.advance(1);
  assert.deepEqual(transitions, [true]);
  controller.dispose();
  assert.equal(clock.pendingCount(), 0);
});

test("AI Work、外观设置和刻度/滚动条都绑定到账户空闲虚化设置", () => {
  const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
  const chat = read("../../../packages/client/ui-chat/src/AiWorkChat.tsx");
  const chatCss = read("../../../packages/client/ui-chat/src/ai-work-chat.css");
  const workbenchCss = read("../../../packages/client/ui-workspace/src/module-workbench.css");
  const settings = read("../../../packages/client/ui-settings/src/SettingsPage.tsx");

  assert.match(chat, /aiWorkOutputFocusBlurIdleSeconds\s*\*\s*1000/u);
  assert.match(chat, /addEventListener\("pointermove"/u);
  assert.match(chat, /addEventListener\("pointermove",[^;]*capture:\s*true/u);
  assert.match(chat, /addEventListener\("mousemove",[^;]*capture:\s*true/u);
  assert.match(chat, /addEventListener\("keydown"/u);
  assert.match(chat, /addEventListener\("wheel"/u);
  assert.match(chat, /addEventListener\("touchstart"/u);
  assert.match(chat, /removeEventListener\("visibilitychange"/u);
  assert.doesNotMatch(chat, /outputPointerPersistence|handleOutputPointerLeave/u);
  assert.match(chatCss, /data-output-idle="true"[^\n]*\.ai-work-chat__messages/u);
  assert.match(chatCss, /data-output-idle="true"[^\n]*\.ai-work-chat__anchors/u);
  assert.match(chatCss, /data-output-idle="true"[^\n]*\.ai-work-chat__scroll-latest/u);
  assert.match(chatCss, /data-output-idle="true"[^\n]*\.ai-work-chat__composer-context/u);
  assert.match(workbenchCss, /data-output-idle="false"[^\n]*\.ai-work-chat__messages/u);
  assert.match(settings, /aiWorkOutputFocusBlurIdleSeconds/u);
  assert.match(settings, /min=\{1\} max=\{60\} value=\{settings\.appearance\.advanced\.aiWorkOutputFocusBlurIdleSeconds \/ 60\} onChange=\{\(minutes\) => updateAppearanceAdvanced\(\{ aiWorkOutputFocusBlurIdleSeconds: minutes \* 60 \}\)\}/u);
  assert.match(settings, /min=\{1\} max=\{60\}[\s\S]*?\} 分钟/u);
  assert.match(chatCss, /瞬时切换[\s\S]*filter 动画/u);
  assert.doesNotMatch(chatCss, /720ms|settings-ai-work-output-focus-opacity/u);
});
