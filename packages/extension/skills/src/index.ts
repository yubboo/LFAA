// @lfaa/skills Host 侧 Cordis 服务：统一暴露技能发现、Git 安装、编辑、二创、启停与 Agent 按需加载工具。
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { PluginSkillDefinition, SaveSkillInput, SkillDetail, SkillSummary } from "../contract/index";
import { SkillManager } from "./skill-service";

export * from "../contract/index";
export { createSkillsHttpHandler } from "./skill-routes";
export { parseSkillMarkdown } from "./skill-service";

export interface SkillsPluginConfig {
  personalDir?: string;
  builtinDir?: string;
}

/** Host 侧技能服务，挂载于 Cordis `skills` 属性。 */
export class SkillsService extends Service {
  private readonly manager: SkillManager;

  constructor(ctx: Context, config: SkillsPluginConfig = {}) {
    super(ctx, "skills");
    this.manager = new SkillManager(config.personalDir, config.builtinDir);

    // 若宿主已装配 @lfaa/tools，自动为小鱼 Agent 注册按需读技能、Git 安装技能与自建用户技能工具。
    const toolsFiber = ctx.plugin({
      inject: ["tools"],
      apply: (childCtx) => {
        const cleanups = [
          childCtx.tools.registerTool({
            name: "list_skills",
            title: "列出可用技能",
            description: "列出小鱼当前已启用的用户级（~/.lfaa/skills）、内置与插件技能摘要。",
            permissionLevel: "read",
            parameters: { type: "object", properties: {} },
            execute: async (_args, execCtx) => {
              const list = await this.listSkills({
                projectRoots: execCtx.workspaceRoots,
                includeDisabled: false,
              });
              return {
                ok: true,
                output: JSON.stringify(list, null, 2),
                summary: `共 ${list.length} 个已启用技能`,
              };
            },
          }),
          childCtx.tools.registerTool({
            name: "load_skill",
            title: "按需加载技能正文",
            description: "根据技能 ID 或名称读取已启用技能的完整 SKILL.md 指令内容。",
            permissionLevel: "read",
            parameters: {
              type: "object",
              properties: { idOrName: { type: "string", description: "技能 ID 或名称" } },
              required: ["idOrName"],
            },
            execute: async (args) => {
              const key = typeof args.idOrName === "string" ? args.idOrName.trim() : "";
              const all = await this.listSkills({ includeDisabled: false });
              const matched = all.find((s) => s.id === key || s.name === key);
              if (!matched) {
                return { ok: false, output: `未找到已启用的技能：${key}`, summary: `未找到技能 ${key}` };
              }
              const detail = await this.getSkillDetail(matched.id);
              return {
                ok: true,
                output: detail?.content ?? "",
                summary: `已加载技能 ${matched.name} (${matched.source})`,
              };
            },
          }),
          childCtx.tools.registerTool({
            name: "install_skill_from_git",
            title: "从 Git 仓库安装技能",
            description: "从 GitHub/Git 仓库 URL 克隆并提取 SKILL.md 安装到用户级目录（~/.lfaa/skills/）。",
            permissionLevel: "exec",
            parameters: {
              type: "object",
              properties: { repoUrl: { type: "string", description: "Git 仓库地址，例如 https://github.com/linyi-ui/ui-motion-skill.git" } },
              required: ["repoUrl"],
            },
            execute: async (args) => {
              const repoUrl = typeof args.repoUrl === "string" ? args.repoUrl : "";
              const installed = await this.installFromGitRepo(repoUrl);
              return {
                ok: true,
                output: JSON.stringify(installed.map((s) => ({ id: s.id, name: s.name, filePath: s.filePath })), null, 2),
                summary: `已安装 ${installed.length} 个用户级技能至 ~/.lfaa/skills/`,
              };
            },
          }),
          childCtx.tools.registerTool({
            name: "save_user_skill",
            title: "保存用户级技能",
            description: "在用户级目录（~/.lfaa/skills/）创建或更新一个个人技能（SKILL.md）。",
            permissionLevel: "write",
            parameters: {
              type: "object",
              properties: {
                id: { type: "string", description: "可选技能 ID（英文短横线）" },
                name: { type: "string", description: "技能名称" },
                description: { type: "string", description: "技能简短描述" },
                content: { type: "string", description: "SKILL.md 完整正文内容" },
              },
              required: ["name", "content"],
            },
            execute: async (args) => {
              const saved = await this.createOrUpdateSkill({
                ...(typeof args.id === "string" ? { id: args.id } : {}),
                name: typeof args.name === "string" ? args.name : "",
                ...(typeof args.description === "string" ? { description: args.description } : {}),
                content: typeof args.content === "string" ? args.content : "",
              });
              return {
                ok: true,
                output: JSON.stringify({ id: saved.id, name: saved.name, revision: saved.revision, filePath: saved.filePath }, null, 2),
                summary: `已保存用户级技能 ${saved.name} (v${saved.revision})`,
              };
            },
          }),
        ];
        childCtx.effect(() => () => {
          for (const fn of cleanups) fn();
        });
      },
    });
    ctx.effect(() => () => {
      void toolsFiber.dispose().catch(() => {});
    });
  }

  registerPluginSkills(pluginId: string, skills: PluginSkillDefinition[]): () => void {
    return this.manager.registerPluginSkills(pluginId, skills);
  }

  listSkills(options?: { projectRoots?: string[]; includeDisabled?: boolean }): Promise<SkillSummary[]> {
    return this.manager.listSkills(options);
  }

  getSkillDetail(id: string, projectRoots?: string[]): Promise<SkillDetail | null> {
    return this.manager.getSkillDetail(id, projectRoots);
  }

  createOrUpdateSkill(input: SaveSkillInput): Promise<SkillDetail> {
    return this.manager.createOrUpdateSkill(input);
  }

  installFromGitRepo(repoUrl: string): Promise<SkillDetail[]> {
    return this.manager.installFromGitRepo(repoUrl);
  }

  forkSkill(sourceId: string, projectRoots?: string[]): Promise<SkillDetail> {
    return this.manager.forkSkill(sourceId, projectRoots);
  }

  setSkillEnabled(id: string, enabled: boolean, projectRoots?: string[]): Promise<SkillSummary> {
    return this.manager.setSkillEnabled(id, enabled, projectRoots);
  }

  deleteSkill(id: string): Promise<boolean> {
    return this.manager.deleteSkill(id);
  }

  resolveSkillsForRun(skillIds: string[], projectRoots?: string[]): Promise<SkillDetail[]> {
    return this.manager.resolveSkillsForRun(skillIds, projectRoots);
  }
}

export function skillsPlugin(context: Context, config: SkillsPluginConfig = {}): void {
  new SkillsService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    skills: SkillsService;
  }
}
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default skillsPlugin;
