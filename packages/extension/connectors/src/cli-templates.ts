// 三个内置 CLI 连接器模板（gh / docker / pnpm）：只预填可执行文件、动作与参数 schema，不安装二进制、不写入密钥。
import type { ConnectorTemplate } from "../contract";

export const CONNECTOR_TEMPLATES: readonly ConnectorTemplate[] = [
  {
    id: "gh",
    name: "GitHub CLI",
    description: "用 gh 查询 GitHub 仓库、Pull Request 与 Issue。",
    connector: {
      id: "gh",
      name: "GitHub CLI",
      description: "用 gh 查询 GitHub 仓库、Pull Request 与 Issue。",
      enabled: true,
      projectId: null,
      trust: "ask",
      executable: "gh",
      cwd: "",
      env: { GH_TOKEN: "${env:GH_TOKEN}" },
      probeArgs: ["--version"],
      actions: [
        {
          id: "pr_list",
          title: "列出 Pull Request",
          description: "列出当前仓库的 PR，默认只看开启状态。",
          readOnly: true,
          argv: ["pr", "list", "--json", "number,title,author,state,url", "--limit", "{{limit}}", { arg: "--state", value: "{{state}}" }],
          params: {
            limit: { type: "number", description: "最多返回条数（1–100）", default: 20 },
            state: { type: "string", description: "PR 状态", enum: ["open", "closed", "merged", "all"], default: "open" },
          },
        },
        {
          id: "pr_view",
          title: "查看 Pull Request",
          description: "查看单个 PR 的标题、状态、正文与链接。",
          readOnly: true,
          argv: ["pr", "view", "{{number}}", "--json", "number,title,state,body,url,author"],
          params: { number: { type: "number", description: "PR 编号", required: true } },
        },
        {
          id: "issue_list",
          title: "列出 Issue",
          description: "列出当前仓库的 Issue。",
          readOnly: true,
          argv: ["issue", "list", "--json", "number,title,state,labels,url", "--limit", "{{limit}}"],
          params: { limit: { type: "number", description: "最多返回条数", default: 20 } },
        },
        {
          id: "repo_view",
          title: "查看仓库信息",
          description: "查看当前仓库的名称、描述、Star 数与主语言。",
          readOnly: true,
          argv: ["repo", "view", "--json", "nameWithOwner,description,url,stargazerCount,primaryLanguage"],
          params: {},
        },
      ],
    },
  },
  {
    id: "docker",
    name: "Docker",
    description: "查看容器与镜像，必要时启动 compose 服务。",
    connector: {
      id: "docker",
      name: "Docker",
      description: "查看容器与镜像，必要时启动 compose 服务。",
      enabled: true,
      projectId: null,
      trust: "ask",
      executable: "docker",
      cwd: "",
      env: {},
      probeArgs: ["--version"],
      actions: [
        {
          id: "ps",
          title: "列出容器",
          description: "列出当前运行中的容器。",
          readOnly: true,
          argv: ["ps"],
          params: {},
        },
        {
          id: "images",
          title: "列出镜像",
          description: "列出本机镜像。",
          readOnly: true,
          argv: ["images"],
          params: {},
        },
        {
          id: "logs",
          title: "查看容器日志",
          description: "读取容器末尾若干行日志。",
          readOnly: true,
          argv: ["logs", "--tail", "{{tail}}", "{{container}}"],
          params: {
            container: { type: "string", description: "容器名或 ID", required: true },
            tail: { type: "number", description: "末尾行数", default: 200 },
          },
        },
        {
          id: "compose_up",
          title: "启动 compose 服务",
          description: "在后台启动当前目录的 compose 服务，属于写操作。",
          readOnly: false,
          argv: ["compose", "up", "-d"],
          params: {},
        },
      ],
    },
  },
  {
    id: "pnpm",
    name: "pnpm",
    description: "查询依赖状态并运行 package.json 脚本。",
    connector: {
      id: "pnpm",
      name: "pnpm",
      description: "查询依赖状态并运行 package.json 脚本。",
      enabled: true,
      projectId: null,
      trust: "ask",
      executable: "pnpm",
      cwd: "",
      env: {},
      probeArgs: ["--version"],
      actions: [
        {
          id: "list",
          title: "列出已安装依赖",
          description: "列出顶层依赖。",
          readOnly: true,
          argv: ["list", "--depth", "0"],
          params: {},
        },
        {
          id: "outdated",
          title: "检查过期依赖",
          description: "列出可升级的依赖。",
          readOnly: true,
          argv: ["outdated"],
          params: {},
        },
        {
          id: "run_script",
          title: "运行脚本",
          description: "运行 package.json 中声明的脚本。",
          readOnly: false,
          argv: ["run", "{{script}}"],
          params: { script: { type: "string", description: "package.json 中的脚本名", required: true } },
        },
      ],
    },
  },
];

/** 按 id 取模板；未知模板返回 undefined。 */
export function findTemplate(id: string): ConnectorTemplate | undefined {
  return CONNECTOR_TEMPLATES.find((template) => template.id === id);
}