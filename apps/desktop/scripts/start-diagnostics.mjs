// 桌面端启动失败诊断：识别 Windows 低完整性级别（Low Mandatory Level）与目录 ACL 缺失，避免误走 --no-sandbox。
// 关联：apps/desktop/scripts/start.mjs；运行环境：Node.js。

/** Windows 内置 ALL APPLICATION PACKAGES 伪组的只读与执行继承授权参数。 */
export const ALL_APP_PACKAGES_GRANT = "*S-1-15-2-1:(OI)(CI)(RX)";

/** Windows 恢复正常中等完整性级别（Medium Integrity）的 icacls 参数。 */
export const MEDIUM_INTEGRITY_LEVEL = "(OI)(CI)M";

const ALL_APP_PACKAGES_PATTERN = /ALL APPLICATION PACKAGES|S-1-15-2-1|所有应用程序包/i;
const LOW_INTEGRITY_PATTERN = /Low Mandatory Level|S-1-16-4096|低强制级别/i;

/** 判断退出码是否为 Windows Chromium FATAL / CHECK 触发的 STATUS_BREAKPOINT（0x80000003）。 */
export function isBreakpointExit(code) {
  return code === 0x80000003 || code === -2147483645;
}

/** 根据 icacls 输出判断目录是否已包含 ALL APPLICATION PACKAGES 读取权限。 */
export function hasAllApplicationPackagesAcl(icaclsOutput) {
  return typeof icaclsOutput === "string" && ALL_APP_PACKAGES_PATTERN.test(icaclsOutput);
}

/**
 * 根据 icacls 输出判断目标是否带有 Windows Low Mandatory Level（低完整性标记）。
 * 可执行文件一旦继承低完整性，即使在管理员终端启动也会被 Windows 强制降权，
 * 同时触发 Chromium 沙箱 0x80000003 崩溃与 EPERM lstat 盘符根异常。
 */
export function hasLowIntegrityLabel(icaclsOutput) {
  return typeof icaclsOutput === "string" && LOW_INTEGRITY_PATTERN.test(icaclsOutput);
}

/** 生成对应目录的 icacls ALL APPLICATION PACKAGES 授权命令。 */
export function formatAclGrantCommand(targetDir) {
  return `icacls "${targetDir}" /grant ${ALL_APP_PACKAGES_GRANT}`;
}

/** 生成对应目录的 icacls 中等完整性级别恢复命令。 */
export function formatIntegrityRepairCommand(targetDir) {
  return `icacls "${targetDir}" /setintegritylevel "${MEDIUM_INTEGRITY_LEVEL}" /T`;
}

/**
 * 根据退出码与 Windows 目录 ACL 探测结果决定下一步动作：
 * - repair-acl：缺少 ALL APPLICATION PACKAGES 且尚未尝试自动修复；
 * - acl-failed：已尝试修复或权限不足，直接提示手动授权；
 * - retry-no-sandbox：非 ACL 问题导致的 0x80000003，按原策略用 --no-sandbox 重试一次；
 * - exit：正常退出或其它错误，直接透传退出码。
 */
export function classifyLaunchFailure({
  code,
  noSandbox,
  aclRepairAttempted,
  missingAppPackagesAcl,
  platform = process.platform,
  targetDir = "",
}) {
  if (!isBreakpointExit(code)) {
    return { kind: "exit" };
  }

  if (platform === "win32" && missingAppPackagesAcl) {
    return {
      kind: aclRepairAttempted ? "acl-failed" : "repair-acl",
      targetDir,
      grantCommand: formatAclGrantCommand(targetDir),
    };
  }

  if (!noSandbox) {
    return { kind: "retry-no-sandbox" };
  }

  return { kind: "exit" };
}
