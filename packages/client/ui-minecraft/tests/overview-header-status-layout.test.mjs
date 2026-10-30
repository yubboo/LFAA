import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(new URL("../src/MinecraftWorkspace.tsx", import.meta.url), "utf8");
const workspaceStyles = readFileSync(new URL("../src/MinecraftWorkspace.css", import.meta.url), "utf8");

test("Minecraft overview keeps connection and sync status in a separate right header group", () => {
  assert.ok(workspaceSource.includes('const isMinecraftOverviewHome = currentSection === "overview" && !selectedInstance;'));
  assert.ok(/<div className="minecraft-overview-heading__status" aria-label="连接与同步状态">\s*<Tag role="status"[\s\S]*?minecraft-overview-sync/u.test(workspaceSource));
  assert.ok(/!isInstanceConsole && !isMinecraftOverviewHome \? <Tag/u.test(workspaceSource));
  assert.ok(/currentSection === "overview" && selectedInstance \? <span className="minecraft-overview-sync"/u.test(workspaceSource));
});

test("overview heading aligns status to the right and stacks it cleanly in narrow containers", () => {
  assert.ok(/\.minecraft-page-heading--overview\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;[^}]*grid-template-areas:\s*"copy status"\s+"actions actions"/u.test(workspaceStyles));
  assert.ok(/\.minecraft-page-heading--overview > \.minecraft-overview-heading__status\s*\{[^}]*justify-self:\s*end/u.test(workspaceStyles));
  assert.ok(/@container module-center-content \(max-width: 560px\)[\s\S]*?\.minecraft-page-heading--overview \{[^}]*grid-template-areas:\s*"copy"\s+"status"\s+"actions"/u.test(workspaceStyles));
});
