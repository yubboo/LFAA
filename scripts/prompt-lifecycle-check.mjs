/**
 * 文件：prompt-lifecycle-check.mjs
 * 作用：把“Prompt 先行 → AI 自测 → 用户验收”做成可执行发布契约。
 * 负责：当前版本必须在 PROMPTS / DEVELOPMENT_LOG / CHANGELOG / RELEASES 中使用同一任务编号、版本和状态；delivered 必须有用户验收通过证据。
 * 不负责：证明文件物理创建时间先于代码、替代用户真实验收、判断业务功能正确性。
 * 状态归属：无运行时状态；以 lfaa.release.json 和固定时间线文档为事实源。
 * 对外接口：`node scripts/prompt-lifecycle-check.mjs`。
 * 关联文件：DEVELOPMENT.md、docs/PROMPTS.md、docs/DEVELOPMENT_LOG.md、CHANGELOG.md、docs/RELEASES.md。
 * 修改注意事项：新增状态必须先更新 DEVELOPMENT.md；不得通过放宽检查绕过用户验收。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (message) => {
  console.error(`LFAA prompt lifecycle check failed: ${message}`);
  process.exit(1);
};
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const release = JSON.parse(read("lfaa.release.json"));
const version = String(release.displayVersion);
const prompt = read("docs/PROMPTS.md");
const log = read("docs/DEVELOPMENT_LOG.md");
const changelog = read("CHANGELOG.md");
const releases = read("docs/RELEASES.md");

const indexMatch = prompt.match(new RegExp(`\\|\\s*(#\\d+(?:\\.\\d+)?)\\s*\\|[^\\n]*\\|\\s*v${version.replaceAll(".", "\\.")}\\s*\\|\\s*([^|]+)\\|\\s*([^|]+)\\|\\s*([^|]+)\\|`));
if (!indexMatch) fail(`PROMPTS.md current task index does not contain v${version}`);
const task = indexMatch[1].trim();
const status = indexMatch[2].trim();
const aiVerification = indexMatch[3].trim();
const userAcceptance = indexMatch[4].trim();

for (const [name, text] of [["DEVELOPMENT_LOG.md", log], ["CHANGELOG.md", changelog], ["RELEASES.md", releases]]) {
  if (!text.includes(task)) fail(`${name} does not contain current task ${task}`);
  if (!text.includes(`v${version}`)) fail(`${name} does not contain current version v${version}`);
  if (!text.includes(status)) fail(`${name} does not contain current status ${status}`);
}
if (!/^(pending-user-acceptance|delivered)$/.test(status)) fail(`current release status must be pending-user-acceptance or delivered, got ${status}`);
if (aiVerification !== "pass") fail(`AI verification must be pass before packaging, got ${aiVerification}`);
if (status === "delivered" && userAcceptance !== "passed") fail("delivered requires user acceptance = passed");
if (status === "pending-user-acceptance" && userAcceptance !== "pending") fail("pending-user-acceptance requires user acceptance = pending");

console.log(`LFAA prompt lifecycle check passed (${task}, v${version}, ${status}).`);
