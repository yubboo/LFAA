// 内置目录的 CLI 条目：声明式动作复用模板，安装方式按 winget / choco / scoop / npm 依次尝试。
import type { CatalogEntry, CliActionConfig } from "../../contract";
import { CONNECTOR_TEMPLATES } from "../cli-templates";
import { cliEntry } from "./entry";

const templateActions = (id: string): CliActionConfig[] =>
  CONNECTOR_TEMPLATES.find((item) => item.id === id)?.connector.actions ?? [];

const gitActions: CliActionConfig[] = [
  { id: "status", title: "工作区状态", description: "列出改动与当前分支。", readOnly: true, argv: ["status", "--short", "--branch"], params: {} },
  { id: "log", title: "最近提交", description: "按提交时间倒序列出摘要。", readOnly: true, argv: ["log", "--oneline", "-n", "{{limit}}"], params: { limit: { type: "number", description: "条数（1–50）", default: 15 } } },
  { id: "diff_stat", title: "改动统计", description: "查看未提交改动的文件与行数。", readOnly: true, argv: ["diff", "--stat"], params: {} },
];

const rgActions: CliActionConfig[] = [
  { id: "search", title: "全文搜索", description: "在目录中按正则搜索文本。", readOnly: true, argv: ["--line-number", "--no-heading", "--color", "never", "{{pattern}}", "{{path}}"], params: { pattern: { type: "string", description: "正则或关键字", required: true }, path: { type: "string", description: "搜索目录", default: "." } } },
  { id: "files", title: "列出文件", description: "按 glob 列出匹配的文件路径。", readOnly: true, argv: ["--files", "--glob", "{{glob}}"], params: { glob: { type: "string", description: "glob 模式", default: "*" } } },
];

const jqActions: CliActionConfig[] = [
  { id: "query", title: "JSON 查询", description: "对 JSON 文件执行过滤表达式。", readOnly: true, argv: ["{{filter}}", "{{file}}"], params: { filter: { type: "string", description: "jq 表达式", required: true }, file: { type: "string", description: "JSON 文件路径", required: true } } },
];

const ffmpegActions: CliActionConfig[] = [
  { id: "version", title: "版本信息", description: "查看编解码器与版本。", readOnly: true, argv: ["-version"], params: {} },
  { id: "convert", title: "转码", description: "把输入文件转成目标格式。", readOnly: false, argv: ["-y", "-i", "{{input}}", "{{output}}"], params: { input: { type: "string", description: "输入文件", required: true }, output: { type: "string", description: "输出文件", required: true } }, timeoutMs: 300_000 },
];

const kubectlActions: CliActionConfig[] = [
  { id: "pods", title: "Pod 列表", description: "查看当前命名空间的 Pod。", readOnly: true, argv: ["get", "pods", "-o", "wide"], params: {} },
  { id: "describe", title: "资源详情", description: "描述指定资源。", readOnly: true, argv: ["describe", "{{kind}}", "{{name}}"], params: { kind: { type: "string", description: "资源类型", default: "pod" }, name: { type: "string", description: "资源名", required: true } } },
];

const azActions: CliActionConfig[] = [
  { id: "account", title: "当前账号", description: "查看已登录的订阅与租户。", readOnly: true, argv: ["account", "show", "--output", "json"], params: {} },
  { id: "groups", title: "资源组", description: "列出订阅下的资源组。", readOnly: true, argv: ["group", "list", "--output", "table"], params: {} },
];

const uvActions: CliActionConfig[] = [
  { id: "version", title: "版本信息", description: "查看 uv 版本。", readOnly: true, argv: ["--version"], params: {} },
  { id: "sync", title: "同步环境", description: "按 pyproject 同步依赖环境。", readOnly: false, argv: ["sync"], params: {}, timeoutMs: 300_000 },
];

