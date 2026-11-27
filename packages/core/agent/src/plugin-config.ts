// Agent 插件配置契约：与 Agent 服务主体分开，供装配层与测试引用。
export interface AgentPluginConfig {
  smartTrustFilePath?: string;
  /** 装配层可兼容已存会话的旧预设组合。 */
  resolveSessionModules?: (presetId: string | undefined, modules: readonly string[]) => readonly string[];
}