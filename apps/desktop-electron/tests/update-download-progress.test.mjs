import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialDesktopUpdateDownloadProgress,
  normalizeDesktopUpdateDownloadProgress
} from "../src/update-download-progress.mjs";

test("初始下载状态不伪造已知总量或进度", () => {
  assert.deepEqual(createInitialDesktopUpdateDownloadProgress("0.0.7"), {
    version: "0.0.7",
    phase: "starting",
    transferredBytes: 0,
    totalBytes: null,
    percent: null,
    bytesPerSecond: 0
  });
});

test("将更新器真实字节、比例和速度规整为有限状态", () => {
  assert.deepEqual(normalizeDesktopUpdateDownloadProgress("0.0.7", {
    transferred: 5_100_000,
    total: 170_200_000,
    percent: 2.996,
    bytesPerSecond: 850_000
  }), {
    version: "0.0.7",
    phase: "downloading",
    transferredBytes: 5_100_000,
    totalBytes: 170_200_000,
    percent: 2.996,
    bytesPerSecond: 850_000
  });
  assert.equal(normalizeDesktopUpdateDownloadProgress("0.0.7", { transferred: 10, total: 20 }).percent, 50);
  assert.equal(normalizeDesktopUpdateDownloadProgress("0.0.7", { transferred: 10, total: 20, percent: 120 }).percent, 100);
  assert.equal(normalizeDesktopUpdateDownloadProgress("0.0.7", { transferred: -1, total: 20 }), null);
  assert.equal(normalizeDesktopUpdateDownloadProgress("0.0.7", { transferred: 10, total: Infinity }), null);
  assert.equal(normalizeDesktopUpdateDownloadProgress("0.0.7", { transferred: 10, total: 20, bytesPerSecond: -2 }), null);
});
