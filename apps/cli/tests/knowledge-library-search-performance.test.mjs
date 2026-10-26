/**
 * 功能：测量 Knowledge Library 在每账户文档数和正文大小上限附近的本地检索成本。
 * 作用：为索引决策提供可重复的耗时、事件循环让出与峰值 RSS 证据，不设置脆弱的单机时间门槛。
 * 关联文件：packages/knowledge/knowledge-library/src/index.ts、docs/PROMPTS.md。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Knowledge Library 128 篇×64 KiB 本地搜索记录耗时、事件循环让出与峰值 RSS", { timeout: 120_000 }, () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "lfaa-knowledge-search-perf-"));
  const homeDirectory = join(temporaryRoot, "home");
  const dataDirectory = join(temporaryRoot, "data");
  mkdirSync(homeDirectory, { recursive: true });
  mkdirSync(dataDirectory, { recursive: true });
  try {
    const source = [
      'import assert from "node:assert/strict";',
      'import { createServer } from "node:http";',
      'import { once } from "node:events";',
      'import { performance } from "node:perf_hooks";',
      'const reservation = createServer();',
      'reservation.listen(0, "127.0.0.1");',
      'await once(reservation, "listening");',
      'process.env.SERVER_PORT = String(reservation.address().port);',
      'await new Promise(resolve => reservation.close(resolve));',
      'const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");',
      'const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");',
      'const { configuration } = await import("lfaa-storage-domain/src/configuration.js");',
      'const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");',
      'retireLegacyFileTables();',
      'database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES (\'knowledge-perf-owner\',9101,\'knowledge-perf-owner\',\'salt\',\'hash\',\'member\',0)").run();',
      'const knowledge = await import("lfaa-knowledge-library/src/index.js");',
      'const userId = "knowledge-perf-owner";',
      'const filler = "archive project memory ".repeat(2300) + "x".repeat(12_000);',
      'const targetId = { value: "" };',
      'for (let index = 0; index < knowledge.KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser; index += 1) {',
      '  const marker = index === knowledge.KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser - 1 ? "项目权限目标索引" : "无关归档条目";',
      '  const contentMarkdown = "# Archive " + index + "\\n" + filler + "\\n" + marker;',
      '  const bytes = Buffer.byteLength(contentMarkdown, "utf8");',
      '  assert.ok(bytes <= knowledge.KNOWLEDGE_LIBRARY_LIMITS.markdownBytes, "每份合成资料不得超过 Owner 正文上限");',
      '  assert.ok(bytes >= knowledge.KNOWLEDGE_LIBRARY_LIMITS.markdownBytes - 1024, "合成资料应覆盖正文上界附近");',
      '  const item = knowledge.createKnowledgeLibraryItem(userId, { applicationId: "workspace", kind: "knowledge", title: "Archive " + index, contentMarkdown, sourceKind: "manual" });',
      '  if (index === knowledge.KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser - 1) targetId.value = item.id;',
      '}',
      'const query = "项目权限";',
      'const searches = 7;',
      'const samples = [];',
      'let searchYieldsToEventLoop = false;',
      'let maxEventLoopDelayMs = 0;',
      'const intervalMs = 10;',
      'let expectedTick = performance.now() + intervalMs;',
      'const timer = setInterval(() => {',
      '  const now = performance.now();',
      '  maxEventLoopDelayMs = Math.max(maxEventLoopDelayMs, Math.max(0, now - expectedTick));',
      '  expectedTick = now + intervalMs;',
      '}, intervalMs);',
      'await new Promise(resolve => setTimeout(resolve, intervalMs));',
      'const rssBeforeSearchBytes = process.memoryUsage().rss;',
      'const peakRssBeforeSearchKiB = process.resourceUsage().maxRSS;',
      'for (let index = 0; index < searches; index += 1) {',
      '  const started = performance.now();',
      '  const pendingSearch = knowledge.searchKnowledgeLibrary(userId, "workspace", query);',
      '  if (index === 0) {',
      '    let completed = false;',
      '    void pendingSearch.then(() => { completed = true; });',
      '    await new Promise(resolve => setTimeout(resolve, 0));',
      '    searchYieldsToEventLoop = !completed;',
      '  }',
      '  const hits = await pendingSearch;',
      '  samples.push(performance.now() - started);',
      '  assert.ok(hits.length >= 1 && hits.length <= knowledge.KNOWLEDGE_LIBRARY_LIMITS.searchResults);',
      '  assert.equal(hits[0].id, targetId.value, "相关目标应排在上界资料集首位");',
      '  assert.ok(hits.every(hit => hit.snippet.length <= knowledge.KNOWLEDGE_LIBRARY_LIMITS.snippetCharacters));',
      '}',
      'await new Promise(resolve => setTimeout(resolve, intervalMs));',
      'clearInterval(timer);',
      'const sorted = [...samples].sort((left, right) => left - right);',
      'const metrics = {',
      '  documents: knowledge.KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser,',
      '  contentBytesPerDocument: Buffer.byteLength("# Archive 0\\n" + filler + "\\n无关归档条目", "utf8"),',
      '  scannedContentBytesPerSearch: knowledge.KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser * Buffer.byteLength("# Archive 0\\n" + filler + "\\n无关归档条目", "utf8"),',
      '  searches,',
      '  searchYieldsToEventLoop,',
      '  p50Ms: Number(sorted[Math.floor((sorted.length - 1) * 0.5)].toFixed(3)),',
      '  p95Ms: Number(sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(3)),',
      '  maxEventLoopDelayMs: Number(maxEventLoopDelayMs.toFixed(3)),',
      '  rssBeforeSearchBytes,',
      '  rssAfterSearchBytes: process.memoryUsage().rss,',
      '  peakRssBeforeSearchKiB,',
      '  peakRssAfterSearchKiB: process.resourceUsage().maxRSS',
      '};',
      'console.log("KNOWLEDGE_SEARCH_PERF=" + JSON.stringify(metrics));',
      'sessionRecords.close();',
      'configuration.close();',
      'closeDatabase();'
    ].join("\n");
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", source], {
      cwd: cli,
      env: { ...process.env, NODE_ENV: "test", JWT_SECRET: "", SERVER_HOST: "127.0.0.1", LFAA_HOME: homeDirectory, LFAA_DATA_DIR: dataDirectory, USERPROFILE: homeDirectory, HOME: homeDirectory },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 90_000
    });
    const metricLine = output.split(/\r?\n/u).find(line => line.startsWith("KNOWLEDGE_SEARCH_PERF="));
    assert.ok(metricLine, "隔离基准必须返回实测指标");
    const metrics = JSON.parse(metricLine.slice("KNOWLEDGE_SEARCH_PERF=".length));
    assert.equal(metrics.documents, 128);
    assert.equal(metrics.searches, 7);
    assert.equal(metrics.searchYieldsToEventLoop, true);
    assert.ok(metrics.p50Ms >= 0 && metrics.p95Ms >= metrics.p50Ms);
    assert.ok(metrics.maxEventLoopDelayMs >= 0);
    assert.ok(metrics.peakRssAfterSearchKiB >= metrics.peakRssBeforeSearchKiB);
    console.log("Knowledge Library 上界检索指标", JSON.stringify(metrics));
  } finally {
    const resolved = resolve(temporaryRoot);
    assert.equal(dirname(resolved), resolve(tmpdir()));
    assert.equal(resolved.split(/[\\/]/u).at(-1)?.startsWith("lfaa-knowledge-search-perf-"), true);
    rmSync(resolved, { recursive: true, force: true });
  }
});
