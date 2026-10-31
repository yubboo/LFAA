/**
 * 功能：Minecraft 控制台实时指标协议回归。
 * 作用：用本机 TCP/UDP 协议夹具验证真实 SLP/RakNet 往返与 Paper TPS 命令限频，不触碰用户实例。
 * 关联文件：packages/host/daemon/src/minecraft-server-telemetry.mjs。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:net";
import { createSocket } from "node:dgram";
import { capturePaperTpsOutput, parsePaperTpsOutput, queryBedrockMinecraftServer, queryJavaMinecraftServer, requestPaperTps } from "../../../packages/host/daemon/src/minecraft-server-telemetry.mjs";

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
    if (!(byte & 0x80)) return { value: value >>> 0, nextOffset: offset + index + 1 };
  }
  throw new Error("fixture varint invalid");
}

function frame(payload) {
  return Buffer.concat([encodeVarInt(payload.length), payload]);
}

function takeFrames(buffer) {
  const packets = [];
  while (buffer.length) {
    const header = readVarInt(buffer);
    if (!header || buffer.length < header.nextOffset + header.value) break;
    packets.push(buffer.subarray(header.nextOffset, header.nextOffset + header.value));
    buffer = buffer.subarray(header.nextOffset + header.value);
  }
  return { packets, rest: buffer };
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

test("Java 状态协议返回真实状态字段与 Ping 往返", async () => {
  const server = createServer(socket => {
    let buffer = Buffer.alloc(0);
    let statusSent = false;
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      const parsed = takeFrames(buffer);
      buffer = parsed.rest;
      if (!statusSent && parsed.packets.length >= 2) {
        statusSent = true;
        const json = Buffer.from(JSON.stringify({ version: { name: "Paper 1.20.4" }, players: { online: 12, max: 100 } }), "utf8");
        socket.write(frame(Buffer.concat([Buffer.from([0]), encodeVarInt(json.length), json])));
        return;
      }
      if (statusSent) {
        const ping = parsed.packets.find(packet => packet[0] === 1);
        if (!ping || ping.length !== 9) return;
        socket.write(frame(ping));
      }
    });
  });
  const port = await listen(server);
  try {
    const result = await queryJavaMinecraftServer(port, 1_000);
    assert.equal(result.onlinePlayers, 12);
    assert.equal(result.maxPlayers, 100);
    assert.equal(result.version, "Paper 1.20.4");
    assert.ok(Number.isInteger(result.pingMs) && result.pingMs >= 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("Bedrock RakNet 状态包读取实际版本、人数和 Ping", async () => {
  const server = createSocket("udp4");
  const port = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.bind(0, "127.0.0.1", () => resolve(server.address().port));
  });
  server.on("message", (request, remote) => {
    const status = Buffer.from("MCPE;Fixture;448;1.20.4;12;100;7;LFAA;1;0;20;1;", "utf8");
    const response = Buffer.alloc(35 + status.length);
    response[0] = 0x1c;
    response.writeBigInt64LE(request.readBigInt64LE(1), 1);
    response.writeBigInt64LE(7n, 9);
    raknetMagic.copy(response, 17);
    response.writeUInt16BE(status.length, 33);
    status.copy(response, 35);
    server.send(response, remote.port, remote.address);
  });
  try {
    const result = await queryBedrockMinecraftServer(port, 1_000);
    assert.equal(result.onlinePlayers, 12);
    assert.equal(result.maxPlayers, 100);
    assert.equal(result.version, "1.20.4");
    assert.ok(Number.isInteger(result.pingMs) && result.pingMs >= 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("Paper TPS 只在控制台空闲时限频查询并解析真实输出", async () => {
  const commands = [];
  const now = Date.now();
  const runtime = {
    coreType: "Paper",
    serverReady: true,
    consoleSubscribers: new Map([["terminal", {}]]),
    lastInteractiveInputAt: now - 500,
    writeConsoleInput: async command => { commands.push(command); }
  };
  assert.equal(parsePaperTpsOutput("TPS from last 1m, 5m, 15m: 19.8, 20.0, 19.9"), 19.8);
  assert.equal(parsePaperTpsOutput("TPS from last 1m, 5m, 15m: 120, 20.0, 19.9"), null);
  assert.equal(requestPaperTps(runtime, now), "waiting");
  assert.deepEqual(commands, []);
  runtime.lastInteractiveInputAt = now - 2_000;
  assert.equal(requestPaperTps(runtime, now + 2_000), "pending");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(commands, ["tps\r"]);
  assert.equal(capturePaperTpsOutput(runtime, "[Server thread/INFO]: TPS from last 1m, 5m, 15m: 19.8, 20.0, 19.9", now + 3_000), true);
  assert.equal(runtime.paperTps, 19.8);
  assert.equal(requestPaperTps(runtime, now + 4_000), "available");
  assert.deepEqual(commands, ["tps\r"]);
  runtime.consoleSubscribers.clear();
  assert.equal(requestPaperTps(runtime, now + 5_000), "waiting");
  assert.equal(runtime.paperTps, null);
  assert.equal(requestPaperTps({ ...runtime, coreType: "Vanilla" }, now + 70_000), "unsupported");
});
