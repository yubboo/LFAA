import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Java 管理列表和详情只使用节点运行时与实例需求真实字段", () => {
  const panel = read("../../../packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx");

  assert.match(panel, /server\.requiredJavaMajor/u);
  assert.match(panel, /item\.available&&typeof item\.major==="number"/u);
  assert.match(panel, /item\.vendor,item\.version,item\.executablePath/u);
  assert.match(panel, /在线设备|设备离线/u);
  assert.match(panel, /搜索 Java 版本、厂商或路径/u);
  assert.match(panel, /Java 版本排序/u);
  assert.match(panel, /关联实例/u);
  assert.doesNotMatch(panel, /性能评分|兼容性评分|启动速度|内存评分/u);
});

test("主从式 Java 布局按容器宽度重排，并继续调用原 Runtime Manager 操作", () => {
  const panel = read("../../../packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx");
  const css = read("../../../packages/client/ui-layout/src/GameLibraryPage.css");
  const runtimeActions = panel.indexOf('className="runtime-manager__java-runtime-actions"');
  const reuseAction = panel.indexOf('className="runtime-manager__java-runtime-reuse"');

  assert.match(panel, /operate\("install",\{major:/u);
  assert.match(panel, /operate\("register",\{executablePath:path\}\)/u);
  assert.match(panel, /operate\("verify",\{runtimeId:item\.runtimeId\}\)/u);
  assert.match(panel, /operate\("update",\{runtimeId:item\.runtimeId,major:item\.major\}\)/u);
  assert.match(panel, /operate\("remove",\{runtimeId:item\.runtimeId,major:activeMajor\}\)/u);
  assert.match(panel, /operate\("forget",\{runtimeId:item\.runtimeId\}\)/u);
  assert.match(panel, /lfaa-card-motion-list/u);
  assert.ok(runtimeActions >= 0 && reuseAction > runtimeActions && reuseAction < panel.indexOf("</article>", runtimeActions));
  assert.match(panel, /canInstallSelected&&!availableRuntimes\.length/u);
  assert.match(css, /\.runtime-manager__java-layout\s*\{[^}]*grid-template-columns:\s*minmax\(17rem,\s*\.82fr\)\s+minmax\(0,\s*1\.18fr\)/u);
  assert.match(css, /\.runtime-manager__java-runtime-reuse\s*\{\s*margin-inline-start:\s*auto/u);
  assert.match(css, /@container runtime-manager \(max-width:\s*54rem\)\s*\{[^}]*\.runtime-manager__java-layout\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(css, /url\("\/backgrounds\/cherry-blossom-waterfront\.png"\)/u);
  assert.doesNotMatch(css, /display:\s*inline-block/u);
});

test("运行环境返回 Minecraft 的入口位于页头且保留原返回目标", () => {
  const page = read("../../../packages/client/ui-layout/src/GameLibraryPage.tsx");
  const panel = read("../../../packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx");
  const css = read("../../../packages/client/ui-layout/src/GameLibraryPage.css");
  const headerActions = page.indexOf('className="game-library__header-actions"');
  const returnAction = page.indexOf('className="game-library__return-minecraft"');
  const headerEnd = page.indexOf("</nav>", headerActions);

  assert.ok(headerActions >= 0 && returnAction > headerActions && returnAction < headerEnd);
  assert.ok(page.includes('returnValue==="minecraft"?"/games/minecraft/deployment"'));
  assert.ok(page.includes('returnValue==="overview"?"/games/minecraft/overview"'));
  assert.ok(page.includes('`/games/minecraft/instance/${returnValue}/overview`'));
  assert.match(css, /\.game-library__header-actions\s*\{[^}]*display:\s*flex/u);
  assert.match(css, /@container game-library \(max-width:\s*39rem\)[\s\S]*\.game-library__header-actions\s*>\s*\.ant-btn/u);
  assert.doesNotMatch(panel, /returnPath|返回部署草稿/u);
});
