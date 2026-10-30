/**
 * 功能：定义 Minecraft 实例 JVM 参数的共享纯值合同。
 * 作用：集中解析堆大小、预设与安全白名单，供设置 API、目标 Daemon 和实例界面共用。
 * 关联文件：games/minecraft/src/service.ts 持久化实例值；host/daemon/src/minecraft-provisioner.mjs 构造启动参数；client/ui-minecraft/src/MinecraftJvmSettings.tsx 提供编辑器。
 */

export const MINECRAFT_JVM_PRESET_IDS = Object.freeze(["recommended", "high-performance", "low-memory", "custom"]);

// 此保守子集来自 Paper 官方 Aikar 参数说明；不包含会预触碰完整堆或引入共享内存文件写入的选项。
const PAPER_RECOMMENDED_FLAGS = Object.freeze([
  "-XX:+UseG1GC",
  "-XX:+ParallelRefProcEnabled",
  "-XX:MaxGCPauseMillis=200",
  "-XX:+DisableExplicitGC"
]);

const PAPER_HIGH_PERFORMANCE_FLAGS = Object.freeze([
  ...PAPER_RECOMMENDED_FLAGS,
  "-XX:+UnlockExperimentalVMOptions",
  "-XX:G1NewSizePercent=30",
  "-XX:G1MaxNewSizePercent=40",
  "-XX:G1HeapRegionSize=8M",
  "-XX:G1ReservePercent=20",
  "-XX:G1HeapWastePercent=5",
  "-XX:G1MixedGCCountTarget=4",
  "-XX:InitiatingHeapOccupancyPercent=15",
  "-XX:G1MixedGCLiveThresholdPercent=90",
  "-XX:G1RSetUpdatingPauseTimePercent=5",
  "-XX:SurvivorRatio=32",
  "-XX:MaxTenuringThreshold=1"
]);

function requireInteger(value, minimum, maximum, message) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(message);
  return value;
}

function parseHeapArgument(value) {
  const match = /^-Xm([sx])(\d{1,5})([MG])$/iu.exec(value);
  if (!match) return null;
  const amount = Number(match[2]);
  const memoryMb = match[3].toLocaleUpperCase() === "G" ? amount * 1024 : amount;
  if (!Number.isSafeInteger(memoryMb)) throw new Error("JVM 堆大小超出安全范围。");
  return { kind: match[1].toLocaleLowerCase(), memoryMb };
}

function validateTuningFlag(value, javaMajor) {
  if (value === "-XX:+UseG1GC" || value === "-XX:+ParallelRefProcEnabled" || value === "-XX:+DisableExplicitGC") return value;
  if (value === "-XX:+UnlockExperimentalVMOptions") {
    if (javaMajor > 16) throw new Error("Java 17 及以上不接受旧版实验性 G1 参数解锁项。");
    return value;
  }
  const match = /^-XX:([A-Za-z][A-Za-z0-9]*)(?:=(\d{1,3})(M)?)$/u.exec(value);
  if (!match) throw new Error(`JVM 参数不在受支持的安全范围内：${value.slice(0, 80)}`);
  const [, name, rawNumber, suffix] = match;
  const number = Number(rawNumber);
  const limits = {
    MaxGCPauseMillis: [50, 1000], G1NewSizePercent: [5, 50], G1MaxNewSizePercent: [10, 80],
    G1ReservePercent: [10, 50], G1HeapWastePercent: [1, 50], G1MixedGCCountTarget: [1, 16],
    InitiatingHeapOccupancyPercent: [0, 100], G1MixedGCLiveThresholdPercent: [1, 100],
    G1RSetUpdatingPauseTimePercent: [0, 100], SurvivorRatio: [1, 100], MaxTenuringThreshold: [0, 15]
  };
  if (name === "G1HeapRegionSize") {
    if (suffix !== "M" || ![1, 2, 4, 8, 16, 32].includes(number)) throw new Error("G1HeapRegionSize 须使用 1、2、4、8、16 或 32M。");
    if (javaMajor > 16) throw new Error("Java 17 及以上沿用 JVM 默认 G1 区域大小，不接受旧版 Paper 调优项。");
    return value;
  }
  const range = limits[name];
  if (!range || suffix || number < range[0] || number > range[1]) throw new Error(`JVM 参数 ${name} 的值不受支持。`);
  if (name.startsWith("G1") || name === "SurvivorRatio" || name === "MaxTenuringThreshold") {
    if (javaMajor > 16) throw new Error("Java 17 及以上沿用 JVM 默认 G1 策略，不接受旧版 Paper 调优项。");
  }
  return value;
}

