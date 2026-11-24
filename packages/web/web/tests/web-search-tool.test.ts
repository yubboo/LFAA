// 验证 web_search 工具：Bing / DuckDuckGo HTML 解析、uddg 链接解包、结果格式化与 Cordis 插件注册/卸载。
import assert from "node:assert/strict";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { toolsPlugin } from "@lfaa/tools";
import { toolWebPlugin } from "../src/tool/fetch-url-tool";
import {
  formatSearchResults,
  parseBingHtml,
  parseDuckDuckGoHtml,
  searchWeb,
  unwrapDuckDuckGoUrl,
} from "../src/tool/web-search-tool";

test("parseBingHtml 提取标题、链接、摘要并去重", () => {
  const html = `
    <ol id="b_results">
      <li class="b_algo">
        <h2><a href="https://base-ui.com/react/overview">Base UI &amp; React</a></h2>
        <p>Unstyled <strong>UI</strong> components for accessible web apps.</p>
      </li>
      <li class="b_algo">
        <h2><a href="https://base-ui.com/react/overview">Duplicate</a></h2>
        <p>Should be ignored.</p>
      </li>
    </ol>
  `;
  const items = parseBingHtml(html, 5);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    title: "Base UI & React",
    url: "https://base-ui.com/react/overview",
    snippet: "Unstyled UI components for accessible web apps.",
  });
});

test("parseDuckDuckGoHtml 与 unwrapDuckDuckGoUrl 正确解包跳转链接", () => {
  const unwrapped = unwrapDuckDuckGoUrl("//duckduckgo.com/l/?uddg=https%3A%2F%2Freact.dev%2Freference");
  assert.equal(unwrapped, "https://react.dev/reference");

  const html = `
    <div class="result results_links">
      <div class="links_main">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freact.dev%2F">React Docs</a>
        <a class="result__snippet">The library for web and native user interfaces.</a>
      </div>
    </div>
  `;
  const items = parseDuckDuckGoHtml(html, 5);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.url, "https://react.dev/");
  assert.equal(items[0]?.title, "React Docs");
  assert.match(items[0]?.snippet ?? "", /web and native/u);
});

test("searchWeb 拒绝空关键词，formatSearchResults 输出 Markdown 列表", async () => {
  const empty = await searchWeb("   ");
  assert.equal(empty.ok, false);
  assert.match(empty.error ?? "", /不能为空/u);

  const formatted = formatSearchResults("Base UI", {
    ok: true,
    provider: "bing",
    items: [{ title: "Base UI", url: "https://base-ui.com", snippet: "Unstyled components" }],
  });
  assert.match(formatted, /1\. \*\*Base UI\*\*/u);
  assert.match(formatted, /https:\/\/base-ui\.com/u);
  assert.match(formatted, /fetch_url/u);
});

test("toolWebPlugin 同时注册 web_search 与 fetch_url，卸载时完整清理", async () => {
  const ctx = new Context();
  const toolsFiber = ctx.plugin(toolsPlugin, {});
  await toolsFiber;
  const fiber = ctx.plugin(toolWebPlugin);
  await fiber;
  try {
    assert.ok(ctx.tools.getTool("web_search"));
    assert.ok(ctx.tools.getTool("fetch_url"));
    await fiber.dispose();
    assert.equal(ctx.tools.getTool("web_search"), undefined);
    assert.equal(ctx.tools.getTool("fetch_url"), undefined);
  } finally {
    await toolsFiber.dispose();
  }
});
