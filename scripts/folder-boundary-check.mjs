/**
 * 文件：folder-boundary-check.mjs
 * 作用：把 LFAA 目录职责和依赖方向变成可执行的架构门禁。
 * 负责：检查 App / UI / Config System 的长期归属、禁止依赖、Provider 配置目录和关键 README。
 * 不负责：TypeScript 类型检查、Provider 业务正确性、UI 视觉验收、运行时网络测试。
 * 状态归属：无运行时状态；每次直接扫描当前工作树。
 * 对外接口：`node scripts/folder-boundary-check.mjs`。
 * 关联文件：docs/DEVELOPMENT.md、docs/ARCHITECTURE.md、docs/项目结构与代码地图.md、packages/client/ui/README.md、packages/settings/config-system/README.md。
 * 修改注意事项：新增长期目录或改变依赖方向时，必须先更新开发规范和架构文档，再修改本门禁；不得为了单次任务放宽边界。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const ignored = new Set(["node_modules", "dist", "target", "coverage", ".git"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const required = [
  "packages/client/ui/src/features/README.md",
  "packages/client/ui/src/features/settings/README.md",
  "packages/client/ui/src/features/settings/ai/README.md",
  "packages/settings/config-system/src/settings/README.md",
  "packages/settings/config-system/src/settings/ai/README.md",
  "packages/settings/config-system/src/settings/ai/core/README.md",
  "packages/settings/config-system/src/settings/ai/providers/README.md",
  "packages/api/settings-controller/README.md",
  "packages/api/plugin-controller/README.md",
  "packages/api/agent-controller/README.md",
  "packages/client/web/README.md",
  "packages/client/connection/README.md",
  "packages/bundle/web-app/README.md",
  "packages/util/home-paths/README.md",
  "packages/credentials/credentials/README.md",
  "packages/plugin/plugin-host-node/README.md",
  "packages/client/workspace/README.md",
];

const requiredProviderPlugins = ["openai", "deepseek", "zhipu", "kimi", "qwen", "xiaomi"]
  .map((provider) => `packages/settings/config-system/src/settings/ai/providers/${provider}/plugin.ts`);
required.push(...requiredProviderPlugins);

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) {
    failures.push(`${relative}: 缺少长期目录职责 README。`);
  }
}

// App 是薄启动层：业务、Host Adapter、Controller 和可复用 UI 一律进入 packages。
for (const relative of ["apps/web/dev", "apps/web/src/features", "apps/web/src/host-clients", "apps/web/src/terminal", "apps/desktop/src/features"]) {
  if (fs.existsSync(path.join(root, relative))) {
    failures.push(`${relative}: apps/* 只能保留产品入口；业务、Adapter 与 Host Controller 必须进入 packages/<family>/<package>。`);
  }
}

function walk(relativeRoot, visitor) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return;

  const stack = [absoluteRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!sourceExtensions.has(path.extname(entry.name))) continue;
      const relative = path.relative(root, full).replaceAll("\\", "/");
      visitor(relative, fs.readFileSync(full, "utf8"));
    }
  }
}

function imports(text) {
  const result = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) result.push(match[1]);
  }
  return result;
}

// Config System 是业务域，不允许 React / DOM / UI / App 反向依赖。
walk("packages/settings/config-system/src", (relative, text) => {
  if (/\.(?:tsx|jsx)$/.test(relative)) {
    failures.push(`${relative}: Config System 禁止 React/JSX；图形界面必须放 packages/client/ui。`);
  }
  for (const spec of imports(text)) {
    if (
      spec === "react" ||
      spec === "react-dom" ||
      spec.startsWith("@lfaa/ui") ||
      spec.startsWith("@lfaa/app-shell") ||
      spec.startsWith("apps/")
    ) {
      failures.push(`${relative}: Config System 禁止依赖 ${spec}。`);
    }
  }
  if (/\b(?:window|document)\s*\./.test(text)) {
    failures.push(`${relative}: Config System 禁止依赖浏览器 DOM 全局。`);
  }
});

// AI Core 只能定义插件契约/Registry，禁止把厂商 ID、外部 Endpoint 或厂商分支塞进 Core。
const aiCoreVendorPattern = /(?:api\.openai\.com|api\.deepseek\.com|open\.bigmodel\.cn|api\.moonshot\.(?:cn|ai)|aliyuncs\.com|xiaomimimo\.com)/i;
walk("packages/settings/config-system/src/settings/ai/core", (relative, text) => {
  if (aiCoreVendorPattern.test(text)) {
    failures.push(`${relative}: AI Core 禁止包含厂商 Endpoint；请放入 providers/<provider>。`);
  }
  if (/\b(?:openai|deepseek|zhipu|kimi|qwen|xiaomi)\b\s*(?:===|==|:|\?)/i.test(text)) {
    failures.push(`${relative}: AI Core 禁止按厂商 ID 分支；请使用 Provider Registry/Plugin。`);
  }
});

// UI 只负责展示/交互。业务通过注入接口连接；不直连 Config/Provider/Host。
walk("packages/client/ui/src", (relative, text) => {
  for (const spec of imports(text)) {
    if (
      spec.startsWith("@lfaa/config-system") ||
      spec.startsWith("@lfaa/model-providers") ||
      spec.startsWith("@lfaa/account-manager") ||
      spec.startsWith("@lfaa/plugin-runtime") ||
      spec.startsWith("@lfaa/plugin-host-node") ||
      spec.startsWith("apps/") ||
      spec.startsWith("node:")
    ) {
      failures.push(`${relative}: UI 禁止直接依赖业务/宿主实现 ${spec}；请通过 Props/Controller/ViewModel 注入。`);
    }
  }
  if (/\bfetch\s*\(/.test(text) || /\bXMLHttpRequest\b/.test(text)) {
    failures.push(`${relative}: packages/client/ui 禁止直接发起网络请求；Provider/Host 请求必须在业务或 Adapter 层。`);
  }
});

// App 入口不能包含厂商外部 API 端点或 Provider 认证实现。
const providerEndpointPattern = /(?:api\.openai\.com|api\.deepseek\.com|open\.bigmodel\.cn|api\.moonshot\.cn|dashscope\.aliyuncs\.com|mimo\.mi\.com)/i;
walk("apps/web", (relative, text) => {
  if (providerEndpointPattern.test(text)) {
    failures.push(`${relative}: Web Host 禁止直接包含 Provider 外部 API 端点；厂商逻辑必须进入 config-system Provider 插件。`);
  }
});

// Foundation 契约必须保持纯净：Credential/Plugin SDK 不能拥有 Node/DOM/网络/包管理器。
for (const area of ["packages/credentials/credentials/src", "packages/plugin/plugin-sdk/src"]) {
  walk(area, (relative, text) => {
    for (const spec of imports(text)) {
      if (spec.startsWith("node:") || spec.startsWith("@lfaa/")) failures.push(`${relative}: foundation contract 禁止依赖实现 ${spec}。`);
    }
    if (/\b(?:window|document|fetch)\s*[.(]/.test(text)) failures.push(`${relative}: foundation contract 禁止绑定 DOM/网络运行时。`);
  });
}

// Plugin Runtime 只拥有生命周期与 Registry，禁止自己变成 Node/pnpm Host。
walk("packages/plugin/plugin-runtime/src", (relative, text) => {
  for (const spec of imports(text)) {
    if (spec.startsWith("node:") || spec === "@lfaa/plugin-host-node") failures.push(`${relative}: plugin-runtime 禁止依赖 Node Host 实现 ${spec}。`);
  }
  if (/\b(?:spawn|exec|pnpm)\s*\(/.test(text)) failures.push(`${relative}: plugin-runtime 禁止直接执行包管理器/子进程。`);
});

// Node Plugin Host 是底层 Adapter，不得反向依赖 React/App Shell/Config 业务。
walk("packages/plugin/plugin-host-node/src", (relative, text) => {
  for (const spec of imports(text)) {
    if (spec === "react" || spec.startsWith("@lfaa/ui") || spec.startsWith("@lfaa/app-shell") || spec.startsWith("@lfaa/config-system")) {
      failures.push(`${relative}: plugin-host-node 禁止反向依赖产品/UI ${spec}。`);
    }
  }
});

// Workspace 是 Chat / Work 的产品 Feature Composition；可以消费 Runtime/Domain/UI Kit，但不得反向依赖 App Shell 或宿主。
walk("packages/client/workspace/src", (relative, text) => {
  for (const spec of imports(text)) {
    if (spec.startsWith("@lfaa/app-shell") || spec.startsWith("@lfaa/web") || spec.startsWith("apps/") || spec.startsWith("node:")) {
      failures.push(`${relative}: workspace 禁止反向依赖产品外壳/宿主 ${spec}。`);
    }
  }
  if (/\bfetch\s*\(/.test(text) || /\bXMLHttpRequest\b/.test(text)) {
    failures.push(`${relative}: workspace 禁止直接访问 Provider/网络；应通过 Agent Runtime / Host Contract。`);
  }
});

// 业务 package 永远不能反向依赖 apps/*。这里检查所有 packages 源码。
walk("packages", (relative, text) => {
  for (const spec of imports(text)) {
    if (spec.startsWith("apps/") || spec.startsWith("@lfaa/web") || spec.startsWith("@lfaa/desktop")) {
      failures.push(`${relative}: packages 不得反向依赖 App 宿主 ${spec}。`);
    }
  }
});

if (failures.length > 0) {
  console.error("LFAA folder boundary check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("LFAA folder boundary check passed.");
