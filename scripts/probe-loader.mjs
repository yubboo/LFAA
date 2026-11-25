// Loader 装载探针：按 cordis.yml 直接以包名装载 @lfaa 插件 → 卸载 → 重装 → 二创。
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Context } from "@deepseek-ai/cordis";
import yaml from "js-yaml";
import Loader from "../vendor/loader/lib/index.js";

const ROOT = resolve(import.meta.dirname, "..");
const PROFILE = mkdtempSync(join(tmpdir(), "lfaa-profile-probe-"));
// 以 bundle/web 的清单作为解析基准：它声明了全部可安装插件包；apps/web 只有前端入口依赖。
const BASE_URL = pathToFileURL(join(ROOT, "packages", "bundle", "web", "package.json")).href;

const CORDIS_YML = `# 插件装载探针：直接按包名声明插件，不再依赖导出夹具
plugins:
  tools:
    name: "@lfaa/tools"
  rules:
    name: "@lfaa/rules"
`;

/** 记录一步结果，任何一步失败都让退出码为 1。 */
const steps = [];
function check(label, ok, detail = "") {
  steps.push({ label, ok, detail });
  console.log(`${ok ? "✔" : "✖"} ${label}${detail ? `  ${detail}` : ""}`);
}

async function mount() {
  const ctx = new Context();
  const fiber = ctx.plugin(Loader, { baseUrl: BASE_URL });
  await fiber;
  return { ctx, fiber };
}

async function main() {
  writeFileSync(join(PROFILE, "cordis.yml"), CORDIS_YML, "utf8");
  const config = yaml.load(CORDIS_YML);
  const entries = Object.entries(config.plugins);
  check("解析 cordis.yml", entries.length === 2, entries.map(([id, item]) => `${id}=${item.name}`).join(" "));

  const { ctx, fiber } = await mount();
  check("装载 Loader 服务", typeof ctx.loader === "object");

  await ctx.loader.create({ id: "tools", name: "tools" in config.plugins ? config.plugins.tools.name : "" });
  await ctx.loader.await();
  const countAfterLoad = ctx.tools?.listDefinitions?.().length ?? 0;
  check("按包名装载 @lfaa/tools", countAfterLoad === 10, `tools=${countAfterLoad}`);

  ctx.loader.remove("tools");
  await ctx.loader.await();
  check("卸载 @lfaa/tools", ctx.tools === undefined, `ctx.tools=${typeof ctx.tools}`);

  await ctx.loader.create({ id: "tools", name: config.plugins.tools.name });
  await ctx.loader.await();
  check("重新装载 @lfaa/tools", (ctx.tools?.listDefinitions?.().length ?? 0) === 10, `tools=${ctx.tools?.listDefinitions?.().length ?? 0}`);

  await ctx.loader.create({ id: "rules", name: config.plugins.rules.name });
  await ctx.loader.await();
  check("并存装载 @lfaa/rules", ctx.rules !== undefined && (ctx.tools?.listDefinitions?.().length ?? 0) === 10);

  ctx.loader.remove("tools");
  await ctx.loader.await();
  check("只卸载 tools 时保留 rules", ctx.tools === undefined && ctx.rules !== undefined);

  ctx.loader.remove("rules");
  await ctx.loader.await();
  check("卸载后条目清空", Object.keys(ctx.loader.store).length === 0, `store=${Object.keys(ctx.loader.store).join(",") || "空"}`);

  await fiber.dispose();
  check("释放 Loader", ctx.loader === undefined);

  await scenarioFork();
}

/** 二创场景：独立插件文件复制后修改，与原插件并存并各自独立卸载。 */
async function scenarioFork() {
  const original = `// 二创原始插件：注册一个示例工具。
export default {
  name: "hello-original",
  inject: ["tools"],
  apply(ctx) {
    ctx.effect(() => ctx.tools.registerTool({
      name: "hello_original",
      title: "原版问候",
      description: "返回原版问候语。",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      execute: async () => ({ ok: true, output: "hello from original", summary: "原版" }),
    }));
  },
};
`;

  const forked = original
    .replace(/hello-original/g, "hello-fork")
    .replace(/hello_original/g, "hello_fork")
    .replace(/原版问候/g, "二创问候")
    .replace(/原版/g, "二创")
    .replace(/hello from original/g, "hello from fork");

  writeFileSync(join(PROFILE, "hello-original.mjs"), original, "utf8");
  writeFileSync(join(PROFILE, "hello-fork.mjs"), forked, "utf8");

  const { ctx, fiber } = await mount();
  await ctx.loader.create({ id: "tools", name: "@lfaa/tools" });
  await ctx.loader.await();

  await ctx.loader.create({ id: "original", name: pathToFileURL(join(PROFILE, "hello-original.mjs")).href });
  await ctx.loader.create({ id: "fork", name: pathToFileURL(join(PROFILE, "hello-fork.mjs")).href });
  await ctx.loader.await();

  const names = ctx.tools.listDefinitions().map((tool) => tool.name);
  check("二创插件与原插件并存", names.includes("hello_original") && names.includes("hello_fork"), `tools=${names.length}`);

  const result = await ctx.tools.executeTool("hello_fork", {}, {});
  check("二创插件可独立执行", result.ok === true, `output=${String(result.output).trim()}`);

  ctx.loader.remove("original");
  await ctx.loader.await();
  const afterRemove = ctx.tools.listDefinitions().map((tool) => tool.name);
  check("卸载原版不影响二创", !afterRemove.includes("hello_original") && afterRemove.includes("hello_fork"), `tools=${afterRemove.length}`);

  ctx.loader.remove("fork");
  await ctx.loader.await();
  const afterAll = ctx.tools.listDefinitions().map((tool) => tool.name);
  check("二创卸载后工具回归基线", afterAll.length === 10 && !afterAll.includes("hello_fork"), `tools=${afterAll.length}`);

  await fiber.dispose();
}

try {
  await main();
} finally {
  rmSync(PROFILE, { recursive: true, force: true });
}

const failed = steps.filter((step) => !step.ok);
console.log(`\n${steps.length - failed.length} / ${steps.length} 步通过。`);
process.exitCode = failed.length > 0 ? 1 : 0;
