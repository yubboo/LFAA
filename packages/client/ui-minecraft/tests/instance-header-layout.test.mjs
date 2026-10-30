import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(new URL("../src/MinecraftWorkspace.tsx", import.meta.url), "utf8");
const workspaceStyles = readFileSync(new URL("../src/MinecraftWorkspace.css", import.meta.url), "utf8");

test("instance heading groups its left copy and right controls in one parent box", () => {
  assert.ok(/className=\{`minecraft-page-heading\$\{selectedInstance \? " minecraft-page-heading--instance"/u.test(workspaceSource));
  assert.ok(/<Space className="minecraft-page-heading__controls"/u.test(workspaceSource));
});

test("all instance tabs reserve the same one-line description slot", () => {
  assert.ok(/<div className="minecraft-page-heading__description-slot" aria-hidden=\{!pageDescription\}>\s*<Typography\.Paragraph className=\{pageDescription \? undefined : "minecraft-page-heading__description-placeholder"\}/u.test(workspaceSource));
  assert.ok(/\.minecraft-page-heading--instance > \.minecraft-page-heading__copy > \.minecraft-page-heading__description-slot > \.ant-typography \{[^}]*-webkit-line-clamp: 1/u.test(workspaceStyles));
  assert.ok(workspaceStyles.includes(".minecraft-page-heading--instance > .minecraft-page-heading__copy > .minecraft-page-heading__description-slot > .minecraft-page-heading__description-placeholder { visibility: hidden; }"));
});

test("instance controls stay on the right at desktop and narrow-column widths", () => {
  assert.ok(/\.minecraft-page-heading--instance\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/u.test(workspaceStyles));
  assert.ok(/\.minecraft-page-heading--instance > \.minecraft-page-heading__controls \{[^}]*justify-self:\s*end/u.test(workspaceStyles));
  assert.ok(/@container module-center-content \(max-width: 800px\)[\s\S]*?\.minecraft-page-heading--instance > \.minecraft-page-heading__controls \{[^}]*width:\s*auto;[^}]*justify-content:\s*flex-end/u.test(workspaceStyles));
  assert.ok(/@container module-center-content \(max-width: 420px\)[\s\S]*?\.minecraft-page-heading--instance \{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u.test(workspaceStyles));
  assert.ok(/\.minecraft-page-heading--instance > \.minecraft-page-heading__controls \{[^}]*width:\s*100%;[^}]*justify-self:\s*stretch/u.test(workspaceStyles));
});

test("the console tab keeps the shared workspace vertical spacing", () => {
  const rule = workspaceStyles.match(/\.minecraft-workspace--instance-console\s*\{([^}]*)\}/u);
  assert.ok(rule, "console workspace rule exists");
  assert.ok(!/(?:^|;)\s*(?:gap|padding-block)\s*:/u.test(rule[1]));
});
