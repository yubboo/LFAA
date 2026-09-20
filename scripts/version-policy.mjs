/**
 * 文件：version-policy.mjs
 * 作用：定义 LFAA 显示版本的进位规则，避免出现 0.0.100 这类违反开发规范的版本号。
 * 负责：版本格式校验、0-99 分段约束、下一版本计算。
 * 不负责：修改文件、决定 releaseSequence、生成发布包。
 * 状态归属：无状态；版本事实仍归 lfaa.release.json。
 * 对外接口：validateLfaaVersion / nextLfaaVersion。
 * 关联文件：lfaa.release.json、release-consistency-check.mjs、DEVELOPMENT.md、docs/RELEASES.md。
 * 修改注意事项：版本进位规范变化时必须同步开发规范、发布文档与单元测试。
 */

export function validateLfaaVersion(version) {
  const value = String(version ?? "").trim();
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) throw new Error(`invalid LFAA version: ${value || "<empty>"}`);

  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part) || part < 0 || part > 99)) {
    throw new Error(`LFAA version segments must stay within 0-99: ${value}`);
  }

  return { major: parts[0], minor: parts[1], patch: parts[2], value };
}

export function nextLfaaVersion(version) {
  const { major, minor, patch } = validateLfaaVersion(version);
  if (patch < 99) return `${major}.${minor}.${patch + 1}`;
  if (minor < 99) return `${major}.${minor + 1}.0`;
  return `${major + 1}.0.0`;
}
