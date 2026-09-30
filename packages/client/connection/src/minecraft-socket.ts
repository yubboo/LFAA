/**
 * 功能：建立 Minecraft 工作台到同源 LFAA 控制端的实时连接。
 * 作用：统一 Socket.IO 路径、Cookie 凭据与断线重连策略。
 * 关联文件：packages/client/ui-minecraft/src/MinecraftWorkspace.tsx、apps/web/vite.config.ts、packages/api/remotes/src/socket-server.ts。
 */
import { io, type Socket } from "socket.io-client";

export interface MinecraftRealtimeChange {
  scopes: Array<"logs" | "state" | "tasks">;
  instanceId?: string;
}

interface MinecraftServerEvents {
  "minecraft:changed": (change: MinecraftRealtimeChange) => void;
}

export function createMinecraftSocket(): Socket<MinecraftServerEvents> {
  return io({
    path: "/socket.io",
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 5000
  });
}