/** 校验完整编辑器并返回唯一持久化形状；传入参数永远不能覆盖服务端 JAR 或主类。 */
export function parseMinecraftJvmArguments(value, { javaMajor, coreType } = {}) {
  requireInteger(javaMajor, 8, 40, "实例 Java 主版本无效。");
  if (typeof value !== "string" || value.length > 8192) throw new Error("JVM 参数最多为 8 KiB。");
  const lines = value.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  if (lines.length > 24 || lines.some(line => line.length > 160 || /[\s\u0000-\u001f\u007f]/u.test(line))) throw new Error("每个 JVM 参数须独占一行，最多 24 项。");
  let initialHeapMb = null, memoryMb = null;
  const jvmArguments = [];
  const names = new Set();
  for (const line of lines) {
    const heap = parseHeapArgument(line);
    if (heap) {
      if (heap.kind === "s") {
        if (initialHeapMb !== null) throw new Error("只能设置一个 -Xms 初始堆值。");
        initialHeapMb = heap.memoryMb;
      } else {
        if (memoryMb !== null) throw new Error("只能设置一个 -Xmx 最大堆值。");
        memoryMb = heap.memoryMb;
      }
      continue;
    }
    const name = line.replace(/=.*$/u, "");
    if (names.has(name)) throw new Error(`JVM 参数不能重复：${name}`);
    names.add(name);
    jvmArguments.push(validateTuningFlag(line, javaMajor));
  }
  requireInteger(memoryMb, 1024, 32768, "请设置 1024–32768 MB 的 -Xmx 最大堆。");
  requireInteger(initialHeapMb, 512, memoryMb, "-Xms 初始堆须至少为 512 MB 且不大于 -Xmx。");
  if (jvmArguments.length > 20) throw new Error("可调 JVM 参数最多为 20 项。");
  const usesG1SpecificFlags = jvmArguments.some(value => /G1(?:New|MaxNew|Heap|Reserve|Mixed|RSet)|SurvivorRatio|MaxTenuringThreshold/u.test(value));
  if (usesG1SpecificFlags && !jvmArguments.includes("-XX:+UseG1GC")) throw new Error("G1 专属参数必须同时启用 -XX:+UseG1GC。");
  if (javaMajor <= 10 && usesG1SpecificFlags && !jvmArguments.includes("-XX:+UnlockExperimentalVMOptions")) throw new Error("Java 8–10 的旧版 G1 调优项需要 -XX:+UnlockExperimentalVMOptions。");
  const minimumNewSize = jvmArguments.find(value => value.startsWith("-XX:G1NewSizePercent="));
  const maximumNewSize = jvmArguments.find(value => value.startsWith("-XX:G1MaxNewSizePercent="));
  if (minimumNewSize && maximumNewSize && Number(minimumNewSize.split("=")[1]) > Number(maximumNewSize.split("=")[1])) {
    throw new Error("G1NewSizePercent 不能大于 G1MaxNewSizePercent。");
  }
  if (coreType === "PocketMine") throw new Error("PocketMine 使用 PHP，不支持 JVM 参数。");
  return { memoryMb, initialHeapMb, jvmArguments };
}

/** 兼容旧实例与新建实例的堆初值，保持既有最大堆语义。 */
export function defaultMinecraftInitialHeapMb(memoryMb, executionMode = "native") {
  requireInteger(memoryMb, 1024, 32768, "Minecraft 最大堆超出允许范围。");
  if (executionMode !== "native" && executionMode !== "appcontainer") throw new Error("Minecraft 执行方式无效。");
  // 迁移时保留两条既有启动器各自的 Xms 默认，后续保存后两条启动器统一读取此值。
  return executionMode === "native" ? Math.min(memoryMb, 1024) : Math.min(1024, Math.floor(memoryMb / 2));
}

/** 将已经验证的实例配置转换为固定 JVM 启动参数顺序。 */
export function buildMinecraftJvmArguments(configuration, { javaMajor, coreType } = {}) {
  const normalized = {
    memoryMb: configuration?.memoryMb,
    initialHeapMb: configuration?.initialHeapMb,
    jvmArguments: configuration?.jvmArguments
  };
  requireInteger(javaMajor, 8, 40, "实例 Java 主版本无效。");
  requireInteger(normalized.memoryMb, 1024, 32768, "Minecraft 最大堆超出允许范围。");
  requireInteger(normalized.initialHeapMb, 512, normalized.memoryMb, "Minecraft 初始堆配置无效。");
  if (!Array.isArray(normalized.jvmArguments) || normalized.jvmArguments.length > 20) throw new Error("Minecraft JVM 参数列表无效。");
  const tuning = normalized.jvmArguments.map(value => validateTuningFlag(value, javaMajor));
  // 通过同一解析合同校验 GC 依赖和重复项，不允许 Daemon 绕过 API 校验。
  const parsed = parseMinecraftJvmArguments([
    `-Xms${normalized.initialHeapMb}M`, `-Xmx${normalized.memoryMb}M`, ...tuning
  ].join("\n"), { javaMajor, coreType });
  return ["-Dfile.encoding=UTF-8", "-Dsun.stdout.encoding=UTF-8", "-Dsun.stderr.encoding=UTF-8", `-Xms${parsed.initialHeapMb}M`, `-Xmx${parsed.memoryMb}M`, ...parsed.jvmArguments];
}

/** 返回依目标 Java 与核心兼容的预设；高性能方案只给旧版 Paper/Java。 */
export function getMinecraftJvmPreset(preset, { javaMajor, coreType, memoryMb } = {}) {
  requireInteger(javaMajor, 8, 40, "实例 Java 主版本无效。");
  requireInteger(memoryMb, 1024, 32768, "Minecraft 最大堆超出允许范围。");
  const initialHeapMb = defaultMinecraftInitialHeapMb(memoryMb, "native");
  if (preset === "custom") return null;
  if (preset === "low-memory") return { initialHeapMb: Math.min(512, memoryMb), memoryMb, jvmArguments: [] };
  if (preset === "recommended") {
    const useLegacyPaper = coreType === "Paper" && javaMajor <= 16;
    return { initialHeapMb, memoryMb, jvmArguments: useLegacyPaper ? [...PAPER_RECOMMENDED_FLAGS] : [] };
  }
  if (preset === "high-performance") {
    if (coreType !== "Paper" || javaMajor > 16) return null;
    return { initialHeapMb, memoryMb, jvmArguments: [...PAPER_HIGH_PERFORMANCE_FLAGS] };
  }
  throw new Error("JVM 参数预设无效。");
}

export function serializeMinecraftJvmArguments(configuration) {
  return [`-Xms${configuration.initialHeapMb}M`, `-Xmx${configuration.memoryMb}M`, ...configuration.jvmArguments].join("\n");
}
