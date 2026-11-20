// 验证会话附件：名称/大小校验、落盘与索引、HTTP 分支，以及 list/read 工具端到端。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { toolsPlugin, type ToolExecutionContext } from "@lfaa/tools";
import attachmentPlugin, {
  AttachmentStore,
  createAttachmentHttpHandler,
  isTextMime,
  safeAttachmentName,
  safeSessionDir,
  type AttachmentService,
} from "../src/index";

function execContext(sessionId = "s1"): ToolExecutionContext {
  return { workspaceRoots: [process.cwd()], sessionId, runId: "r1", signal: new AbortController().signal };
}

async function withTempRoot(run: (rootDir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-attachment-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function fakeRes(): { res: ServerResponse; captured: { status: number; body: string } } {
  const captured = { status: 0, body: "" };
  const res = {
    setHeader() {},
    end(chunk?: string | Buffer) {
      if (chunk !== undefined) captured.body += String(chunk);
      return res as unknown as ServerResponse;
    },
  } as unknown as ServerResponse;
  Object.defineProperty(res, "statusCode", {
    get: () => captured.status,
    set: (value: number) => { captured.status = value; },
  });
  return { res, captured };
}

function fakeReq(url: string, method: string, body?: unknown): IncomingMessage {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  return {
    url,
    method,
    async *[Symbol.asyncIterator]() {
      if (payload) yield payload;
    },
  } as unknown as IncomingMessage;
}

function fakeService(store: AttachmentStore): AttachmentService {
  return {
    store,
    list: (sessionId: string) => store.list(sessionId),
    put: store.put.bind(store),
    get: (sessionId: string, id: string) => store.get(sessionId, id),
    remove: (sessionId: string, id: string) => store.remove(sessionId, id),
  } as unknown as AttachmentService;
}

test("名称与会话目录净化，文本类型判定", () => {
  assert.equal(safeAttachmentName("a/b\\c.txt"), "c.txt");
  assert.equal(safeAttachmentName("  "), "attachment");
  assert.ok(safeAttachmentName("x".repeat(300)).length <= 120);
  assert.equal(safeSessionDir("../../etc/passwd"), "______etc_passwd");
  assert.equal(isTextMime("text/plain"), true);
  assert.equal(isTextMime("application/json"), true);
  assert.equal(isTextMime("image/png"), false);
});

test("落盘：put/list/get/remove 与索引一致", async () => {
  await withTempRoot(async (rootDir) => {
    const store = new AttachmentStore(rootDir);
    const content = Buffer.from("你好，附件").toString("base64");
    const item = await store.put({ sessionId: "s1", name: "notes.txt", mime: "text/plain", contentBase64: content });
    assert.equal(item.name, "notes.txt");
    assert.equal(item.size, Buffer.from("你好，附件").length);

    const stored = await readFile(join(rootDir, "s1", item.storedName), "utf8");
    assert.equal(stored, "你好，附件");

    assert.equal((await store.list("s1")).length, 1);
    assert.equal((await store.list("other")).length, 0);
    const found = await store.get("s1", item.id);
    assert.equal(found?.contentBase64, content);
    assert.equal(await store.get("s1", "missing"), undefined);

    assert.equal(await store.remove("s1", item.id), true);
    assert.equal(await store.remove("s1", item.id), false);
    assert.equal((await store.list("s1")).length, 0);
  });
});

test("校验：空内容、超限与真实大小限制", async () => {
  await withTempRoot(async (rootDir) => {
    const store = new AttachmentStore(rootDir, 8);
    await assert.rejects(() => store.put({ sessionId: "s1", name: "a.bin", contentBase64: "" }), /为空/u);
    await assert.rejects(
      () => store.put({ sessionId: "s1", name: "a.bin", contentBase64: Buffer.from("0123456789").toString("base64") }),
      /上限/u,
    );
    await assert.rejects(() => store.put({ sessionId: "", name: "a.bin", contentBase64: "YQ==" }), /缺少 sessionId/u);
  });
});

test("HTTP：上传、列表、按 id 读取、删除与非法请求", async () => {
  await withTempRoot(async (rootDir) => {
    const store = new AttachmentStore(rootDir);
    const handler = createAttachmentHttpHandler(fakeService(store));

    const uploaded = fakeRes();
    await handler(fakeReq("/api/attachments", "POST", {
      sessionId: "s1",
      name: "a.txt",
      mime: "text/plain",
      contentBase64: Buffer.from("hello").toString("base64"),
    }), uploaded.res);
    assert.equal(uploaded.captured.status, 200);
    const item = JSON.parse(uploaded.captured.body).item;
    assert.equal(item.name, "a.txt");

    const listed = fakeRes();
    await handler(fakeReq("/api/attachments?sessionId=s1", "GET"), listed.res);
    assert.equal(JSON.parse(listed.captured.body).items.length, 1);

    const content = fakeRes();
    await handler(fakeReq(`/api/attachments/${item.id}?sessionId=s1`, "GET"), content.res);
    assert.equal(JSON.parse(content.captured.body).contentBase64, Buffer.from("hello").toString("base64"));

    const missing = fakeRes();
    await handler(fakeReq("/api/attachments/nope?sessionId=s1", "GET"), missing.res);
    assert.equal(missing.captured.status, 404);

    const removed = fakeRes();
    await handler(fakeReq(`/api/attachments/${item.id}?sessionId=s1`, "DELETE"), removed.res);
    assert.equal(JSON.parse(removed.captured.body).removed, true);

    const wrongMethod = fakeRes();
    await handler(fakeReq("/api/attachments", "PUT"), wrongMethod.res);
    assert.equal(wrongMethod.captured.status, 405);
    assert.equal(await handler(fakeReq("/api/other", "GET"), fakeRes().res), false);
  });
});

test("工具端到端：list_attachments 与 read_attachment（文本内联、二进制说明）", async () => {
  await withTempRoot(async (rootDir) => {
    const ctx = new Context();
    await ctx.plugin(toolsPlugin, { includeBuiltins: false });
    await ctx.plugin(attachmentPlugin, { rootDir });
    const text = await ctx.attachment.store.put({
      sessionId: "s1",
      name: "notes.txt",
      mime: "text/plain",
      contentBase64: Buffer.from("第一行\n第二行").toString("base64"),
    });
    const binary = await ctx.attachment.store.put({
      sessionId: "s1",
      name: "image.png",
      mime: "image/png",
      contentBase64: Buffer.from([1, 2, 3, 4]).toString("base64"),
    });

    const listed = await ctx.tools.executeTool("list_attachments", {}, execContext());
    assert.equal(listed.ok, true);
    assert.match(listed.output, /notes\.txt/u);

    const read = await ctx.tools.executeTool("read_attachment", { id: text.id }, execContext());
    assert.equal(read.ok, true);
    assert.match(read.output, /第一行/u);

    const readBinary = await ctx.tools.executeTool("read_attachment", { id: binary.id }, execContext());
    assert.equal(readBinary.ok, true);
    assert.match(readBinary.output, /image\/png/u);

    const missing = await ctx.tools.executeTool("read_attachment", { id: "nope" }, execContext());
    assert.equal(missing.ok, false);
  });
});