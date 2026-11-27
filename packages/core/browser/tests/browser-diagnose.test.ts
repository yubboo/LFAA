// 验证 browser_diagnose 7 类缺陷汇总报告、空异常通过态、快照报错自动透出与探针脚本语法合法性。
import assert from "node:assert/strict";
import test from "node:test";
import { BROWSER_DIAGNOSE_SCRIPT, buildDiagnoseReport, formatRecentBrowserErrors } from "../src/tools/browser-diagnose";
import type { BrowserRuntime } from "../src/session/browser-service";

test("BROWSER_DIAGNOSE_SCRIPT 是语法合法的独立纯字符串 IIFE", () => {
  assert.doesNotThrow(() => new Function(`return ${BROWSER_DIAGNOSE_SCRIPT}`));
  assert.doesNotMatch(BROWSER_DIAGNOSE_SCRIPT, /__name/u);
});

test("buildDiagnoseReport 在 0 异常时输出干净通过报告", () => {
  const result = buildDiagnoseReport({
    url: "http://127.0.0.1:5173/",
    title: "LFAA",
    consoleLogs: [{ level: "log", text: "ready" }],
    networkItems: [{ method: "GET", url: "http://127.0.0.1:5173/api/ok", status: 200 }],
    dom: {
      viewport: { width: 1280, height: 800 },
      scroll: { width: 1280, height: 1200, overflowX: 0 },
      textLength: 420,
      blankRisk: false,
      brokenImages: [],
      overflowElements: [],
      invisibleTextElements: [],
      occludedControls: [],
    },
  });
  assert.equal(result.issueCount, 0);
  assert.match(result.summary, /0 异常/u);
  assert.match(result.compactForVision, /0 项异常/u);
});

test("buildDiagnoseReport 汇总 7 类高频缺陷并按严重程度输出明细", () => {
  const result = buildDiagnoseReport({
    url: "http://127.0.0.1:5173/",
    title: "Demo",
    consoleLogs: [{ level: "error", text: "TypeError: Cannot read properties of undefined" }],
    networkItems: [{ method: "GET", url: "http://127.0.0.1:5173/api/data", status: 500 }],
    dom: {
      viewport: { width: 390, height: 844 },
      scroll: { width: 460, height: 200, overflowX: 70 },
      textLength: 4,
      blankRisk: true,
      brokenImages: [{ src: "/img/hero.png", alt: "Hero", selector: "img.hero" }],
      overflowElements: [{ selector: "div.wide-card", rightOverflow: 70, width: 450 }],
      invisibleTextElements: [{ selector: "h1.title", tag: "h1", text: "主标题", reason: "color:transparent" }],
      occludedControls: [{ selector: "button.submit", text: "提交", coveredBy: "div.overlay" }],
    },
  });
  assert.equal(result.issueCount, 7);
  assert.match(result.report, /控制台报错/u);
  assert.match(result.report, /HTTP 500/u);
  assert.match(result.report, /疑似白屏/u);
  assert.match(result.report, /图片加载失败/u);
  assert.match(result.report, /横向溢出/u);
  assert.match(result.report, /color:transparent/u);
  assert.match(result.report, /div\.overlay 遮挡/u);
  assert.match(result.compactForVision, /7 项异常/u);
});

test("formatRecentBrowserErrors 自动提取最新控制台报错与失败网络请求", () => {
  const fakeRuntime = {
    getConsole: () => [
      { level: "info", text: "boot" },
      { level: "error", text: "ReferenceError: foo is not defined" },
    ],
    getNetwork: () => [
      { method: "GET", url: "http://127.0.0.1:5173/ok", status: 200 },
      { method: "POST", url: "http://127.0.0.1:5173/api/save", status: 404 },
    ],
  } as unknown as BrowserRuntime;

  const text = formatRecentBrowserErrors(fakeRuntime, "s1");
  assert.match(text, /Recent errors:/u);
  assert.match(text, /ReferenceError: foo is not defined/u);
  assert.match(text, /POST 404/u);
});
