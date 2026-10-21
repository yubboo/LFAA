import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createProjectPreviewServer } from "../src/project-files.mjs";

async function requestRaw(url, path, method = "GET") {
  return await new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = request({ host: "127.0.0.1", port: Number(target.port), path, method, headers: { host: `127.0.0.1:${target.port}` } }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("serves workspace HTML and relative assets read-only from loopback", async t => {
  const tempRoot = await mkdtemp(join(tmpdir(), "lfaa-project-preview-"));
  const workspace = join(tempRoot, "workspace");
  await mkdir(workspace);
  await writeFile(join(workspace, "index.html"), "<html><link rel=\"stylesheet\" href=\"./style.css\"><body>Preview</body></html>");
  await writeFile(join(workspace, "style.css"), "body { color: rgb(1, 2, 3); }");
  await writeFile(join(tempRoot, "outside.txt"), "outside");
  const preview = await createProjectPreviewServer(workspace, "index.html");
  t.after(async () => { await preview.close(); await rm(tempRoot, { recursive: true, force: true }); });

  const page = await fetch(preview.url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy") ?? "", /connect-src 'self'/u);
  assert.match(await page.text(), /Preview/u);
  const css = await fetch(new URL("style.css", preview.url));
  assert.equal(css.status, 200);
  assert.match(await css.text(), /rgb\(1, 2, 3\)/u);

  assert.equal((await requestRaw(preview.url, "/%2e%2e/outside.txt")).status, 404);
  assert.equal((await requestRaw(preview.url, new URL(preview.url).pathname, "POST")).status, 405);
  assert.equal((await requestRaw(preview.url, "/")).status, 404);
});

test("rejects non-HTML and out-of-root preview entries", async t => {
  const tempRoot = await mkdtemp(join(tmpdir(), "lfaa-project-preview-"));
  const workspace = join(tempRoot, "workspace");
  await mkdir(workspace);
  await writeFile(join(workspace, "index.html"), "<p>ok</p>");
  await writeFile(join(workspace, "secret.txt"), "no preview");
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  await assert.rejects(createProjectPreviewServer(workspace, "../outside.html"), /工作区|根目录|路径/u);
  await assert.rejects(createProjectPreviewServer(workspace, "secret.txt"), /HTML\/HTM/u);
});

test("rejects symlinked assets that escape the workspace", async t => {
  const tempRoot = await mkdtemp(join(tmpdir(), "lfaa-project-preview-"));
  const workspace = join(tempRoot, "workspace");
  await mkdir(workspace);
  await writeFile(join(workspace, "index.html"), "<p>ok</p>");
  await writeFile(join(tempRoot, "outside.txt"), "outside");
  try { await symlink(join(tempRoot, "outside.txt"), join(workspace, "outside.txt")); }
  catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) return t.skip("当前系统不允许创建临时符号链接");
    throw error;
  }
  const preview = await createProjectPreviewServer(workspace, "index.html");
  t.after(async () => { await preview.close(); await rm(tempRoot, { recursive: true, force: true }); });

  assert.equal((await fetch(new URL("outside.txt", preview.url))).status, 403);
});
