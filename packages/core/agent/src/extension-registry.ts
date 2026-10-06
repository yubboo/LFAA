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
  applicationIds?: readonly ApplicationId[];
  toolPolicy?: Readonly<{ risk: "read" | "write" | "dangerous"; workspaceBound: boolean }>;
  instructions?: string;
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
      .map(({ instructions: _instructions, ...manifest }) => ({ ...manifest }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  getInstructions(applicationId: ApplicationId): string[] {
    return [...this.manifests.values()]
      .filter((manifest) => manifest.instructions && isApplicationInScope(manifest.applicationIds, applicationId))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((manifest) => manifest.instructions!);
  }

  listInstructionExtensions(applicationId: ApplicationId): AiExtensionManifest[] {
    return [...this.manifests.values()]
      .filter((manifest) => manifest.instructions && isApplicationInScope(manifest.applicationIds, applicationId))
      .map(({ instructions: _instructions, ...manifest }) => ({ ...manifest }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }
}

export default AiExtensionRegistry;
