import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const review = read("../../../packages/client/ui-workspace/src/GitChangeReview.tsx");
const summary = read("../../../packages/client/ui-workspace/src/GitChangeSummary.tsx");
const connection = read("../../../packages/client/connection/src/api.ts");
const reviewCss = read("../../../packages/client/ui-workspace/src/module-workbench.css");
const layoutCss = read("../../../packages/client/ui-workspace/src/css/right-menu.css");

test("Git 变更页展示真实状态与逐文件审阅，而管理操作保持独立入口", () => {
  assert.match(summary, /if \(embedded && status[\s\S]*?<GitChangeReview[\s\S]*?embedded onManage/u);
  assert.match(review, /status\.branch[\s\S]*?status\.upstream/u);
  assert.match(review, /status\.insertions[\s\S]*?status\.deletions/u);
  assert.match(review, /git-review__stacked-content[\s\S]*?filteredFiles\.map\(file => <GitChangeDiffCard/u);
  assert.match(review, /const \[splitView, setSplitView\] = useState\(true\)/u);
  assert.match(review, /git-review__stacked-split-row[\s\S]*?renderSide\(row\.left, row\.leftNumber\)[\s\S]*?renderSide\(row\.right, row\.rightNumber\)/u);
  assert.match(review, /unchangedGap\(hunks\[hunkIndex - 1\]!, hunk\)/u);
  assert.match(review, /contextLines, signal: controller\.signal/u);
  assert.match(review, /<Dropdown menu=\{\{ items: optionItems/u);
  assert.match(summary, /Git 管理/u);
  assert.match(layoutCss, /\.module-git-manager:has\(> \.module-git-manager__body > \.git-review-inline\) > \.module-git-manager__header \{ display: none; \}/u);
  assert.match(summary, /暂存全部变更[\s\S]*?提交暂存的变更[\s\S]*?Git 远端同步/u);
  assert.doesNotMatch(review, /operation: "branch-switch"/u, "差异工具条不承诺未接入的分支比较");
});

test("逐文件差异随容器可见范围读取、取消过期请求并释放离屏正文", () => {
  assert.match(review, /maxConcurrentGitDiffs = 4/u);
  assert.match(review, /new IntersectionObserver\([\s\S]*?root, rootMargin: "500px 0px"/u);
  assert.match(review, /const controller = new AbortController\(\)/u);
  assert.match(review, /signal: controller\.signal/u);
  assert.match(review, /controller\.abort\(\)/u);
  assert.match(review, /if \(!nearby\) setDiff\(null\)/u);
  assert.match(connection, /loadWorkspaceGitFileDiff[\s\S]*?signal\?: AbortSignal/u);
  assert.match(connection, /loadAgentGitFileDiff[\s\S]*?signal\?: AbortSignal/u);
  assert.match(connection, /contextLines\?: number/u);
  const gitHost = read("../../../packages/host/git/src/git-workspace.mjs");
  assert.match(gitHost, /contextLines: Number\.isInteger\(input\.contextLines\)[\s\S]*?Math\.min\(1000/u);
});

test("变更审阅在窄容器中换行且沿用 Appearance 主题与代码设置", () => {
  assert.match(reviewCss, /\.git-review__stacked-content \{[^}]*overflow: auto/u);
  assert.match(reviewCss, /@container git-review \(max-width: 760px\)[\s\S]*?\.git-review__stacked-toolbar \{ flex-wrap: wrap; \}/u);
  assert.match(reviewCss, /var\(--settings-code-font, Consolas/u);
  assert.match(reviewCss, /var\(--settings-code-font-size, 12px\)/u);
  assert.match(reviewCss, /\.git-review__stacked-split-row \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(reviewCss, /\.git-review__unchanged \{/u);
  assert.match(reviewCss, /data-diff-markers="color"/u);
  assert.match(layoutCss, /\.module-git-manager__body > \.git-review-inline \{[^}]*min-height: 0[^}]*overflow: hidden/u);
  assert.doesNotMatch(reviewCss + layoutCss, /display:\s*inline-block/u);
});
