import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(new URL("../src/MinecraftWorkspace.tsx", import.meta.url), "utf8");
const workspaceStyles = readFileSync(new URL("../src/MinecraftWorkspace.css", import.meta.url), "utf8");

test("the card surface and its management entry are independent links to the matching overview", () => {
  const cardStart = workspaceSource.indexOf('const instanceRoute = getInstanceRoute(instance.id, "overview");');
  const cardEnd = workspaceSource.indexOf("</Card>", cardStart);
  assert.notEqual(cardStart, -1, "the instance card route exists");
  assert.notEqual(cardEnd, -1, "the instance card markup exists");
  const card = workspaceSource.slice(cardStart, cardEnd);
  const surfaceLinkStart = card.indexOf('className="minecraft-instance-card__surface-link"');
  const managementLinkStart = card.indexOf('className="minecraft-instance-card__management-link"');
  const surfaceLink = card.slice(card.lastIndexOf("<a", surfaceLinkStart), card.indexOf("/>", surfaceLinkStart) + 2);
  const managementLink = card.slice(managementLinkStart - '<a '.length, card.indexOf("</a>", managementLinkStart) + 4);
  assert.ok(surfaceLinkStart >= 0, "the whole card has a dedicated link surface");
  assert.ok(managementLinkStart > surfaceLinkStart, "the visible management entry is a separate link");
  for (const link of [surfaceLink, managementLink]) {
    assert.ok(link.includes("href={instanceRoute}"));
    assert.ok(link.includes("navigateFromInstanceEntry(event, instanceRoute, onNavigate)"));
  }
  assert.ok(surfaceLink.includes('aria-label={`打开实例 ${instance.name}`}'));
  assert.ok(managementLink.includes('aria-label={`管理实例 ${instance.name}`}'));
  assert.equal(card.split("<a className=").length - 1, 2, "card and management are sibling links, with no nested link");
  assert.ok(!card.includes("<Button") && !card.includes("<Popconfirm") && !card.includes("安全停止"), "lifecycle controls do not appear in the list card");
});

test("lifecycle and file actions remain inside the instance overview", () => {
  const overview = workspaceSource.match(/className="minecraft-instance-hero__actions"[\s\S]*?<\/div>/u)?.[0];
  assert.ok(overview, "the internal overview action group exists");
  assert.match(overview, />启动<\/Button>/u);
  assert.match(overview, /安全停止/u);
  assert.match(overview, /安全重启/u);
  assert.match(overview, /进入控制台/u);
  assert.match(overview, /打开实例文件/u);
});

test("instance overview replaces its repeated connection badge with a server-list return action", () => {
  assert.ok(workspaceSource.includes('detailView === "overview" && selectedInstanceId ? <Button onClick={() => onNavigate(`${minecraftRoot}/instances`)}>返回服务器列表</Button>'));
  assert.match(workspaceSource, /!isInstanceConsole && !isMinecraftOverviewHome \? <Tag role="status"/u, "connection status remains available on other applicable pages");
});

test("archive deletion remains confirmed and gated in the instance overview", () => {
  assert.match(workspaceSource, /<Popconfirm[\s\S]*?title=\{`删除“\$\{selectedInstance\.name\}”？`\}[\s\S]*?onConfirm=\{\(\) => deleteInstance\(selectedInstance\)\}[\s\S]*?<Button danger[^>]*>归档并删除<\/Button>/u);
  assert.match(workspaceSource, /disabled=\{!canOperate \|\| selectedInstance\.nodeStatus !== "online" \|\| busy \|\| !\["stopped", "error", "unknown"\]\.includes\(selectedInstance\.state\)\}/u);
  assert.match(workspaceSource, /if \(submitted && selectedInstance\?\.id === instance\.id\) onNavigate\(`\$\{minecraftRoot\}\/instances`\)/u);
});

test("card and management entries have independent focus and hover states across narrow containers", () => {
  assert.ok(workspaceStyles.includes(".minecraft-instance-card__surface-link:focus-visible { outline: 2px solid var(--color-focus-ring)"));
  assert.ok(workspaceStyles.includes(".minecraft-instance-card__management-link:hover, "));
  assert.ok(!workspaceStyles.includes(".minecraft-instance-card__surface:hover > .minecraft-instance-card__management-link"), "hovering the card does not highlight its management entry");
  assert.ok(workspaceStyles.includes(".minecraft-instance-card__surface { grid-template-columns: minmax(0, 1fr); align-items: start; }"));
  assert.ok(workspaceStyles.includes(".minecraft-instance-card__management-link { position: relative; z-index: 2; display: inline-flex; min-width: 84px; min-height: 44px;"));
});
