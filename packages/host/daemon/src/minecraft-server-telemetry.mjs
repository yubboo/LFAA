import { randomBytes } from "node:crypto";
import { createSocket } from "node:dgram";
import { createConnection } from "node:net";
import { performance } from "node:perf_hooks";

const statusProbeIntervalMs = 10_000;
const paperTpsIntervalMs = 60_000;
const paperTpsIdleMs = 1_500;
const paperTpsTimeoutMs = 8_000;
const statusProbeTimeoutMs = 2_000;
const maximumStatusPacketBytes = 64 * 1024;
const raknetMagic = Buffer.from("00ffff00fefefefefdfdfdfd12345678", "hex");

function encodeVarInt(value) {
  let remaining = value >>> 0;
  const bytes = [];
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining) byte |= 0x80;
    bytes.push(byte);
  } while (remaining);
  return Buffer.from(bytes);
}

function readVarInt(buffer, offset = 0) {
  let value = 0;
  for (let index = 0; index < 5; index += 1) {
    if (offset + index >= buffer.length) return null;
    const byte = buffer[offset + index];
    value |= (byte & 0x7f) << (index * 7);
    if ((byte & 0x80) === 0) return { value: value >>> 0, nextOffset: offset + index + 1 };
  }
  throw new Error("Minecraft 状态包长度编码无效。");
}

function framePacket(payload) {
  return Buffer.concat([encodeVarInt(payload.length), payload]);
}

function encodeMinecraftString(value) {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([encodeVarInt(bytes.length), bytes]);
}

function integerOrNull(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647 ? value : null;
}

function parseBedrockPlayerCount(value) {
  return typeof value === "string" && /^\d+$/u.test(value) ? integerOrNull(Number(value)) : null;
}

function versionOrNull(value) {
  if (typeof value !== "string") return null;
  const version = value.trim().replace(/[\u0000-\u001f\u007f]/gu, "").slice(0, 120);
  return version || null;
}

function parseJavaStatusPacket(packet) {
  const packetId = readVarInt(packet);
  if (!packetId || packetId.value !== 0) throw new Error("Minecraft 服务端返回了无效状态包。");
  const stringLength = readVarInt(packet, packetId.nextOffset);
  if (!stringLength || stringLength.value > maximumStatusPacketBytes) throw new Error("Minecraft 服务端状态响应过大。");
  const start = stringLength.nextOffset;
  const end = start + stringLength.value;
  if (end !== packet.length) throw new Error("Minecraft 服务端状态响应长度无效。");
  const response = JSON.parse(packet.subarray(start, end).toString("utf8"));
  return {
    onlinePlayers: integerOrNull(response?.players?.online),
    maxPlayers: integerOrNull(response?.players?.max),
    version: versionOrNull(response?.version?.name)
  };
}

export function queryJavaMinecraftServer(port, timeoutMs = statusProbeTimeoutMs) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return Promise.reject(new Error("Minecraft TCP 端口无效。"));
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let buffer = Buffer.alloc(0);
    let phase = "status";
    let pingStartedAt = 0;
    let pingTimestamp = 0n;
    let status = null;
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Minecraft 状态探测超时。")), timeoutMs);
    timer.unref?.();
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      error ? reject(error) : resolve(result);
    };
    const sendStatus = () => {
      const portBytes = Buffer.alloc(2);
      portBytes.writeUInt16BE(port, 0);
      const handshake = Buffer.concat([
        encodeVarInt(0), encodeVarInt(-1), encodeMinecraftString("127.0.0.1"), portBytes, encodeVarInt(1)
      ]);
      socket.write(Buffer.concat([framePacket(handshake), framePacket(encodeVarInt(0))]));
    };
    socket.once("error", error => finish(error));
    socket.once("connect", sendStatus);
    socket.on("data", chunk => {
      buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
      if (buffer.length > maximumStatusPacketBytes) return finish(new Error("Minecraft 状态响应超过大小限制。"));
      try {
        while (buffer.length) {
          const header = readVarInt(buffer);
          if (!header) return;
          if (header.value > maximumStatusPacketBytes) return finish(new Error("Minecraft 状态包超过大小限制。"));
          const packetEnd = header.nextOffset + header.value;
          if (buffer.length < packetEnd) return;
          const packet = buffer.subarray(header.nextOffset, packetEnd);
          buffer = buffer.subarray(packetEnd);
          const packetId = readVarInt(packet);
          if (!packetId) throw new Error("Minecraft 状态包 ID 不完整。");
          if (phase === "status" && packetId.value === 0) {
            status = parseJavaStatusPacket(packet);
            pingTimestamp = BigInt(Date.now());
            const ping = Buffer.alloc(9);
            ping[0] = 1;
            ping.writeBigInt64BE(pingTimestamp, 1);
            phase = "pong";
            pingStartedAt = performance.now();
            socket.write(framePacket(ping));
          } else if (phase === "pong" && packetId.value === 1) {
            if (packet.length !== packetId.nextOffset + 8 || packet.readBigInt64BE(packetId.nextOffset) !== pingTimestamp) throw new Error("Minecraft Ping 回包无效。");
            finish(null, { ...status, pingMs: Math.max(0, Math.round(performance.now() - pingStartedAt)) });
          } else {
            throw new Error("Minecraft 服务端状态包顺序无效。");
          }
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Minecraft 状态响应无效。"));
      }
    });
  });
}

