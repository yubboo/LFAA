/**
 * 功能：回归 AI Work 空闲虚化/淡出计时与 UI 状态接线。
 * 作用：验证活动复位、到期虚化/淡出、隐藏/卸载清理，以及滑块拖动使用局部状态并在结束时提交。
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

test("AI Work 回复、刻度/滚动条使用设置的虚化与淡出强度并平滑切换", () => {
  const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
  const chat = read("../../../packages/client/ui-chat/src/AiWorkChat.tsx");
  const chatCss = read("../../../packages/client/ui-chat/src/ai-work-chat.css");
  const workbenchCss = [
    "../../../packages/client/ui-workspace/src/module-workbench.css",
    "../../../packages/client/ui-workspace/src/css/secondary-navigation.css",
    "../../../packages/client/ui-workspace/src/css/center-workspace.css",
    "../../../packages/client/ui-workspace/src/css/right-menu.css",
    "../../../packages/client/ui-workspace/src/css/workbench-regions.css",
  ].map(read).join("\n");
  const workbench = read("../../../packages/client/ui-layout/src/Workbench.tsx");
  const settings = read("../../../packages/client/ui-settings/src/SettingsPage.tsx");
  const focusBlurSliders = settings.match(/const AppearanceFocusBlurSliders = memo\(function AppearanceFocusBlurSliders\([\s\S]*?\n\}\);/u)?.[0];

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
  assert.doesNotMatch(chatCss, /data-output-idle="true"[^\n]*\.ai-work-chat__composer-context/u, "闲置时保持输入区上下文清晰可读");
  assert.match(chatCss, /data-output-idle="false"[^\n]*\.ai-work-chat__message-stage > \.ai-work-chat__navigation-track > \.ai-work-chat__anchors/u);
  assert.match(workbench, /--settings-ai-work-output-focus-opacity/u);
  assert.match(workbench, /1\s*-\s*appearanceAdvanced\.aiWorkOutputFocusBlurPercent\s*\/\s*100/u);
  assert.match(chatCss, /opacity:\s*var\(--settings-ai-work-output-focus-opacity/u);
  assert.match(chatCss, /transition:\s*opacity\s+240ms\s+ease/u);
  assert.match(chatCss, /data-reduced-motion="on"[\s\S]*transition:\s*none/u);
  assert.match(chatCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*transition-duration:\s*0ms/u);
  assert.match(settings, /aiWorkOutputFocusBlurIdleSeconds/u);
  assert.ok(focusBlurSliders, "虚化滑块必须由局部 memo 组件维护拖动状态");
  assert.match(focusBlurSliders, /value=\{idleMinutes\} onChange=\{setIdleMinutes\} onChangeComplete=\{onIdleMinutesChange\}/u);
  assert.match(focusBlurSliders, /value=\{percent\} onChange=\{setPercent\} onChangeComplete=\{onPercentChange\}/u);
  assert.doesNotMatch(focusBlurSliders, /onChange=\{[^}]*updateAppearanceAdvanced/u, "拖动中的 onChange 不应提交整页设置");
  assert.match(settings, /onIdleMinutesChange=\{minutes => updateAppearanceAdvanced\(\{ aiWorkOutputFocusBlurIdleSeconds: minutes \* 60 \}\)\}/u);
  assert.match(settings, /onPercentChange=\{aiWorkOutputFocusBlurPercent => updateAppearanceAdvanced\(\{ aiWorkOutputFocusBlurPercent \}\)\}/u);
  assert.match(settings, /100% 完全淡出隐藏回复/u);
  assert.doesNotMatch(chatCss, /瞬时切换[\s\S]*filter 动画/u);
});
