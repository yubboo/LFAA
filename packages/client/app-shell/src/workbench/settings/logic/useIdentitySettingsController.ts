/**
 * 文件：useIdentitySettingsController.ts
 * 作用：设置中心 Identity 用户/角色数据的唯一 App-Shell 状态 Owner。
 * 负责：加载身份快照、创建/更新用户、创建/更新/删除自定义角色与错误映射。
 * 不负责：权限最终判定、密码散列、Cookie、First Run、UI 表单。
 * 状态归属：只缓存当前设置页投影；身份长期真值仍由 Identity Host 保存。
 * 对外接口：useIdentitySettingsController、IdentitySettingsController。
 * 关联文件：IdentitySettingsPanel.tsx、#workbench/contracts、@lfaa/identity。
 * 修改注意事项：403/Host 错误必须显式显示，禁止用空列表伪装成功。
 */
import { useEffect, useState } from "react";
import type { LfaaIdentitySnapshot } from "@lfaa/identity";
import type { AgentIdentitySettingsHost } from "#workbench/contracts";

const EMPTY: LfaaIdentitySnapshot = { initialized: false, users: [], roles: [] };

export function useIdentitySettingsController(host: AgentIdentitySettingsHost | undefined, enabled = true) {
  const [snapshot, setSnapshot] = useState<LfaaIdentitySnapshot>(EMPTY);
  const [hostAvailable, setHostAvailable] = useState(Boolean(host));
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!host || !enabled) { setHostAvailable(Boolean(host)); setSnapshot(EMPTY); setError(""); return; }
    host.snapshot().then((next) => {
      if (cancelled) return;
      setSnapshot(next); setHostAvailable(true); setError("");
    }).catch((reason) => {
      if (cancelled) return;
      setHostAvailable(true); setError(reason instanceof Error ? reason.message : "Identity Host 读取失败。");
    });
    return () => { cancelled = true; };
  }, [host, enabled]);

  const requireHost = () => { if (!host) throw new Error("当前宿主未提供 Identity 管理桥。"); return host; };
  const run = async (operation: () => Promise<LfaaIdentitySnapshot>) => {
    try { const next = await operation(); setSnapshot(next); setError(""); return next; }
    catch (reason) { const message = reason instanceof Error ? reason.message : "Identity 操作失败。"; setError(message); throw reason; }
  };

  return {
    snapshot, hostAvailable, error,
    createUser: (input: Parameters<AgentIdentitySettingsHost["createUser"]>[0]) => run(() => requireHost().createUser(input)),
    updateUser: (userId: string, input: Parameters<AgentIdentitySettingsHost["updateUser"]>[1]) => run(() => requireHost().updateUser(userId, input)),
    createRole: (input: Parameters<AgentIdentitySettingsHost["createRole"]>[0]) => run(() => requireHost().createRole(input)),
    updateRole: (roleId: string, input: Parameters<AgentIdentitySettingsHost["updateRole"]>[1]) => run(() => requireHost().updateRole(roleId, input)),
    deleteRole: (roleId: string) => run(() => requireHost().deleteRole(roleId)),
  };
}
export type IdentitySettingsController = ReturnType<typeof useIdentitySettingsController>;