export function queryBedrockMinecraftServer(port, timeoutMs = statusProbeTimeoutMs) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return Promise.reject(new Error("Minecraft UDP 端口无效。"));
  return new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    const pingTime = BigInt(Date.now());
    const clientGuid = randomBytes(8).readBigInt64LE();
    const request = Buffer.alloc(1 + 8 + raknetMagic.length + 8);
    request[0] = 0x01;
    request.writeBigInt64LE(pingTime, 1);
    raknetMagic.copy(request, 9);
    request.writeBigInt64LE(clientGuid, 9 + raknetMagic.length);
    const pingStartedAt = performance.now();
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Minecraft Bedrock 状态探测超时。")), timeoutMs);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      error ? reject(error) : resolve(result);
    };
    socket.on("error", error => finish(error));
    socket.on("message", response => {
      try {
        if (response.length < 35 || response[0] !== 0x1c || response.readBigInt64LE(1) !== pingTime || !response.subarray(17, 33).equals(raknetMagic)) {
          throw new Error("Minecraft Bedrock 状态响应无效。");
        }
        const stringLength = response.readUInt16BE(33);
        if (stringLength > 4096 || response.length < 35 + stringLength) throw new Error("Minecraft Bedrock 状态响应长度无效。");
        const fields = response.subarray(35, 35 + stringLength).toString("utf8").split(";");
        if (fields[0] !== "MCPE" && fields[0] !== "MCEE") throw new Error("Minecraft Bedrock 状态标识无效。");
        finish(null, {
          onlinePlayers: parseBedrockPlayerCount(fields[4]),
          maxPlayers: parseBedrockPlayerCount(fields[5]),
          version: versionOrNull(fields[3]),
          pingMs: Math.max(0, Math.round(performance.now() - pingStartedAt))
        });
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Minecraft Bedrock 状态响应无效。"));
      }
    });
    socket.send(request, port, "127.0.0.1", error => { if (error) finish(error); });
  });
}

export function queryMinecraftServer(coreType, port, timeoutMs = statusProbeTimeoutMs) {
  return ["Nukkit", "PocketMine"].includes(coreType)
    ? queryBedrockMinecraftServer(port, timeoutMs)
    : queryJavaMinecraftServer(port, timeoutMs);
}

export function parsePaperTpsOutput(line) {
  if (typeof line !== "string") return null;
  const normalized = line.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, "");
  const match = normalized.match(/\bTPS\s+from\s+last\b[^:\r\n]{0,100}:\s*(\d+(?:\.\d+)?)/iu);
  if (!match) return null;
  const tps = Number(match[1]);
  return Number.isFinite(tps) && tps >= 0 && tps <= 100 ? tps : null;
}

