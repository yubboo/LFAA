// 验证内置技能点名策略：优先技能必须出现在名单里，其余只报数量。
import assert from "node:assert/strict";
import test from "node:test";
import { buildSkillsCatalogHint } from "../src/context/agent-context";

type Catalog = Array<{ id: string; name: string; source: string; description: string }>;

function skill(name: string, source = "builtin"): Catalog[number] {
  return { id: `${source}:${name}`, name, source, description: "" };
}

test("内置技能点名把 ui-measure 排在最前", () => {
  const hint = buildSkillsCatalogHint([
    skill("agent-browser"),
    skill("ui-measure"),
    skill("code-review"),
  ]);
  assert.match(hint, /内置专业技能（ui-measure、agent-browser、code-review）/u);
});

test("超过 8 个内置技能时只点名 8 个并报总数", () => {
  const catalog: Catalog = Array.from({ length: 10 }, (_, index) => skill(`s${index}`));
  catalog.push(skill("ui-measure"));
  const hint = buildSkillsCatalogHint(catalog);
  assert.match(hint, /ui-measure、s0、s1、s2、s3、s4、s5、s6/u);
  assert.match(hint, /等 11 个/u);
});