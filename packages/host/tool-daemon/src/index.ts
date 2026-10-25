/**
 * 功能：让 Agent 查看并受控启停本机托管节点（Daemon）。
 * 作用：只调用启动器登记的 supervisor，不自行派生进程、不读任意 pid、不改权限或节点数据。
 * 关联文件：host/daemon/src/supervisor.mjs、apps/cli/bin/lfaa.mjs、core/tools、bundle/base。
 */
import type { Context } from "@deepseek-ai/cordis";
import Joi from "joi";
import { makeTool, strictObject, parseWithSchema, type AiBusinessTool } from "lfaa-tools/src/tool-contract.js";
import { listDaemonNodes } from "lfaa-host-daemon/src/local-daemon.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";

/** 启动器注入的受管节点控制面；独立控制端或 --no-local-daemon 时不存在。 */
interface LocalDaemonSupervisor {
  status(): Record<string, unknown>;
  start(): Promise<Record<string, unknown>>;
  stop(): Promise<Record<string, unknown>>;
  restart(): Promise<Record<string, unknown>>;
}

const noSupervisorMessage = "当前启动方式没有托管本机节点（独立控制端、--no-local-daemon 或远程部署）；本机节点需要由桌面应用或菜单启动，不能用任意命令替代。";
const emptySchema = strictObject({});
const parseEmpty = (value: unknown) => parseWithSchema(Joi.object({}).unknown(false), value);

function createTools(read: () => LocalDaemonSupervisor | undefined): AiBusinessTool[] {
  const requireSupervisor = () => {
    const supervisor = read();
    if (!supervisor) throw new Error(noSupervisorMessage);
    return supervisor;
  };
  return [
    makeTool({
      id: "daemon.local-status", name: "daemon_local_status", coreManaged: true, onDemand: true, applicationIds: [...APPLICATION_IDS],
      description: "读取本机托管节点的真实状态（是否运行、进程 ID、重启次数、最近退出）与当前账户可见的节点清单。节点离线时先用它判断是未启动还是已断开，再决定是否调用 daemon_local_start，不要用 Shell 猜进程。",
      schema: emptySchema, parse: parseEmpty, risk: () => "read",
      approval: () => ({ scopeKey: "daemon-local:status", scopeSummary: "本机托管节点状态", summary: "读取本机托管节点状态" }),
      execute: async () => {
        const supervisor = read();
        const nodes = listDaemonNodes().map(node => ({ id: node.id, displayName: node.displayName, status: node.status, platform: node.platform, lastSeenAt: node.lastSeenAt }));
        return supervisor
          ? { supervised: true, supervisor: supervisor.status(), nodes }
          : { supervised: false, reason: noSupervisorMessage, nodes };
      }
    }),
    makeTool({
      id: "daemon.local-start", name: "daemon_local_start", coreManaged: true, onDemand: true, applicationIds: [...APPLICATION_IDS],
      description: "启动当前受管的本机节点。幂等：已在运行时直接返回真实状态，不派生第二个进程；没有托管面时明确失败，不尝试其它命令。启动回执不代表节点已在线，需再读 daemon_local_status。",
      schema: emptySchema, parse: parseEmpty, risk: () => "write",
      approval: () => ({ scopeKey: "daemon-local:start", scopeSummary: "启动本机托管节点", summary: "启动本机托管节点进程" }),
      execute: async () => ({ started: true, supervisor: await requireSupervisor().start(), note: "启动请求已交给受管 supervisor；在线状态需再次读取。" })
    }),
    makeTool({
      id: "daemon.local-stop", name: "daemon_local_stop", coreManaged: true, onDemand: true, applicationIds: [...APPLICATION_IDS],
      description: "停止当前受管的本机节点，先走既有受控退出（IPC 卸载），等待真实退出后返回状态；运行中的游戏实例会按节点自身规则处理，不由工具假装已停止。",
      schema: emptySchema, parse: parseEmpty, risk: () => "dangerous",
      approval: () => ({ scopeKey: "daemon-local:stop", scopeSummary: "停止本机托管节点", summary: "停止本机托管节点进程" }),
      execute: async () => ({ stopped: true, supervisor: await requireSupervisor().stop(), note: "已等待受管节点退出；是否仍有业务进程需按节点回报核对。" })
    }),
    makeTool({
      id: "daemon.local-restart", name: "daemon_local_restart", coreManaged: true, onDemand: true, applicationIds: [...APPLICATION_IDS],
      description: "受控重启本机节点：先安全退出再启动。只用于节点自身异常且用户目标明确需要恢复时；不重放重启前已派发的任务。",
      schema: emptySchema, parse: parseEmpty, risk: () => "dangerous",
      approval: () => ({ scopeKey: "daemon-local:restart", scopeSummary: "重启本机托管节点", summary: "重启本机托管节点进程" }),
      execute: async () => ({ restarted: true, supervisor: await requireSupervisor().restart(), note: "重启请求已执行；在线状态与任务恢复需按真实结果核对。" })
    })
  ];
}

export const name = "lfaaToolDaemon";
export const inject = ["lfaaTools"];
export function apply(ctx: Context): void {
  for (const tool of createTools(() => ctx.get("lfaaLocalDaemonSupervisor") as LocalDaemonSupervisor | undefined)) ctx.lfaaTools.registerTool(ctx, tool);
}
