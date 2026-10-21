/**
 * 功能：验证 Agent 工具摘要目录的多关键词查询。
 * 作用：用内存中的工具合同覆盖分词、排序、分页与空结果，不初始化账户或存储 Owner。
 * 关联文件：packages/core/tools/src/discovery-tools.ts、Agent Loop 的按需工具发现。
 */
import test from "node:test";
import assert from "node:assert/strict";

test("工具目录多关键词按任一词检索并按匹配数排序", async () => {
  const { createToolDiscoveryTools } = await import("lfaa-tools/src/discovery-tools.js");
  const available = [
    { id: "workspace-files", name: "project_file_operation", description: "列举项目文件、读取文件、编辑文件或搜索代码。" },
    { id: "file-read", name: "lfaa_read_file", description: "读取文本文件内容。" },
    { id: "shell", name: "local_execute_command", description: "运行控制端 PowerShell 命令。" },
    { id: "mcp-install", name: "capability_install", description: "安装用户提供的 MCP 服务端点。" },
    { id: "mcp-status", name: "lfaa_capability_status", description: "查询当前 MCP 服务配置状态。" }
  ];
  const [list] = createToolDiscoveryTools(() => available, () => {});
  const context = { signal: new AbortController().signal };

  const files = await list.execute(list.parse({ query: "文件 读取 编辑 搜索" }), context);
  assert.equal(files.total, 2, "多个词之间不要求在说明中连续出现");
  assert.deepEqual(files.tools.map(tool => tool.name), ["project_file_operation", "lfaa_read_file"]);
  assert.deepEqual(files.tools[0].matchedTerms, ["文件", "读取", "编辑", "搜索"]);
  assert.deepEqual(files.tools[1].matchedTerms, ["文件", "读取"]);

  const mcp = await list.execute(list.parse({ query: "MCP/服务，安装" }), context);
  assert.equal(mcp.total, 2, "中英文标点都能分隔检索词");
  assert.deepEqual(mcp.tools.map(tool => tool.name), ["capability_install", "lfaa_capability_status"]);

  const page = await list.execute(list.parse({ query: "", offset: 1, limit: 1 }), context);
  assert.equal(page.total, available.length);
  assert.equal(page.tools[0].name, available[1].name, "空查询分页仍保留注册顺序");

  const none = await list.execute(list.parse({ query: "火星 激光" }), context);
  assert.equal(none.total, 0, "确实无匹配时返回空结果");
});
