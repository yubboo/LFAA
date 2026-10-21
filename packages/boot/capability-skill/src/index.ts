/**
 * 功能：将 GitHub 项目 Skill 安装适配到现有项目目录与文件 Owner。
 * 作用：固定提交、校验单个 Skill 文件树、仅写入当前选中项目并通过真实目录发现核验。
 * 关联文件：capability-installs、plugin-manager/github-source.ts、core/tools/project-tools.ts、host/project-files/project-files.mjs。
 */
import type { Context } from "@deepseek-ai/cordis";
import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import type { AiBusinessToolContext } from "lfaa-tools/src/business-tools.js";
import { projectFileTool } from "lfaa-tools/src/project-tools.js";
import type { CapabilityInstallAdapter, CapabilityInstallRegistry, CapabilityApplicationId } from "lfaa-capability-installs/src/index.js";
import { downloadGithubSnapshot, searchGithubRepositories } from "lfaa-plugin-manager/src/github-source.js";
import type { PluginArchiveFile } from "lfaa-plugin-manager/src/zip-archive.js";

const applications: CapabilityApplicationId[] = ["workspace", "minecraft"];
const skillIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const maximumSkillFiles = 128;
const maximumSkillBytes = 8 * 1024 * 1024;
const maximumSkillFileBytes = 2 * 1024 * 1024;

interface SkillDetails {
  repository: string;
  license: string | null;
  commit: string;
  archiveSha256: string;
  sourcePath: string;
  name: string;
  description: string;
  files: Array<{ path: string; sha256: string; bytes: number }>;
  runtimeAudit: {
    scriptFiles: string[];
    declaredNodeMajor: number | null;
    packageManifest: "absent" | "valid" | "invalid";
    dependencies: string[];
    devDependencies: string[];
    packageScriptNames: string[];
    riskSignals: SkillRuntimeRiskSignal[];
  };
  untrustedSkillMarkdown: string;
}

type SkillRuntimeRiskSignal = "background-process" | "browser-remote-debugging" | "arbitrary-page-script" | "local-file-access" | "user-profile-persistence";

