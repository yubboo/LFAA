/** 功能：声明 DSH Renderer 的无会话边界。作用：让根级插件槽可渲染，同时拒绝伪造 DSH Session。关联文件：client/index.ts、DSH Client UI Renderer。 */
import type { Context } from "@deepseek-ai/cordis";
import type { HostObservable, SlotScopeAdapter, StandardSourceBinding } from "@deepseek-ai/dsh-client-ui-slots";

interface SessionScopeInstaller {
  installScope(scope: "session", adapter: SlotScopeAdapter): void;
}

type DshSessionContext = Context & { readonly slots?: SessionScopeInstaller };

const emptyBinding: StandardSourceBinding = Object.freeze({
  key: undefined,
  hooks: Object.freeze({}),
  keyedHooks: Object.freeze({}),
  props: Object.freeze({})
});

const emptyBindingSource: HostObservable<StandardSourceBinding> = Object.freeze({
  getSnapshot: () => emptyBinding,
  subscribe: () => () => {}
});

/** 仅在当前 Client Context 没有官方 DSH uiSession Owner 时提供无会话投影。 */
export function installLfaaDshSessionScope(context: Context): boolean {
  if (context.get("uiSession") !== undefined) return false;
  const slots = (context as DshSessionContext).slots;
  if (!slots) return false;

  const adapter: SlotScopeAdapter = {
    current: emptyBindingSource,
    bindingSource(target) {
      if (target !== undefined) {
        throw new Error("LFAA 当前没有可映射的 DSH Session，拒绝解析显式 Session target。");
      }
      return emptyBindingSource;
    }
  };
  slots.installScope("session", adapter);
  return true;
}
