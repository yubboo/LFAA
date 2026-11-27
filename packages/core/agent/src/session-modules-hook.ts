// 会话模块兼容器：装配层在运行期注入的钩子状态与注销逻辑，独立于 Agent 服务主体。
import type { AgentPluginConfig } from "./plugin-config";

/** 可在运行期替换、并可回滚的会话兼容器。 */
export class SessionModulesHook {
  private current: AgentPluginConfig["resolveSessionModules"];

  constructor(initial?: AgentPluginConfig["resolveSessionModules"]) {
    this.current = initial;
  }

  get(): AgentPluginConfig["resolveSessionModules"] {
    return this.current;
  }

  set(hook: NonNullable<AgentPluginConfig["resolveSessionModules"]>): () => void {
    const previous = this.current;
    this.current = hook;
    return () => {
      this.current = previous;
    };
  }
}