/** 将 dist/server 的裸包导入解析到 server/package.json 所属 node_modules。 */
import { createRequire, isBuiltin } from "node:module";
import { pathToFileURL } from "node:url";

const requireFromServer = createRequire(new URL("./package.json", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (isBuiltin(specifier) || specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:") || specifier.startsWith("data:") || specifier.startsWith("#")) {
    return nextResolve(specifier, context);
  }

  try {
    const resolved = requireFromServer.resolve(specifier);
    return { url: pathToFileURL(resolved).href, shortCircuit: true };
  } catch {
    return nextResolve(specifier, context);
  }
}
