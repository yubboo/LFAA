/**
 * 功能：把控制指令应用到一个活动子代理句柄。
 * 作用：cancel 转发到句柄的取消；pause/resume 对一次性运行不适用（一次性模型无法暂停），返回未受理回执而不抛错。
 * 关联文件：control-types.ts、manager.ts、child-agent.ts。
 */
import type { SubagentRunHandle } from "./types.js";
import type { SubagentControlCommand, SubagentControlReceipt } from "./control-types.js";

/** 对一个运行句柄执行控制指令。 */
export function applyControl(run: SubagentRunHandle, command: SubagentControlCommand): SubagentControlReceipt {
  if (command.type === "cancel") {
    if (run.status !== "running") return { accepted: false, reason: `运行已处于 ${run.status}，无需取消。` };
    run.cancel();
    return { accepted: true };
  }
  // 当前 LFAA 子代理为一次性执行，不支持真正的暂停/恢复；明确告知调用方，不伪造。
  return { accepted: false, reason: "一次性子代理不支持暂停/恢复，仅支持取消。" };
}
