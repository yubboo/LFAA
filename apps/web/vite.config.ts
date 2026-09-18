import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(appRoot, "../..");
const resourceRoot = path.join(projectRoot, ".lfaa");
const resourceKinds = ["skills", "experts", "plugins", "extensions", "mcp"] as const;

const devPort = Number.parseInt(process.env.LFAA_WEB_PORT ?? "5173", 10);
const previewPort = Number.parseInt(process.env.LFAA_WEB_PREVIEW_PORT ?? "4173", 10);

type ResourceKind = (typeof resourceKinds)[number];

async function scanResources() {
  const resources: Array<{ kind: ResourceKind; name: string; relativePath: string; entryType: "file" | "directory"; updatedAt: number }> = [];

  for (const kind of resourceKinds) {
    const folder = path.join(resourceRoot, kind);
    let entries;
    try { entries = await readdir(folder, { withFileTypes: true }); } catch { continue; }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "README.md") continue;
      const absolute = path.join(folder, entry.name);
      let updatedAt = 0;
      try { updatedAt = (await stat(absolute)).mtimeMs; } catch { /* resource may be changing */ }
      resources.push({
        kind,
        name: entry.name,
        relativePath: `.lfaa/${kind}/${entry.name}`,
        entryType: entry.isDirectory() ? "directory" : "file",
        updatedAt,
      });
    }
  }

  return resources.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "zh-CN"));
}

function isAllowedResourcePath(file: string): boolean {
  const relative = path.relative(resourceRoot, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  const [kind] = relative.split(path.sep);
  return resourceKinds.includes(kind as ResourceKind);
}

function lfaaDevResourceBridge(): Plugin {
  return {
    name: "lfaa-dev-resource-bridge",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      for (const kind of resourceKinds) server.watcher.add(path.join(resourceRoot, kind));

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

export default defineConfig({
  root: appRoot,
  plugins: [lfaaDevResourceBridge()],
  server: {
    host: "127.0.0.1",
    port: Number.isFinite(devPort) ? devPort : 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: Number.isFinite(previewPort) ? previewPort : 4173,
    strictPort: true,
  },
});
