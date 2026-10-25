/**
 * 功能：将固定 GitHub 来源的 Skill 安装到 LFAA 当前账户共享资料库。
 * 作用：校验完整文件树、精确回读账户记录，并由现有 Skill Registry 跨项目/App 发现。
 * 关联文件：capability-installs、knowledge-library、skill Registry、plugin-manager/github-source.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { createHash } from "node:crypto";
import type { CapabilityInstallAdapter, CapabilityInstallRegistry, CapabilityApplicationId } from "lfaa-capability-installs/src/index.js";
import { downloadGithubSnapshot, searchGithubRepositories } from "lfaa-plugin-manager/src/github-source.js";
import type { PluginArchiveFile } from "lfaa-plugin-manager/src/zip-archive.js";
import { createKnowledgeLibrarySkillInstallation, deleteKnowledgeLibrarySkillInstallation, getKnowledgeLibrarySkillInstallation, listKnowledgeLibrarySkillInstallations, type KnowledgeLibrarySkillFileInput } from "lfaa-knowledge-library/src/index.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { isSkillDisabled, type SkillRegistry } from "lfaa-skill/src/index.js";

const applications: CapabilityApplicationId[] = [...APPLICATION_IDS];
const skillIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const maximumSkillFiles = 128;
// Base64 expansion must remain below the existing 8 MiB Project Files task envelope.
const maximumSkillBytes = 5 * 1024 * 1024;
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

export interface AccountSkillAdapterDependencies {
  searchRepositories?: typeof searchGithubRepositories;
  downloadSnapshot?: typeof downloadGithubSnapshot;
  invalidateSkills?: () => void;
  skillRegistry?: Pick<SkillRegistry, "list" | "get">;
}

export function createAccountSkillAdapter(dependencies: AccountSkillAdapterDependencies = {}): CapabilityInstallAdapter {
  const search = dependencies.searchRepositories ?? searchGithubRepositories;
  const download = dependencies.downloadSnapshot ?? downloadGithubSnapshot;

  const adapter: CapabilityInstallAdapter = {
    kind: "skill",
    applicationIds: applications,
    targetSchema: {
      type: "object",
      properties: { sourcePath: { type: "string", minLength: 1, maxLength: 512 } },
      additionalProperties: false
    },
    targetDescription: "安装到当前 LFAA 账户的共享 Skill 库，可供所有项目与 App 使用；sourcePath 是 GitHub 仓库内 Skill 目录的相对路径，仓库根目录用 .；多 Skill 仓库需从检查结果中选择后重新检查。",
    validateTarget(target, applicationId) {
      if (!applications.includes(applicationId)) throw new Error("当前 LFAA App 不支持共享 Skill 安装。");
      const input = target === undefined ? {} : asRecord(target, "Skill target");
      if (Object.keys(input).some(key => key !== "sourcePath")) throw new Error("Skill 只接受仓库内相对 sourcePath 作为类型目标。");
      const sourcePath = input.sourcePath === undefined ? undefined : normalizeSourcePath(input.sourcePath);
      return sourcePath !== undefined ? { sourcePath } : {};
    },
    revalidateTarget(target, applicationId) {
      if (!applications.includes(applicationId)) throw new Error("当前 LFAA App 不支持共享 Skill 安装。");
      if (Object.keys(target).some(key => key !== "sourcePath")) throw new Error("Skill 安装目标超出当前账户的共享范围。");
      const sourcePath = target.sourcePath === undefined ? undefined : normalizeSourcePath(target.sourcePath, true);
      return sourcePath !== undefined ? { sourcePath } : {};
    },
    targetSummary() { return "当前 LFAA 账户 · 所有项目与 App 的共享 Skill 库"; },
    async search(query) {
      return { candidates: (await search(query)).map(item => ({ ...item, sourceType: "github", requiresInspection: true, warning: item.license ? "仓库搜索只是候选；检查只会选择并复制文本 Skill 文件，不运行仓库脚本。" : "来源许可证未确认；检查前需要先核对许可，仓库内容不会执行。" })) };
    },
    async inspect(source, ref, _applicationId, target, context) {
      const snapshot = await download(source, ref, context.signal);
      context.signal.throwIfAborted();
      const skillRoots = findSkillRoots(snapshot.files);
      const selectedPath = typeof target.sourcePath === "string" ? target.sourcePath : undefined;
      if (selectedPath === undefined && skillRoots.length > 1) throw new Error(`仓库包含多个 Skill；请从下列目录选择一个，并在 target.sourcePath 中指定后重新检查（仓库根目录用 .）：${skillRoots.map(path => path || ".").join("、")}`);
      const sourcePath = selectedPath ?? skillRoots[0];
      if (sourcePath === undefined || !skillRoots.includes(sourcePath)) throw new Error(selectedPath ? `仓库中未找到 ${selectedPath}/SKILL.md。` : "仓库快照中未发现 SKILL.md；没有创建安装凭证。");
      const selectedFiles = selectSkillFiles(snapshot.files, sourcePath);
      const skillFile = selectedFiles.find(file => file.path.toLocaleLowerCase("en-US") === `${sourcePath ? `${sourcePath}/` : ""}SKILL.md`.toLocaleLowerCase("en-US"));
      if (!skillFile) throw new Error("所选 Skill 缺少 SKILL.md；没有创建安装凭证。");
      const markdown = decodeSkillText(skillFile);
      const metadata = parseSkillMetadata(markdown, sourcePath);
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
      context.signal.throwIfAborted();
      const plan = parseDetails(details, resolvedRef);
      if ((typeof target.sourcePath === "string" ? target.sourcePath : "") !== plan.sourcePath) throw new Error("Skill 目录与检查凭证中的选择不一致；没有写入。");
      const snapshot = await download(source, resolvedRef, context.signal);
      context.signal.throwIfAborted();
      if (snapshot.commit !== resolvedRef || snapshot.archiveSha256 !== plan.archiveSha256) throw new Error("固定提交的源码归档与检查结果摘要不一致；没有写入账户 Skill 库。");
      const selectedFiles = selectSkillFiles(snapshot.files, plan.sourcePath);
      const skillFile = selectedFiles.find(file => relativeSkillPath(file.path, plan.sourcePath).toLocaleLowerCase("en-US") === "skill.md");
      if (!skillFile || decodeSkillText(skillFile).length === 0) throw new Error("固定版本中的 SKILL.md 缺失或为空；没有写入账户 Skill 库。");
      const files: KnowledgeLibrarySkillFileInput[] = selectedFiles.map(file => ({
        path: relativeSkillPath(file.path, plan.sourcePath),
        content: file.contents.toString("base64"),
        encoding: "base64"
      }));
      context.signal.throwIfAborted();
      const installed = createKnowledgeLibrarySkillInstallation(context.userId, {
        name: plan.name,
        description: plan.description,
        source: { repositoryUrl: plan.repository, commit: resolvedRef, archiveSha256: plan.archiveSha256, sourcePath: plan.sourcePath, license: plan.license },
        files
      });
      dependencies.invalidateSkills?.();
      return {
        skill: installed.name, installationId: installed.id, applicationId: "all", accountId: context.userId,
        source: { repository: installed.repositoryUrl, commit: installed.commit, archiveSha256: installed.archiveSha256, license: installed.license },
        fileCount: installed.fileCount, totalBytes: installed.totalBytes
      };
    },
    async verifyInstalled(installation, _source, resolvedRef, applicationId, target, details, context) {
      const plan = parseDetails(details, resolvedRef);
      if (!isRecord(installation) || installation.skill !== plan.name || installation.applicationId !== "all"
        || installation.accountId !== context.userId || context.applicationId !== applicationId
        || typeof installation.installationId !== "string") {
        return { status: "unknown", verified: false, summary: "账户 Skill Owner 返回的安装记录与检查凭证不一致，无法确认登记状态。" };
      }
      const stored = getKnowledgeLibrarySkillInstallation(context.userId, installation.installationId);
      if (!stored || stored.name !== plan.name || stored.commit !== resolvedRef || stored.repositoryUrl !== plan.repository || stored.archiveSha256 !== plan.archiveSha256) {
        return { status: "unknown", verified: false, summary: "账户 Skill Owner 未能按账户和精确记录 ID 回读固定来源与 Skill 正文；未报告可用。" };
      }
      const list = await adapter.list(applicationId, target, context);
      if (!list.some(item => isRecord(item) && item.id === stored.id && item.name === plan.name)) {
        return { status: "unknown", verified: false, summary: "LFAA 共享 Skill 清单未发现刚安装的精确记录；请先查询清单，不要盲目重放安装。" };
      }
      if (!dependencies.skillRegistry) {
        return { status: "installed", verified: true, summary: "账户 Skill Owner 已回读固定来源、完整文件清单和正文；Registry 当前回合尚未提供可核对的加载结果。" };
      }
      const cwd = context.workspaceProject?.path;
      const lookup = { userId: context.userId, ...(cwd ? { cwd } : {}) };
      const summaries = await dependencies.skillRegistry.list(lookup);
      const winner = summaries.find(item => item.name === plan.name);
      if (winner?.provider !== "lfaa-knowledge-library-skills") {
        return { status: "installed", verified: true, summary: "Skill 已安装到当前账户的共享库，但当前上下文中存在更高优先级的同名 Skill；不会覆盖它。" };
      }
      // 保存到账户资料库不等于进入模型运行时：账户扩展总开关与单项停用都归 Settings Owner，
      // 关闭时 lfaa_skill_list/lfaa_skill_load 不会返回该 Skill，不能报告 ready。
      const settings = getUserSettings(context.userId);
      const disabledBySettings = isSkillDisabled(plan.name, settings.plugins.disabledSkillNames);
      if (!settings.plugins.enabled || disabledBySettings) {
        return {
          status: "installed",
          verified: true,
          summary: !settings.plugins.enabled
            ? "Skill 已保存到当前账户的共享库，并可由 Skill Registry 回读；但 AI Work 扩展总开关当前关闭，模型 Skill 目录不会提供它。按用户目标与当前权限开启扩展后再按需加载，不能报告为当前可用。"
            : "Skill 已保存到当前账户的共享库，但在设置中心的 Skill 停用名单中；当前不会进入模型 Skill 目录，不能报告为当前可用。",
          details: {
            skill: plan.name, installationId: stored.id, applicationId: "all", accountId: context.userId,
            runtimeEnabled: false, gate: !settings.plugins.enabled ? "plugins.enabled" : "plugins.disabledSkillNames",
            contentSha256: stored.contentSha256, files: stored.files, state: "account-installed-runtime-gated"
          }
        };
      }
      const definition = await dependencies.skillRegistry.get(plan.name, lookup);
      if (!definition || definition.provider !== "lfaa-knowledge-library-skills" || !definition.content.trim()) {
        return { status: "unknown", verified: false, summary: "Registry 已列出共享 Skill，但无法回读可加载正文；未报告 ready。" };
      }
      return {
        status: "ready",
        verified: true,
        summary: "LFAA 当前账户的共享 Skill Owner 已保存并由 Registry 回读 " + plan.name + "；所有项目与 App 均可按需发现。附属脚本不执行，依赖或外部运行时仍需按用户目标另行处理。",
        details: {
          skill: plan.name, installationId: stored.id, applicationId: "all", accountId: context.userId,
          contentSha256: stored.contentSha256, files: stored.files, state: "account-installed-and-registry-loaded",
          scriptFiles: plan.runtimeAudit.scriptFiles, declaredNodeMajor: plan.runtimeAudit.declaredNodeMajor,
          packageManifest: plan.runtimeAudit.packageManifest, dependencies: plan.runtimeAudit.dependencies,
          devDependencies: plan.runtimeAudit.devDependencies, packageScriptNames: plan.runtimeAudit.packageScriptNames,
          riskSignals: plan.runtimeAudit.riskSignals, scriptsExecuted: false, dependenciesInstalled: false, externalRuntimeVerified: false
        }
      };
    },
    async list(_applicationId, _target, context) {
      return listKnowledgeLibrarySkillInstallations(context.userId);
    },
    async remove(id, _applicationId, _target, context) {
      const removed = deleteKnowledgeLibrarySkillInstallation(context.userId, id);
      if (removed) dependencies.invalidateSkills?.();
      return { removed, installationId: id, accountId: context.userId, applicationId: "all", exact: true };
    }
  };
  return adapter;
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
    if (!relative || relative.length > 512 || file.contents.length > maximumSkillFileBytes || !isSafeSkillRelativePath(relative)) throw new Error(`Skill 包含不安全或过大的文件：${relative || file.path}`);
    total += file.contents.length;
    if (total > maximumSkillBytes) throw new Error("Skill 文件总大小超过 5 MiB 安全限制；没有安装。");
  }
  return selected.sort((a, b) => a.path.localeCompare(b.path));
}

function inspectSkillRuntime(files: PluginArchiveFile[], sourcePath: string): SkillDetails["runtimeAudit"] {
  const relativeFiles = files.map(file => ({ file, path: relativeSkillPath(file.path, sourcePath) }));
  const content = relativeFiles.map(({ file }) => tryDecodeSkillText(file) ?? "").join("\n");
  const riskSignals = runtimeRiskSignals.filter(({ pattern }) => pattern.test(content)).map(({ id }) => id);
  const textualNodeMajors = [...content.matchAll(/\bNode(?:\.js)?\s+(?:v)?(\d+)\s*\+/giu)].map(match => Number(match[1]));
  const scriptFiles = relativeFiles
    .filter(({ path }) => /\.(?:[cm]?js|[cm]?ts|jsx|tsx|sh|bash|ps1|bat|cmd|py|rb|pl|php)$/iu.test(path))
    .map(({ path }) => path)
    .slice(0, 128);
  const manifest = relativeFiles.find(({ path }) => path.toLocaleLowerCase("en-US") === "package.json")?.file;
  if (!manifest) return { scriptFiles, declaredNodeMajor: textualNodeMajors.length ? Math.max(...textualNodeMajors) : null, packageManifest: "absent", dependencies: [], devDependencies: [], packageScriptNames: [], riskSignals };
  try {
    const manifestText = tryDecodeSkillText(manifest);
    if (manifestText === null) throw new Error("package.json is binary");
    const value: unknown = JSON.parse(manifestText);
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
  if (file.contents.length > maximumSkillFileBytes) throw new Error(`Skill 文件超过 2 MiB：${file.path}`);
  const value = tryDecodeSkillText(file);
  if (value === null) throw new Error(`SKILL.md 必须是 UTF-8 文本：${file.path}`);
  return value;
}

function tryDecodeSkillText(file: PluginArchiveFile): string | null {
  if (file.contents.length > maximumSkillFileBytes || file.contents.includes(0)) return null;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(file.contents); }
  catch { return null; }
}

function parseSkillMetadata(markdown: string, sourcePath: string): { name: string; description: string } {
  const block = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u)?.[1];
  if (block === undefined) throw new Error("SKILL.md 缺少 YAML frontmatter；必须包含 name 和 description。");
  const lines = block.split(/\r?\n/u);
  let name: string | undefined;
  let description: string | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/u);
    if (!match) continue;
    const key = match[1].toLocaleLowerCase("en-US");
    if (key !== "name" && key !== "description") continue;
    if ((key === "name" ? name : description) !== undefined) throw new Error(`SKILL.md 的 ${key} 字段重复。`);
    let value = (match[2] ?? "").trim();
    if (key === "description" && (value === ">" || value === "|" || value === ">-" || value === "|-" || value === ">+" || value === "|+")) {
      const blockLines: string[] = [];
      for (let next = index + 1; next < lines.length && /^(?:\s+|\s*$)/u.test(lines[next]); next += 1) {
        blockLines.push(lines[next].trim());
        index = next;
      }
      value = value.startsWith(">") ? blockLines.filter(Boolean).join(" ") : blockLines.join("\n");
    } else {
      value = parseFrontmatterScalar(value, key);
    }
    if (key === "name") name = value;
    else description = value;
  }
  const expectedDirectoryName = sourcePath.split("/").at(-1);
  if (!name || name.length > 64 || !skillIdPattern.test(name) || expectedDirectoryName && name !== expectedDirectoryName) {
    throw new Error("Skill 的 name 必须是 1–64 位小写字母、数字和单个短横线，并与 Skill 目录名一致；没有创建安装凭证。");
  }
  if (!description?.trim() || description.length > 1024) throw new Error("Skill 的 description 必须是 1–1024 个字符；没有创建安装凭证。");
  return { name, description: description.trim() };
}

function parseFrontmatterScalar(value: string, field: string): string {
  const withoutComment = value.replace(/\s+#.*$/u, "").trim();
  if (!withoutComment) return "";
  if (withoutComment.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(withoutComment);
      if (typeof parsed !== "string") throw new Error("not string");
      return parsed;
    } catch { throw new Error(`SKILL.md 的 ${field} 字段不是有效的双引号 YAML 字符串。`); }
  }
  if (withoutComment.startsWith("'")) {
    if (!withoutComment.endsWith("'") || withoutComment.length < 2) throw new Error(`SKILL.md 的 ${field} 字段不是有效的单引号 YAML 字符串。`);
    return withoutComment.slice(1, -1).replace(/''/gu, "'");
  }
  if (/^[\[{|>&*!]/u.test(withoutComment)) throw new Error(`SKILL.md 的 ${field} 字段使用了当前安装器不支持的 YAML 类型。`);
  return withoutComment;
}

function isSafeSkillRelativePath(path: string): boolean {
  const parts = path.replaceAll("\\", "/").split("/");
  return parts.every(part => part.length > 0 && part !== "." && part !== ".." && !/[<>:"|?*\0]/u.test(part)
    && !/[ .]$/u.test(part) && /^[\p{L}\p{N}\p{M}._ -]+$/u.test(part)
    && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(part));
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

function asRecord(value: unknown, name: string): Record<string, unknown> { if (!isRecord(value)) throw new Error(`${name} 必须是 JSON 对象。`); return value; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function safeText(value: string, limit: number): string { return value.replace(/[\r\n\0]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, limit); }
function sha256(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaCapabilityInstalls: CapabilityInstallRegistry; skills: SkillRegistry }
}

export const name = "lfaaCapabilitySkill";
export const inject = ["lfaaCapabilityInstalls", "skills"];
export function apply(ctx: Context): void {
  ctx.lfaaCapabilityInstalls.register(ctx, createAccountSkillAdapter({
    skillRegistry: ctx.skills,
    invalidateSkills: () => ctx.skills.invalidate()
  }));
}
