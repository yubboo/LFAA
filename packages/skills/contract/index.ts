// @lfaa/skills 公开契约：定义技能来源、摘要、详情、编辑输入与插件技能注册接口，无 Node 或 DOM 依赖。

/** 技能来源类型：个人自建、LFAA 内置、项目目录或已启用插件提供。 */
export type SkillSourceKind = "personal" | "builtin" | "project" | "plugin";

/** 技能列表摘要项。 */
export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  source: SkillSourceKind;
  scopeRoot?: string;
  pluginId?: string;
  originSkillId?: string;
  enabled: boolean;
  editable: boolean;
  revision: number;
  updatedAt: number;
}

/** 技能详情记录，包含完整 SKILL.md 正文与磁盘路径（若存在）。 */
export interface SkillDetail extends SkillSummary {
  content: string;
  filePath?: string;
}

/** 新增或更新用户技能的请求体。 */
export interface SaveSkillInput {
  id?: string;
  name: string;
  description?: string;
  content: string;
  source?: "personal" | "project";
  scopeRoot?: string;
  expectedRevision?: number;
}

/** 由插件向技能服务注册的技能定义。 */
export interface PluginSkillDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
}
