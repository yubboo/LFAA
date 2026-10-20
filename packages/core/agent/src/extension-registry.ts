/**
 * 功能：提供 Cordis 插件使用的 AI 扩展登记服务。
 * 作用：登记和查询 Provider、Skill、Prompt、Expert、Tool 等扩展的公开元数据，并支持随插件卸载清理。
 * 关联文件：packages/boot/app-boot/src/ai-host.ts、未来的 AI Provider/Skill/Prompt/Agent/Tool 插件。
 */
import { Service, type Context } from "@deepseek-ai/cordis";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { isApplicationInScope } from "lfaa-scope/src/index.js";

export type AiExtensionKind = "agent" | "llm-provider" | "skill" | "prompt" | "expert" | "tool";

export interface AiExtensionManifest {
  id: string;
  pluginId: string;
  kind: AiExtensionKind;
  name: string;
  version: string;
  description: string;
  /** Stable key shared with SkillRegistry; lets Settings toggle this exact Skill entry. */
  skillId?: string;
  applicationIds?: readonly ApplicationId[];
  toolPolicy?: Readonly<{ risk: "read" | "write" | "dangerous"; workspaceBound: boolean }>;
  instructions?: string;
  /** 内置内容不随可选第三方扩展开关关闭；仍受真实数据与权限 Owner 约束。 */
  builtIn?: boolean;
  /** 正文只在模型显式请求时读取；目录和常规上下文不执行此加载器。 */
  loadInstructions?: () => Promise<string>;
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    aiExtensions: AiExtensionRegistry;
  }
}

/**
 * 以 Cordis Service 形式提供插件扩展目录；业务工具的权限检查不由此目录处理。
 */
/** Cordis 会在此插件卸载时撤销扩展目录服务。 */
export class AiExtensionRegistry extends Service {
  private readonly manifests = new Map<string, AiExtensionManifest>();

  constructor(ctx: Context) {
    super(ctx, "aiExtensions");
  }

  register(owner: Context, manifest: AiExtensionManifest): void {
    owner.effect(() => {
      if (!/^[a-z0-9][a-z0-9._-]{1,119}$/.test(manifest.id)) {
        throw new Error("AI 扩展 ID 格式无效。");
      }
      if (!/^[a-z0-9][a-z0-9._-]{1,119}$/.test(manifest.pluginId)) {
        throw new Error("AI 插件 ID 格式无效。");
      }
      if (manifest.kind === "tool" && (!manifest.applicationIds?.length || !manifest.toolPolicy)) {
        throw new Error("AI 工具扩展必须声明应用范围和风险策略。");
      }
      if (manifest.skillId !== undefined && (manifest.kind !== "skill" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.skillId))) {
        throw new Error("AI Skill 扩展的 Skill ID 无效。");
      }
      if (manifest.applicationIds?.some((applicationId) => !APPLICATION_IDS.includes(applicationId))) {
        throw new Error("AI 扩展声明了无效的应用范围。");
      }
      if (manifest.kind !== "tool" && manifest.toolPolicy) {
        throw new Error("只有 AI 工具扩展可以声明工具风险策略。");
      }
      if (this.manifests.has(manifest.id)) {
        throw new Error(`AI 扩展 ID 已注册：${manifest.id}`);
      }

      const registered = Object.freeze({
        ...manifest,
        ...(manifest.applicationIds ? { applicationIds: Object.freeze([...manifest.applicationIds]) } : {}),
        ...(manifest.toolPolicy ? { toolPolicy: Object.freeze({ ...manifest.toolPolicy }) } : {})
      });
      this.manifests.set(registered.id, registered);
      return () => {
        if (this.manifests.get(registered.id) === registered) {
          this.manifests.delete(registered.id);
        }
      };
    }, `ai-extension:${manifest.id}`);
  }

  list(kind?: AiExtensionKind): AiExtensionManifest[] {
    return [...this.manifests.values()]
      .filter((manifest) => kind === undefined || manifest.kind === kind)
      .map(({ instructions: _instructions, loadInstructions: _loader, ...manifest }) => ({ ...manifest }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  getInstructions(applicationId: ApplicationId): string[] {
    return [...this.manifests.values()]
      .filter((manifest) => manifest.id === "agent.ai-work-assistant" && manifest.kind === "agent" && manifest.instructions && isApplicationInScope(manifest.applicationIds, applicationId))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((manifest) => manifest.instructions!);
  }

  listInstructionExtensions(applicationId: ApplicationId): AiExtensionManifest[] {
    return [...this.manifests.values()]
      .filter((manifest) => (manifest.instructions || manifest.loadInstructions) && isApplicationInScope(manifest.applicationIds, applicationId))
      .map(({ instructions: _instructions, loadInstructions: _loader, ...manifest }) => ({ ...manifest }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  /** 加载前后都重验登记身份，插件卸载不能让旧的异步正文进入下一模型请求。 */
  async loadInstructions(id: string, applicationId: ApplicationId): Promise<AiExtensionManifest & { instructions: string }> {
    const manifest = this.manifests.get(id);
    if (!manifest || !isApplicationInScope(manifest.applicationIds, applicationId)) throw new Error("该内容未登记或不在当前上下文范围。");
    const instructions = manifest.loadInstructions ? await manifest.loadInstructions() : manifest.instructions;
    if (this.manifests.get(id) !== manifest) throw new Error("内容所属插件已卸载，拒绝返回过期正文。");
    if (!instructions || Buffer.byteLength(instructions, "utf8") > 64 * 1024) throw new Error("内容正文缺失或超过 64 KiB 加载上限。");
    const { loadInstructions: _loader, ...metadata } = manifest;
    return { ...metadata, instructions };
  }
}

export default AiExtensionRegistry;
