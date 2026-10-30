/**
 * Minecraft server.properties 的共享字段约束。
 * 控制端、任务执行器和 Daemon 共用同一敏感字段判定，避免脱敏规则分叉。
 */
export const MINECRAFT_PROPERTY_KEY_PATTERN = /^[A-Za-z0-9._-]{1,128}$/u;
export const MINECRAFT_PROPERTY_VALUE_LIMIT = 4096;
export const MINECRAFT_PROPERTIES_TOTAL_LIMIT = 64 * 1024;
export const MINECRAFT_PROPERTIES_ENTRY_LIMIT = 256;

export function isSensitiveMinecraftPropertyKey(key) {
  return /password|secret|token|credential|api[-_.]?key|private[-_.]?key|resource-pack/iu.test(key);
}

/** 校验动态 server.properties 写入；调用方仍须先核验权限、实例状态及节点快照。 */
export function validateMinecraftPropertyChanges(values, knownKeys, releaseId) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("服务器配置必须是属性名和值组成的对象。");
  const keys = Object.keys(values);
  if (!keys.length || keys.length > MINECRAFT_PROPERTIES_ENTRY_LIMIT) throw new Error("请至少修改一项，且单次修改不超过 256 项。");
  const result = Object.create(null);
  let totalBytes = 0;
  for (const [key, value] of Object.entries(values)) {
    if (!MINECRAFT_PROPERTY_KEY_PATTERN.test(key)) throw new Error(`属性名 ${key} 格式不正确。`);
    if (!knownKeys.has(key)) throw new Error(`属性 ${key} 不在目标节点当前 server.properties 中，拒绝修改。`);
    if (value === null && isSensitiveMinecraftPropertyKey(key)) {
      result[key] = null;
      continue;
    }
    if (typeof value !== "string" || value.length > MINECRAFT_PROPERTY_VALUE_LIMIT || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`属性 ${key} 的值无效或超过 4096 字符。`);
    totalBytes += Buffer.byteLength(key, "utf8") + Buffer.byteLength(value, "utf8");
    if (totalBytes > MINECRAFT_PROPERTIES_TOTAL_LIMIT) throw new Error("本次修改总量超过 64 KiB。");
    if (key === "level-name" && (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(value) || value.includes(".."))) throw new Error("世界名称只能包含字母、数字、点、下划线和连字符，且不能含有路径片段。");
    const integerRanges = {
      "server-port": [1024, 65535], "max-players": [1, 200], "view-distance": [2, 32], "simulation-distance": [2, 32]
    };
    const range = integerRanges[key];
    if (range) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < range[0] || number > range[1]) throw new Error(`属性 ${key} 必须在 ${range[0]} 到 ${range[1]} 之间。`);
      if (key === "simulation-distance" && !supportsSimulationDistance(releaseId)) throw new Error(`Minecraft ${releaseId} 不支持修改 simulation-distance。`);
    }
    if (key === "motd" && value.length > 120) throw new Error("MOTD 不能超过 120 个字符。");
    if (key === "level-seed" && value.length > 80) throw new Error("世界种子不能超过 80 个字符。");
    if (["difficulty", "gamemode"].includes(key)) {
      const allowed = key === "difficulty" ? ["peaceful", "easy", "normal", "hard", "0", "1", "2", "3"] : ["survival", "creative", "adventure", "spectator", "0", "1", "2", "3"];
      if (!allowed.includes(value.toLowerCase())) throw new Error(`属性 ${key} 的枚举值不受支持。`);
    }
    result[key] = value;
  }
  return result;
}

function supportsSimulationDistance(releaseId) {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?(?:$|[-+])/u.exec(String(releaseId ?? ""));
  if (!match) return false;
  const [, major, minor] = match;
  return Number(major) > 1 || Number(major) === 1 && Number(minor) >= 18;
}

