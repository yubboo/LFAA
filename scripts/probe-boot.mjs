// 整机启动探针：用隔离的用户目录装配完整 Host 运行时，确认核心服务与 HTTP 路由都能量出来。
// 覆盖「插件 inject 漏声明 / 装配顺序错」这类启动期错误——它们只在真正装配时暴露，
// 早于 verify:web 的浏览器验收。不启动浏览器、不监听端口。
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = mkdtempSync(join(tmpdir(), "lfaa-boot-"));
// 必须在导入任何 @lfaa 模块之前改环境：memory / plugins 在构造时读取用户目录。
process.env.USERPROFILE = home;
process.env.HOME = home;
const projectRoot = join(home, "project");
mkdirSync(projectRoot, { recursive: true });

const steps = [];
function step(name, ok, detail = "") {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "✔" : "✖"} ${name}${detail ? `  ${detail}` : ""}`);
}

// 期望的核心路由；缺一条就说明对应服务没装配或被 inject 挡住。
const EXPECTED_ROUTES = [
  "sections", "workspace", "worktrees", "skills", "plugins", "llm", "rules", "memory",
  "commands", "goal", "chat", "agent", "browser", "jobs", "media",
];

let runtime;
let failure = "";
try {
  const { createHostRuntime } = await import("@lfaa/web-server");
  const loaderBaseUrl = pathToFileURL(join(ROOT, "packages", "bundle", "web", "package.json")).href;
  runtime = await createHostRuntime({ projectRoot, loaderBaseUrl });
  step("装配完整 Host 运行时", true);

  step("生成接口令牌", /^[0-9a-f]{64}$/u.test(runtime.token), `${runtime.token.length} 字符`);
  const routes = runtime.gateway.list();
  const missing = EXPECTED_ROUTES.filter((id) => !routes.includes(id));
  step("注册核心接口路由", missing.length === 0, missing.length > 0 ? `缺少 ${missing.join("、")}` : `${routes.length} 条`);
} catch (error) {
  failure = error instanceof Error ? `${error.message}` : String(error);
  step("装配完整 Host 运行时", false, failure);
} finally {
  try {
    await runtime?.dispose();
  } catch (error) {
    step("释放运行时", false, error instanceof Error ? error.message : String(error));
  }
  rmSync(home, { recursive: true, force: true });
}

const failed = steps.filter((item) => !item.ok);
if (failed.length > 0) {
  console.error(`\n启动探针失败：${failed.map((item) => item.name).join("、")}`);
  if (failure) console.error(failure);
  process.exit(1);
}
console.log(`\n${steps.length} / ${steps.length} 步通过。`);