export function capturePaperTpsOutput(runtime, line, now = Date.now()) {
  if (runtime?.paperTpsPendingUntil === undefined || runtime.paperTpsPendingUntil === null) return false;
  const tps = parsePaperTpsOutput(line);
  if (tps === null) return false;
  runtime.paperTps = tps;
  runtime.paperTpsObservedAt = new Date(now).toISOString();
  runtime.paperTpsStatus = "available";
  runtime.paperTpsPendingUntil = null;
  return true;
}

export function requestPaperTps(runtime, now = Date.now()) {
  if (runtime?.coreType !== "Paper") return "unsupported";
  if (!runtime.serverReady || !(runtime.consoleSubscribers instanceof Map) || runtime.consoleSubscribers.size === 0) {
    runtime.paperTps = null;
    runtime.paperTpsObservedAt = null;
    runtime.paperTpsPendingUntil = null;
    runtime.paperTpsStatus = "waiting";
    return "waiting";
  }
  if (runtime.paperTpsPendingUntil !== null && runtime.paperTpsPendingUntil !== undefined) {
    if (now < runtime.paperTpsPendingUntil) return "pending";
    runtime.paperTpsPendingUntil = null;
    runtime.paperTps = null;
    runtime.paperTpsObservedAt = null;
    runtime.paperTpsStatus = "unavailable";
  }
  if (Number.isFinite(runtime.lastInteractiveInputAt) && now - runtime.lastInteractiveInputAt < paperTpsIdleMs) return runtime.paperTpsStatus ?? "waiting";
  if (Number.isFinite(runtime.paperTpsNextAt) && now < runtime.paperTpsNextAt) return runtime.paperTpsStatus ?? "waiting";
  if (typeof runtime.writeConsoleInput !== "function") return "unavailable";
  runtime.lastPaperTpsRequestedAt = now;
  runtime.paperTpsNextAt = now + paperTpsIntervalMs;
  runtime.paperTpsPendingUntil = now + paperTpsTimeoutMs;
  runtime.paperTps = null;
  runtime.paperTpsObservedAt = null;
  runtime.paperTpsStatus = "pending";
  try {
    Promise.resolve(runtime.writeConsoleInput("tps\r")).catch(() => {
      if (runtime.lastPaperTpsRequestedAt === now) {
        runtime.paperTpsPendingUntil = null;
        runtime.paperTpsStatus = "unavailable";
      }
    });
  } catch {
    runtime.paperTpsPendingUntil = null;
    runtime.paperTpsStatus = "unavailable";
  }
  return runtime.paperTpsStatus;
}

export function readMinecraftServerTelemetry(runtime, now = Date.now()) {
  if (!runtime?.serverReady || !Number.isInteger(runtime.serverPort)) return null;
  if (!(runtime.consoleSubscribers instanceof Map) || runtime.consoleSubscribers.size === 0) {
    requestPaperTps(runtime, now);
    runtime.minecraftStatusResult = null;
    return null;
  }
  if (runtime.statusProbePending !== true && now >= (runtime.statusProbeNextAt ?? 0)) {
    runtime.statusProbeNextAt = now + statusProbeIntervalMs;
    runtime.statusProbePending = true;
    const observedAt = new Date(now).toISOString();
    Promise.resolve(queryMinecraftServer(runtime.coreType, runtime.serverPort)).then(result => {
      runtime.minecraftStatusResult = { ...result, observedAt };
    }).catch(() => {
      runtime.minecraftStatusResult = { onlinePlayers: null, maxPlayers: null, version: null, pingMs: null, observedAt };
    }).finally(() => { runtime.statusProbePending = false; });
  }
  const tpsStatus = requestPaperTps(runtime, now);
  return {
    onlinePlayers: runtime.minecraftStatusResult?.onlinePlayers ?? null,
    maxPlayers: runtime.minecraftStatusResult?.maxPlayers ?? null,
    pingMs: runtime.minecraftStatusResult?.pingMs ?? null,
    advertisedVersion: runtime.minecraftStatusResult?.version ?? null,
    observedAt: runtime.minecraftStatusResult?.observedAt ?? null,
    processStartedAt: new Date(runtime.startedAt).toISOString(),
    tps: runtime.paperTps ?? null,
    tpsObservedAt: runtime.paperTpsObservedAt ?? null,
    tpsStatus
  };
}