const runtimeRiskSignals: Array<{ id: SkillRuntimeRiskSignal; pattern: RegExp }> = [
  { id: "background-process", pattern: /\bdetached\s*:\s*true\b|\.unref\s*\(/iu },
  { id: "browser-remote-debugging", pattern: /DevToolsActivePort|remote[- ]debugging|Chrome DevTools Protocol|\bCDP\b/iu },
  { id: "arbitrary-page-script", pattern: /\/eval(?:\?|["'\s]|$)|Runtime\.evaluate/iu },
  { id: "local-file-access", pattern: /\/setFiles(?:\?|["'\s]|$)|DOM\.setFileInputFiles|setFileInputFiles/iu },
  { id: "user-profile-persistence", pattern: /%USERPROFILE%|process\.env\.(?:HOME|USERPROFILE)|\.web-access\/|config\.env|site-patterns\//iu }
];

const runtimeRiskLabels: Record<SkillRuntimeRiskSignal, string> = {
  "background-process": "后台进程生命周期",
  "browser-remote-debugging": "浏览器远程调试/CDP",
  "arbitrary-page-script": "任意页面脚本执行接口",
  "local-file-access": "本机文件路径操作接口",
  "user-profile-persistence": "用户目录持久配置/数据"
};

export interface ProjectSkillAdapterDependencies {
  searchRepositories?: typeof searchGithubRepositories;
  downloadSnapshot?: typeof downloadGithubSnapshot;
  runProjectFile?: (input: Record<string, unknown>, context: AiBusinessToolContext) => Promise<unknown>;
}

export function createProjectSkillAdapter(dependencies: ProjectSkillAdapterDependencies = {}): CapabilityInstallAdapter {
  const search = dependencies.searchRepositories ?? searchGithubRepositories;
  const download = dependencies.downloadSnapshot ?? downloadGithubSnapshot;
  const runProjectFile = dependencies.runProjectFile ?? runExistingProjectFileTool;

  const adapter: CapabilityInstallAdapter = {
    kind: "skill",
    applicationIds: applications,
    targetSchema: {
      type: "object",
      properties: { sourcePath: { type: "string", minLength: 1, maxLength: 512 } },
      additionalProperties: false
    },
    targetDescription: "必须使用当前会话选中的真实项目；sourcePath 是 GitHub 仓库内 Skill 目录的相对路径，仓库根目录用 .；多 Skill 仓库需从检查结果中选择后重新检查。",
    validateTarget(target, applicationId, context) {
      if (!applications.includes(applicationId)) throw new Error("项目 Skill 仅接入 Workspace 与 Minecraft 项目会话。");
      const project = context.workspaceProject;
      if (!project || project.nodeId !== null && !isUuid(project.nodeId) || !isAbsolute(project.path) || !project.title.trim()) {
        throw new Error("安装项目 Skill 前，请先在当前会话选择真实项目；不会写入默认任务目录或其他项目。");
      }
      const input = target === undefined ? {} : asRecord(target, "Skill target");
      if (Object.keys(input).some(key => key !== "sourcePath")) throw new Error("Skill 只接受仓库内相对 sourcePath 作为类型目标。");
      const sourcePath = input.sourcePath === undefined ? undefined : normalizeSourcePath(input.sourcePath);
      return { nodeId: project.nodeId, path: project.path, title: safeText(project.title, 120), ...(sourcePath !== undefined ? { sourcePath } : {}) };
    },
    revalidateTarget(target, applicationId, context) {
      if (!applications.includes(applicationId)) throw new Error("项目 Skill 仅接入 Workspace 与 Minecraft 项目会话。");
      const project = currentProject(context);
      const allowedKeys = ["nodeId", "path", "title", "sourcePath"];
      if (Object.keys(target).some(key => !allowedKeys.includes(key))
        || target.nodeId !== project.nodeId || target.path !== project.path || target.title !== safeText(project.title, 120)) {
        throw new Error("检查时绑定的项目目标已变化。");
      }
      const sourcePath = target.sourcePath === undefined ? undefined : normalizeSourcePath(target.sourcePath, true);
      return { nodeId: project.nodeId, path: project.path, title: safeText(project.title, 120), ...(sourcePath !== undefined ? { sourcePath } : {}) };
    },
    targetSummary(target) { return `${safeText(String(target.title ?? "项目"), 120)} 项目`; },
    async search(query) {
      return { candidates: (await search(query)).map(item => ({ ...item, sourceType: "github", requiresInspection: true, warning: item.license ? "仓库搜索只是候选；检查只会选择并复制文本 Skill 文件，不运行仓库脚本。" : "来源许可证未确认；检查前需要先核对许可，仓库内容不会执行。" })) };
    },
    async inspect(source, ref, _applicationId, target) {
      const snapshot = await download(source, ref);
      const skillRoots = findSkillRoots(snapshot.files);
      const selectedPath = typeof target.sourcePath === "string" ? target.sourcePath : undefined;
      if (selectedPath === undefined && skillRoots.length > 1) throw new Error(`仓库包含多个 Skill；请从下列目录选择一个，并在 target.sourcePath 中指定后重新检查（仓库根目录用 .）：${skillRoots.map(path => path || ".").join("、")}`);
      const sourcePath = selectedPath ?? skillRoots[0];
      if (sourcePath === undefined || !skillRoots.includes(sourcePath)) throw new Error(selectedPath ? `仓库中未找到 ${selectedPath}/SKILL.md。` : "仓库快照中未发现 SKILL.md；没有创建安装凭证。");
      const selectedFiles = selectSkillFiles(snapshot.files, sourcePath);
      const skillFile = selectedFiles.find(file => file.path.toLocaleLowerCase("en-US") === `${sourcePath ? `${sourcePath}/` : ""}SKILL.md`.toLocaleLowerCase("en-US"));
      if (!skillFile) throw new Error("所选 Skill 缺少 SKILL.md；没有创建安装凭证。");
      const markdown = decodeSkillText(skillFile);
      const metadata = parseSkillMetadata(markdown, sourcePath || snapshot.repository.name);
      const files = selectedFiles.map(file => ({ path: relativeSkillPath(file.path, sourcePath), sha256: sha256(file.contents), bytes: file.contents.length }));
      const runtimeAudit = inspectSkillRuntime(selectedFiles, sourcePath);
      const details: SkillDetails = {
        repository: snapshot.repository.url,
        license: snapshot.repository.license,
        commit: snapshot.commit,
        archiveSha256: snapshot.archiveSha256,
        sourcePath,
        name: metadata.name,
        description: metadata.description,
        files,
        runtimeAudit,
        untrustedSkillMarkdown: markdown.slice(0, 8000)
      };
      return { resolvedRef: snapshot.commit, resolvedTarget: { sourcePath: sourcePath || "." }, summary: inspectionSummary(details), details: { skill: details } };
    },
    async install(source, resolvedRef, _applicationId, _userId, target, details, context) {
      const project = currentProject(context);
      if (project.nodeId !== target.nodeId || project.path !== target.path) throw new Error("当前会话项目与检查凭证绑定的项目不同；没有写入，请重新检查来源。");
      const plan = parseDetails(details, resolvedRef);
      if ((typeof target.sourcePath === "string" ? target.sourcePath : "") !== plan.sourcePath) throw new Error("Skill 目录与检查凭证中的选择不一致；没有写入。");
      const snapshot = await download(source, resolvedRef);
      if (snapshot.commit !== resolvedRef || snapshot.archiveSha256 !== plan.archiveSha256) throw new Error("固定提交的源码归档与检查结果摘要不一致；没有写入项目。");
      const selectedFiles = selectSkillFiles(snapshot.files, plan.sourcePath);
      const skillFile = selectedFiles.find(file => relativeSkillPath(file.path, plan.sourcePath).toLocaleLowerCase("en-US") === "skill.md");
      if (!skillFile || decodeSkillText(skillFile).length === 0) throw new Error("固定版本中的 SKILL.md 缺失或为空；没有写入。");
      const files = selectedFiles.map(file => ({ path: relativeSkillPath(file.path, plan.sourcePath), content: decodeSkillText(file) }));
      const ownerResult = await runProjectFile({ operation: "create_tree", path: `.agents/skills/${plan.name}`, files }, context);
      const created = unwrapProjectFileResult(ownerResult);
      if (!isRecord(created) || created.created !== true || !Array.isArray(created.files)) throw new Error("项目文件 Owner 未确认目录创建；请重新检查项目状态后再决定是否重试。");
      return { skill: plan.name, applicationId: context.applicationId, project: safeText(project.title, 120), source: { repository: plan.repository, commit: resolvedRef, archiveSha256: plan.archiveSha256, license: plan.license }, writtenFileCount: created.files.length };
    },
    async verifyInstalled(installation, _source, resolvedRef, applicationId, target, details, context) {
      const project = currentProject(context);
      const plan = parseDetails(details, resolvedRef);
      if (project.nodeId !== target.nodeId || project.path !== target.path || !isRecord(installation) || installation.skill !== plan.name || installation.applicationId !== context.applicationId || context.applicationId !== applicationId) {
        return { status: "unknown", verified: false, summary: "当前会话项目或安装结果与检查凭证不一致，无法确认 Skill 登记状态。" };
      }
      const skills = await adapter.list(applicationId, target, context);
      const expectedPath = `.agents/skills/${plan.name}/SKILL.md`;
      const registered = skills.some(item => isRecord(item) && item.name === plan.name
        && typeof item.path === "string" && item.path.replaceAll("\\", "/") === expectedPath);
      if (!registered) return { status: "unknown", verified: false, summary: "项目文件 Owner 未在当前项目发现刚安装的 Skill；先查询能力清单，不要重放安装。" };
      return {
        status: "ready",
        verified: true,
        summary: `项目文件 Owner 已在“${safeText(project.title, 120)}”发现 ${plan.name}；SKILL.md 可按需加载。此状态只确认 Skill 已发现，不代表附带脚本、依赖或外部服务已运行。`,
        details: {
          skill: plan.name,
          path: expectedPath,
          project: safeText(project.title, 120),
          state: "installed-and-discovered",
          fileCount: plan.files.length,
          scriptFiles: plan.runtimeAudit.scriptFiles,
          declaredNodeMajor: plan.runtimeAudit.declaredNodeMajor,
          packageManifest: plan.runtimeAudit.packageManifest,
          dependencies: plan.runtimeAudit.dependencies,
          devDependencies: plan.runtimeAudit.devDependencies,
          packageScriptNames: plan.runtimeAudit.packageScriptNames,
          riskSignals: plan.runtimeAudit.riskSignals,
          scriptsExecuted: false,
          dependenciesInstalled: false,
          externalRuntimeVerified: false
        }
      };
    },
    async list(_applicationId, target, context) {
      const project = currentProject(context);
      if (project.nodeId !== target.nodeId || project.path !== target.path) throw new Error("清单目标与当前会话项目不一致。");
      const result = unwrapProjectFileResult(await runProjectFile({ operation: "discover_skills", path: "." }, context));
      return isRecord(result) && Array.isArray(result.skills) ? result.skills : [];
    }
  };
  return adapter;
}

function currentProject(context: AiBusinessToolContext): { nodeId: string | null; path: string; title: string } {
  const project = context.workspaceProject;
  if (!project || project.nodeId !== null && !isUuid(project.nodeId) || !isAbsolute(project.path)) throw new Error("当前会话没有可验证的项目目标。");
  return { nodeId: project.nodeId, path: project.path, title: project.title };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function findSkillRoots(files: PluginArchiveFile[]): string[] {
  return files.flatMap(file => file.path.split("/").at(-1)?.toLocaleLowerCase("en-US") === "skill.md" ? [file.path.slice(0, file.path.lastIndexOf("/") + 1).replace(/\/$/u, "")] : []).sort((a, b) => a.localeCompare(b));
}

function selectSkillFiles(files: PluginArchiveFile[], sourcePath: string): PluginArchiveFile[] {
  const prefix = sourcePath ? `${sourcePath}/` : "";
  const selected = files.filter(file => !prefix || file.path.startsWith(prefix));
  if (!selected.length || selected.length > maximumSkillFiles) throw new Error(`所选 Skill 文件数量必须为 1–${maximumSkillFiles}。`);
  let total = 0;
  for (const file of selected) {
    const relative = relativeSkillPath(file.path, sourcePath);
    if (!relative || relative.length > 512 || file.contents.length > maximumSkillFileBytes || file.contents.includes(0)) throw new Error(`Skill 包含不受支持或过大的文件：${relative || file.path}`);
    total += file.contents.length;
    if (total > maximumSkillBytes) throw new Error("Skill 文本文件总大小超过 8 MiB；没有安装。");
  }
  return selected.sort((a, b) => a.path.localeCompare(b.path));
}

function inspectSkillRuntime(files: PluginArchiveFile[], sourcePath: string): SkillDetails["runtimeAudit"] {
  const relativeFiles = files.map(file => ({ file, path: relativeSkillPath(file.path, sourcePath) }));
  const content = relativeFiles.map(({ file }) => decodeSkillText(file)).join("\n");
  const riskSignals = runtimeRiskSignals.filter(({ pattern }) => pattern.test(content)).map(({ id }) => id);
  const textualNodeMajors = [...content.matchAll(/\bNode(?:\.js)?\s+(?:v)?(\d+)\s*\+/giu)].map(match => Number(match[1]));
  const scriptFiles = relativeFiles
    .filter(({ path }) => /\.(?:[cm]?js|[cm]?ts|jsx|tsx|sh|bash|ps1|bat|cmd|py|rb|pl|php)$/iu.test(path))
    .map(({ path }) => path)
    .slice(0, 128);
  const manifest = relativeFiles.find(({ path }) => path.toLocaleLowerCase("en-US") === "package.json")?.file;
  if (!manifest) return { scriptFiles, declaredNodeMajor: textualNodeMajors.length ? Math.max(...textualNodeMajors) : null, packageManifest: "absent", dependencies: [], devDependencies: [], packageScriptNames: [], riskSignals };
  try {
    const value: unknown = JSON.parse(decodeSkillText(manifest));
    if (!isRecord(value)) throw new Error("package.json root is not an object");
    const keys = (field: string): string[] => isRecord(value[field]) ? Object.keys(value[field] as Record<string, unknown>).map(name => safeText(name, 120)).filter(Boolean).slice(0, 64) : [];
    const engineNode = isRecord(value.engines) && typeof value.engines.node === "string" ? value.engines.node : "";
    const engineMinimum = engineNode.match(/(?:^|>=|>|~|\^|=)\s*v?(\d+)/u);
    const declaredNodeMajor = Math.max(...textualNodeMajors, ...(engineMinimum ? [Number(engineMinimum[1])] : []));
    return {
      scriptFiles,
      declaredNodeMajor: Number.isFinite(declaredNodeMajor) ? declaredNodeMajor : null,
      packageManifest: "valid",
      dependencies: keys("dependencies"),
      devDependencies: keys("devDependencies"),
      packageScriptNames: keys("scripts"),
      riskSignals
    };
  } catch {
    return { scriptFiles, declaredNodeMajor: textualNodeMajors.length ? Math.max(...textualNodeMajors) : null, packageManifest: "invalid", dependencies: [], devDependencies: [], packageScriptNames: [], riskSignals };
  }
}

function inspectionSummary(details: SkillDetails): string {
  const parts = [details.name, details.description || "项目 Skill", `许可证 ${details.license ?? "未声明"}`];
  if (details.runtimeAudit.declaredNodeMajor !== null) parts.splice(1, 0, `来源声明最低 Node.js ${details.runtimeAudit.declaredNodeMajor}+`);
  if (details.runtimeAudit.riskSignals.length) parts.splice(1, 0, `静态线索（未执行，需核验）：${details.runtimeAudit.riskSignals.map(signal => runtimeRiskLabels[signal]).join("、")}`);
  if (details.runtimeAudit.scriptFiles.length) parts.push(`含 ${details.runtimeAudit.scriptFiles.length} 个脚本文件，安装只复制文本，不执行`);
  if (details.runtimeAudit.packageManifest === "valid") {
    const dependencyCount = details.runtimeAudit.dependencies.length + details.runtimeAudit.devDependencies.length;
    parts.push(`package.json 已静态读取 ${dependencyCount} 个依赖项，未安装`);
  } else if (details.runtimeAudit.packageManifest === "invalid") {
    parts.push("package.json 无法解析，运行依赖未确认");
  }
  return parts.join(" · ").slice(0, 500);
}

function relativeSkillPath(path: string, sourcePath: string): string {
  const prefix = sourcePath ? `${sourcePath}/` : "";
  if (!path.startsWith(prefix)) throw new Error("Skill 文件超出检查时选定的目录。");
  return path.slice(prefix.length);
}

function decodeSkillText(file: PluginArchiveFile): string {
  if (file.contents.length > maximumSkillFileBytes || file.contents.includes(0)) throw new Error(`Skill 只支持每个不超过 2 MiB 的 UTF-8 文本文件：${file.path}`);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(file.contents); }
  catch { throw new Error(`Skill 包含非 UTF-8 文件：${file.path}；当前项目文件 Owner 只接受 UTF-8 文本。`); }
}

function parseSkillMetadata(markdown: string, fallbackName: string): { name: string; description: string } {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u)?.[1] ?? "";
  const rawName = frontmatter.match(/^name:\s*["']?([^"'\r\n#]+?)["']?\s*$/mu)?.[1]?.trim() ?? fallbackName.split("/").at(-1) ?? "";
  if (!skillIdPattern.test(rawName)) throw new Error("Skill 名称必须是 1–64 位字母、数字、点、下划线或短横线；没有创建安装凭证。");
  const description = frontmatter.match(/^description:\s*["']?([^"'\r\n#]+?)["']?\s*$/mu)?.[1]?.trim() ?? "";
  return { name: rawName, description: safeText(description, 500) };
}

function normalizeSourcePath(value: unknown, allowRoot = false): string {
  if (value === "." || allowRoot && value === "") return "";
  if (typeof value !== "string" || !value.trim() || value.length > 512 || value.startsWith("/") || value.includes("\\")) throw new Error("sourcePath 必须是仓库内的 Skill 相对目录路径。");
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) throw new Error("sourcePath 包含无效或越界路径段。");
  return parts.join("/");
}

function parseDetails(value: unknown, resolvedRef: string): SkillDetails {
  if (!isRecord(value) || !isRecord(value.skill)) throw new Error("安装检查详情无效；没有写入。");
  const plan = value.skill as unknown as SkillDetails;
  if (plan.commit !== resolvedRef || !/^[a-f0-9]{40}$/iu.test(resolvedRef) || typeof plan.repository !== "string" || !(typeof plan.license === "string" || plan.license === null) || typeof plan.archiveSha256 !== "string" || !/^[a-f0-9]{64}$/iu.test(plan.archiveSha256) || typeof plan.sourcePath !== "string" || typeof plan.name !== "string" || !skillIdPattern.test(plan.name)) throw new Error("安装检查详情与固定来源不匹配；没有写入。");
  return plan;
}

function unwrapProjectFileResult(value: unknown): unknown { return isRecord(value) && "result" in value ? value.result : value; }
function asRecord(value: unknown, name: string): Record<string, unknown> { if (!isRecord(value)) throw new Error(`${name} 必须是 JSON 对象。`); return value; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function safeText(value: string, limit: number): string { return value.replace(/[\r\n\0]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, limit); }
function sha256(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }

async function runExistingProjectFileTool(input: Record<string, unknown>, context: AiBusinessToolContext): Promise<unknown> {
  const prepared = projectFileTool.prepare?.(input, context);
  if (!prepared) throw new Error("项目文件 Owner 缺少目标解析器。");
  return projectFileTool.execute(prepared, context);
}

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaCapabilityInstalls: CapabilityInstallRegistry }
}

export const name = "lfaaCapabilitySkill";
export const inject = ["lfaaCapabilityInstalls"];
export function apply(ctx: Context): void {
  ctx.lfaaCapabilityInstalls.register(ctx, createProjectSkillAdapter());
}
