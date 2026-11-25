// 回归测试：验证网站访问规则匹配、浏览历史读写及本地 AES-256-GCM 加密密码库与 CSV 导入导出。
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { BrowserDataStore, evaluateSitePolicy } from "./browser-data-store";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("browser-data-store and site policy", () => {
  it("matches exact and wildcard site rules and falls back to default policy", () => {
    const rules = [
      { id: "r1", pattern: "github.com", browse: "allow" as const, download: "ask" as const },
      { id: "r2", pattern: "*.blocked.test", browse: "block" as const, download: "block" as const },
    ];
    assert.equal(evaluateSitePolicy("https://github.com/org/repo", rules, "ask", "browse"), "allow");
    assert.equal(evaluateSitePolicy("https://sub.blocked.test/a", rules, "ask", "browse"), "block");
    assert.equal(evaluateSitePolicy("https://other.example.com", rules, "ask", "browse"), "ask");
  });

  it("persists history and AES-256-GCM encrypted passwords with CSV round-trip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lfaa-browser-data-"));
    tempDirs.push(dir);
    const store = new BrowserDataStore(dir);

    await store.recordHistory("http://127.0.0.1:5173/", "LFAA 工作区", true);
    const hist = await store.listHistory("LFAA");
    assert.equal(hist.length, 1);
    assert.equal(hist[0]?.byAgent, true);

    const saved = await store.upsertPassword({ origin: "http://127.0.0.1:3000", username: "admin", password: "s3cr3t!password" });
    assert.ok(saved.id);
    const listed = await store.listPasswords("3000");
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.password, "s3cr3t!password");

    const csv = await store.exportPasswordsCsv();
    assert.ok(csv.includes("http://127.0.0.1:3000"));
    await store.clearPasswords();
    assert.equal((await store.listPasswords()).length, 0);

    const imported = await store.importPasswordsCsv(csv);
    assert.equal(imported, 1);
    assert.equal((await store.listPasswords())[0]?.username, "admin");
  });
});