export const CLI_CATALOG: CatalogEntry[] = [
  cliEntry({
    id: "git", name: "Git", glyph: "🌿", category: "dev", popular: true,
    description: "查看工作区状态、提交历史与改动统计。", executable: "git", actions: gitActions,
    installs: [{ manager: "winget", id: "Git.Git" }, { manager: "choco", id: "git" }, { manager: "scoop", id: "git" }],
    website: "https://git-scm.com",
    examples: ["看看当前分支有哪些未提交改动", "把最近五条提交按主题归类"],
  }),
  cliEntry({
    id: "gh", name: "GitHub CLI", glyph: "🐙", category: "dev", popular: true,
    description: "在命令行里查看 PR、议题与仓库信息。", executable: "gh", actions: templateActions("gh"),
    installs: [{ manager: "winget", id: "GitHub.cli" }, { manager: "choco", id: "gh" }, { manager: "scoop", id: "gh" }],
    publisher: "GitHub", website: "https://cli.github.com",
    examples: ["列出这个仓库里待评审的 PR", "看看某个 PR 的改动文件"],
  }),
  cliEntry({
    id: "pnpm", name: "pnpm", glyph: "📦", category: "dev",
    description: "查看依赖、检查过期包并运行脚本。", executable: "pnpm", actions: templateActions("pnpm"),
    installs: [{ manager: "npm", id: "pnpm" }, { manager: "winget", id: "pnpm.pnpm" }, { manager: "scoop", id: "pnpm" }],
    publisher: "pnpm", website: "https://pnpm.io",
    examples: ["列出哪些依赖有新版本", "运行项目的 lint 脚本"],
  }),
  cliEntry({
    id: "docker", name: "Docker", glyph: "🐳", category: "dev",
    description: "查看容器、镜像、日志并启动 compose 服务。", executable: "docker", actions: templateActions("docker"), probeArgs: ["info"],
    installs: [{ manager: "winget", id: "Docker.DockerDesktop" }, { manager: "choco", id: "docker-desktop" }],
    publisher: "Docker", website: "https://www.docker.com",
    examples: ["看看现在有哪些容器在跑", "把 compose 服务拉起来并查看日志"],
  }),
  cliEntry({
    id: "ripgrep", name: "ripgrep", glyph: "🔍", category: "dev",
    description: "在代码库里做高速正则搜索与文件枚举。", executable: "rg", actions: rgActions,
    installs: [{ manager: "winget", id: "BurntSushi.ripgrep.MSVC" }, { manager: "choco", id: "ripgrep" }, { manager: "scoop", id: "ripgrep" }],
    website: "https://github.com/BurntSushi/ripgrep",
    examples: ["在整个仓库里找出所有 TODO 注释", "搜索所有调用这个函数的位置"],
  }),
  cliEntry({
    id: "jq", name: "jq", glyph: "🧮", category: "dev",
    description: "过滤与格式化 JSON 文件，快速定位字段。", executable: "jq", actions: jqActions,
    installs: [{ manager: "winget", id: "jqlang.jq" }, { manager: "choco", id: "jq" }, { manager: "scoop", id: "jq" }],
    website: "https://jqlang.org",
    examples: ["把这份 JSON 里的依赖名全部提取出来", "统计这个数组里各状态的数量"],
  }),
  cliEntry({
    id: "ffmpeg", name: "FFmpeg", glyph: "🎞️", category: "system",
    description: "音视频转码、裁剪与格式转换。", executable: "ffmpeg", actions: ffmpegActions,
    installs: [{ manager: "winget", id: "Gyan.FFmpeg" }, { manager: "choco", id: "ffmpeg" }, { manager: "scoop", id: "ffmpeg" }],
    website: "https://ffmpeg.org",
    examples: ["把这段视频转成 720p 的 mp4", "提取这个视频的音轨"],
  }),
  cliEntry({
    id: "kubectl", name: "kubectl", glyph: "☸️", category: "dev",
    description: "查看集群里的 Pod、资源详情与事件。", executable: "kubectl", actions: kubectlActions, probeArgs: ["version", "--client"],
    installs: [{ manager: "winget", id: "Kubernetes.kubectl" }, { manager: "choco", id: "kubernetes-cli" }, { manager: "scoop", id: "kubectl" }],
    website: "https://kubernetes.io/docs/reference/kubectl",
    examples: ["看看 web 命名空间里有哪些 Pod", "描述这个重启频繁的 Pod"],
  }),
  cliEntry({
    id: "az", name: "Azure CLI", glyph: "☁️", category: "dev",
    description: "查看订阅、资源组与云资源状态。", executable: "az", actions: azActions,
    installs: [{ manager: "winget", id: "Microsoft.AzureCLI" }, { manager: "scoop", id: "azure-cli" }, { manager: "choco", id: "azure-cli" }],
    publisher: "Microsoft", website: "https://learn.microsoft.com/cli/azure",
    examples: ["看看当前登录的订阅", "列出所有资源组"],
  }),
  cliEntry({
    id: "uv", name: "uv", glyph: "🐍", category: "dev",
    description: "管理 Python 虚拟环境与依赖同步。", executable: "uv", actions: uvActions,
    installs: [{ manager: "winget", id: "astral-sh.uv" }, { manager: "scoop", id: "uv" }],
    website: "https://docs.astral.sh/uv",
    examples: ["同步这个项目的 Python 依赖", "看看 uv 的版本"],
  }),
];