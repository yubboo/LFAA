import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { resolve as resolveWorkspaceModule } from "../package-loader.mjs";

test("打包态外部 ESM 依赖交给 CLI 包清单按 import 条件解析", async () => {
  const packagedParent = "file:///D:/LFAA/resources/app-runtime/dist/apps/control-plane/packages/computer-use/computer-use/src/index.js";
  const expectedParent = pathToFileURL(resolve("package.json")).href;
  let actualParent = "";

  const result = await resolveWorkspaceModule("@trycua/cua-driver", { parentURL: packagedParent }, async (specifier, context) => {
    assert.equal(specifier, "@trycua/cua-driver");
    actualParent = context.parentURL;
    return { url: "file:///D:/LFAA/resources/app-runtime/apps/cli/node_modules/@trycua/cua-driver/dist/index.js" };
  });

  assert.equal(actualParent, expectedParent);
  assert.ok(result.url.includes("app-runtime/apps/cli/node_modules/@trycua/cua-driver/dist/index.js"));
});

test("源码态第三方包保留原上下文以解析传递依赖", async () => {
  const dependencyParent = pathToFileURL(resolve("node_modules/.pnpm/cordis/node_modules/@deepseek-ai/cordis/lib/index.js")).href;
  let actualParent = "";

  await resolveWorkspaceModule("@deepseek-ai/cosmokit", { parentURL: dependencyParent }, async (specifier, context) => {
    assert.equal(specifier, "@deepseek-ai/cosmokit");
    actualParent = context.parentURL;
    return { url: "file:///H:/LFAA1/node_modules/.pnpm/cosmokit/lib/index.js" };
  });

  assert.equal(actualParent, dependencyParent);
});
