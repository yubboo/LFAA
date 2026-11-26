// 验证日志体检：同类日志重号判错、基线可登记历史重号、基线外的重号仍然判错、基线条目过期提示，
// 以及「调研与参考」门禁（自 DEV-000541 起必填，需外链或「无外部参考」）。
// 用临时夹具目录 + `--root` 运行脚本，避免在仓库里制造重号样本。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const SCRIPT = join(import.meta.dirname, "check-logs.mjs");

/** 造一个夹具仓库：devLog 标题编号与 updata-log 文件名编号由参数决定；devLogText 可整卷替换正文。 */
function makeFixture({ devLog = [], updataLog = [], devLogText } = {}) {
  const root = mkdtempSync(join(tmpdir(), "lfaa-logs-"));
  mkdirSync(join(root, "docs", "dev-log"), { recursive: true });
  mkdirSync(join(root, "docs", "updata-log"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  const body = devLogText ?? devLog.map((number) => `# DEV-${number}｜夹具\n`).join("\n");
  if (body.length > 0) writeFileSync(join(root, "docs", "dev-log", "000001-000200.md"), body);
  for (const [index, number] of updataLog.entries()) {
    writeFileSync(join(root, "docs", "updata-log", `${number}-20260101-000${index}-fixture.md`), "# UPDATE\n");
  }
  return root;
}

function writeBaseline(root, baseline) {
  writeFileSync(join(root, "scripts", "log-number-baseline.json"), JSON.stringify(baseline), "utf8");
}

function runCheck(root) {
  const result = spawnSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("dev-log 标题重号在没有基线时判错", () => {
  const root = makeFixture({ devLog: ["000010", "000010"] });
  try {
    const { status, output } = runCheck(root);
    assert.equal(status, 1, `重号必须失败：${output}`);
    assert.match(output, /新增重号：000010/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("updata-log 文件名重号同样判错", () => {
  const root = makeFixture({ updataLog: ["000011", "000011"] });
  try {
    const { status, output } = runCheck(root);
    assert.equal(status, 1);
    assert.match(output, /updata-log 文件名编号/u);
    assert.match(output, /000011/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("基线里的历史重号被放行，且提示基线条目已过期", () => {
  const root = makeFixture({ devLog: ["000010", "000010"] });
  try {
    writeBaseline(root, { devLog: ["000010", "000099"], updataLog: [] });
    const { status, output } = runCheck(root);
    assert.equal(status, 0, `已登记的重号不应失败：${output}`);
    assert.match(output, /已登记 1 组，基线 2 组/u);
    assert.match(output, /000099 已不再是重号/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("基线之外的新重号仍然判错（棘轮只减不增）", () => {
  const root = makeFixture({ devLog: ["000010", "000010", "000012", "000012"] });
  try {
    writeBaseline(root, { devLog: ["000010"], updataLog: [] });
    const { status, output } = runCheck(root);
    assert.equal(status, 1, `新增重号必须失败：${output}`);
    assert.match(output, /新增重号：000012/u);
    assert.doesNotMatch(output, /新增重号：[^\n]*000010/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("自 DEV-000541 起缺少「调研与参考」判错", () => {
  const root = makeFixture({ devLogText: "# DEV-000541｜夹具\n\n## 文件变更\n\n- 无\n" });
  try {
    const { status, output } = runCheck(root);
    assert.equal(status, 1, `缺少调研段落必须失败：${output}`);
    assert.match(output, /DEV-000541：缺少「## 调研与参考」段落/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("调研段落给出外链时放行", () => {
  const root = makeFixture({
    devLogText: "# DEV-000541｜夹具\n\n## 调研与参考\n\n- 来源：https://github.com/example/repo（v1.2.0，2026-11-26）\n\n## 文件变更\n\n- 无\n",
  });
  try {
    const { status, output } = runCheck(root);
    assert.equal(status, 0, `有外链应通过：${output}`);
    assert.match(output, /dev-log 调研段落：DEV-000541 起全部合规/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("调研段落既无外链也无「无外部参考」判错", () => {
  const root = makeFixture({
    devLogText: "# DEV-000541｜夹具\n\n## 调研与参考\n\n- 来源：社区做法\n\n## 文件变更\n\n- 无\n",
  });
  try {
    const { status, output } = runCheck(root);
    assert.equal(status, 1, `无证据的调研必须失败：${output}`);
    assert.match(output, /既没有来源链接，也没有写「无外部参考」/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("写「无外部参考」并说明原因的调研段落放行", () => {
  const root = makeFixture({
    devLogText: "# DEV-000541｜夹具\n\n## 调研与参考\n\n- 无外部参考：只改了本仓文案，已检索项目内无同类实现。\n\n## 文件变更\n\n- 无\n",
  });
  try {
    const { status } = runCheck(root);
    assert.equal(status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("代码块里的模板不算调研段落", () => {
  const root = makeFixture({
    devLogText: [
      "# DEV-000541｜夹具",
      "",
      "```markdown",
      "## 调研与参考",
      "- 来源：https://example.com/template",
      "```",
      "",
      "## 文件变更",
      "",
      "- 无",
      "",
    ].join("\n"),
  });
  try {
    const { status, output } = runCheck(root);
    assert.equal(status, 1, `代码块里的模板不能算调研：${output}`);
    assert.match(output, /缺少「## 调研与参考」段落/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("门禁生效前的历史条目不被追溯", () => {
  const root = makeFixture({ devLogText: "# DEV-000540｜夹具\n\n## 文件变更\n\n- 无\n" });
  try {
    const { status, output } = runCheck(root);
    assert.equal(status, 0, `历史条目不应被追溯：${output}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});