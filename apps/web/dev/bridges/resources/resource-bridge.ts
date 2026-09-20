/**
 * 文件：resource-bridge.ts
 * 作用：Vite dev-server 的 .lfaa 资源元数据桥。
 * 负责：扫描允许的资源目录、提供 localhost 元数据接口、广播资源变化。
 * 不负责：读取资源正文、产品业务、生产 Host、浏览器 UI。
 * 状态归属：资源目录与 Vite watcher 属于 dev-server Node 进程。
 * 对外接口：createLfaaDevResourceBridge(projectRoot)。
 * 关联文件：apps/web/vite.config.ts、apps/web/src/App.tsx、.lfaa/*。
 * 修改注意事项：只返回资源元数据；不得把任意文件正文或 Secret 暴露给浏览器。
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

const RESOURCE_KINDS = ["skills", "experts", "plugins", "extensions", "mcp"] as const;
type ResourceKind = (typeof RESOURCE_KINDS)[number];

export function createLfaaDevResourceBridge(projectRoot: string): Plugin {
  const resourceRoot = path.join(projectRoot, ".lfaa");

  async function scanResources() {
    const resources: Array<{ kind: ResourceKind; name: string; relativePath: string; entryType: "file" | "directory"; updatedAt: number }> = [];
    for (const kind of RESOURCE_KINDS) {
      const folder = path.join(resourceRoot, kind);
      let entries;
      try { entries = await readdir(folder, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "README.md") continue;
        const absolute = path.join(folder, entry.name);
        let updatedAt = 0;
        try { updatedAt = (await stat(absolute)).mtimeMs; } catch { /* resource may be changing */ }
        resources.push({ kind, name: entry.name, relativePath: `.lfaa/${kind}/${entry.name}`, entryType: entry.isDirectory() ? "directory" : "file", updatedAt });
      }
    }
    return resources.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "zh-CN"));
  }

  function isAllowedResourcePath(file: string): boolean {
    const relative = path.relative(resourceRoot, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
    const [kind] = relative.split(path.sep);
    return RESOURCE_KINDS.includes(kind as ResourceKind);
  }

  return {
    name: "lfaa-dev-resource-bridge",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      for (const kind of RESOURCE_KINDS) server.watcher.add(path.join(resourceRoot, kind));
      server.middlewares.use("/__lfaa/dev/resources", async (_request, response) => {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify({ resources: await scanResources() }));
      });
      server.watcher.on("all", (_event, file) => {
        if (!isAllowedResourcePath(file)) return;
        server.ws.send({ type: "custom", event: "lfaa:resources-changed", data: { changed: true } });
      });
    },
  };
}
