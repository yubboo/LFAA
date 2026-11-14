/**
 * 文件：useWorkspaceCapabilities.ts
 * 功能：加载当前账户/App 可见的扩展与 Skill 引用目录。
 * 作用：维护加载状态并转交真实注册表结果；不执行能力或复制正文。
 * 关联文件：../../ApplicationWorkspace.tsx、Client Connection 与 Capability Registry Owners。
 */
import { useEffect, useState } from "react";
import { getErrorMessage, loadAiExtensions, type AiExtension, type ApplicationId } from "lfaa-client-connection/src/api.js";
import { loadAiSkillDirectory } from "lfaa-client-connection/src/api.js";

const extensionSnapshots = new Map<string, AiExtension[]>();

export function useWorkspaceCapabilities(userId: string, app: ApplicationId, mode: "normal" | "ai-work", plugins: { enabled: boolean; skillDirectories?: string[] }) {
  const [registeredExtensions, setRegisteredExtensions] = useState<AiExtension[]>(() => extensionSnapshots.get(userId) ?? []);
  const [skillReferences, setSkillReferences] = useState<Array<{ id: string; name: string; kind: "skill" }>>([]);
  const [skillReferencesError, setSkillReferencesError] = useState("");
  const [extensionsLoading, setExtensionsLoading] = useState(() => mode === "ai-work" && !extensionSnapshots.has(userId));

  useEffect(() => {
    if (mode !== "ai-work") return;
    const controller = new AbortController();
    setSkillReferencesError("");
    void loadAiSkillDirectory(controller.signal).then(result => { if (!controller.signal.aborted) setSkillReferences(result.skills); })
      .catch(error => { if (!controller.signal.aborted) setSkillReferencesError(getErrorMessage(error)); });
    return () => controller.abort();
  }, [mode, plugins.enabled, plugins.skillDirectories, userId]);

  useEffect(() => {
    if (mode !== "ai-work") { setExtensionsLoading(false); return; }
    const controller = new AbortController();
    setRegisteredExtensions(extensionSnapshots.get(userId) ?? []);
    setExtensionsLoading(!extensionSnapshots.has(userId));
    void loadAiExtensions(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      extensionSnapshots.set(userId, result.extensions);
      setRegisteredExtensions(result.extensions);
    }).catch(() => {
      if (!controller.signal.aborted && !extensionSnapshots.has(userId)) setRegisteredExtensions([]);
    }).finally(() => { if (!controller.signal.aborted) setExtensionsLoading(false); });
    return () => controller.abort();
  }, [mode, plugins.enabled, userId]);

  const applicationExtensions = registeredExtensions.filter(item => !item.applicationIds || item.applicationIds.includes(app));
  return { registeredExtensions, applicationExtensions, skillReferences, skillReferencesError, extensionsLoading };
}
