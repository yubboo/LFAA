import assert from "node:assert/strict";
import test from "node:test";
import { resolveBrowserAddress } from "lfaa-client-ui-sidebar-browser/src/browser-address.js";

test("browser address bar uses the configured search engine for plain text", () => {
  assert.equal(resolveBrowserAddress("  local browser test  ", "bing"), "https://www.bing.com/search?q=local%20browser%20test");
  assert.equal(resolveBrowserAddress("local browser test", "google"), "https://www.google.com/search?q=local%20browser%20test");
  assert.equal(resolveBrowserAddress("local browser test", "duckduckgo"), "https://duckduckgo.com/?q=local%20browser%20test");
});

test("browser address bar normalizes HTTP(S), domains, and local development URLs", () => {
  assert.equal(resolveBrowserAddress("example.com/path", "bing"), "https://example.com/path");
  assert.equal(resolveBrowserAddress("localhost:3000/work", "bing"), "http://localhost:3000/work");
  assert.equal(resolveBrowserAddress("127.0.0.1:3000/work", "bing"), "http://127.0.0.1:3000/work");
  assert.equal(resolveBrowserAddress("https://example.com/a", "bing"), "https://example.com/a");
});

test("browser address bar rejects non-web protocols, embedded credentials, and oversized input", () => {
  assert.throws(() => resolveBrowserAddress("javascript:alert(1)", "bing"), /HTTP\(S\)/u);
  assert.throws(() => resolveBrowserAddress("file:///C:/secret.txt", "bing"), /HTTP\(S\)/u);
  assert.throws(() => resolveBrowserAddress("https://user:secret@example.com", "bing"), /HTTP\(S\)/u);
  assert.throws(() => resolveBrowserAddress(" ", "bing"), /输入网址或搜索内容/u);
  assert.throws(() => resolveBrowserAddress("x".repeat(1_801), "bing"), /过长/u);
});
