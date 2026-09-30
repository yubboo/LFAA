/**
 * 功能：为已登录的 LFAA 页面提供 Minecraft 实时变更通知。
 * 作用：在控制端 HTTP 服务上挂载 Socket.IO，并复用 HttpOnly 会话 Cookie 验证连接。
 * 关联文件：packages/host/webserver/src/server.ts、packages/credentials/authorization/src/middleware.ts、packages/api/gateway/src/index.ts。
 */
import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { resolveSocketSessionFromCookieHeader } from "lfaa-authorization/src/middleware.js";

export type MinecraftRealtimeScope = "logs" | "state" | "tasks";

export interface MinecraftRealtimeChange {
  scopes: MinecraftRealtimeScope[];
  instanceId?: string;
}

export interface MinecraftRealtimePublisher {
  publishMinecraftChange(scopes: MinecraftRealtimeScope[], instanceId?: string): void;
  disconnectSession(sessionId: string): void;
  disconnectUser(userId: string): void;
  close(callback?: () => void): void;
}

const minecraftUpdatesRoom = "lfaa:minecraft:updates";
const sessionRoom = (sessionId: string) => `lfaa:session:${sessionId}`;
const userRoom = (userId: string) => `lfaa:user:${userId}`;

export function createRealtimeSocketServer(httpServer: HttpServer): MinecraftRealtimePublisher {
  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    transports: ["websocket", "polling"]
  });

  io.use((socket, next) => {
    const resolved = resolveSocketSessionFromCookieHeader(socket.handshake.headers.cookie);
    if (!resolved) {
      next(new Error("登录会话无效，请重新登录。"));
      return;
    }

    const { session, expiresAt } = resolved;
    socket.data.userId = session.user.id;
    socket.data.role = session.user.role;
    socket.data.sessionId = session.sessionId;
    socket.data.expiresAt = expiresAt;
    next();
  });

  io.on("connection", (socket) => {
    void socket.join(minecraftUpdatesRoom);
    void socket.join(sessionRoom(socket.data.sessionId as string));
    void socket.join(userRoom(socket.data.userId as string));
    const expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(0, (socket.data.expiresAt as number) - Date.now()));
    expiryTimer.unref();
    socket.once("disconnect", () => clearTimeout(expiryTimer));
  });

  return {
    publishMinecraftChange(scopes, instanceId) {
      const change: MinecraftRealtimeChange = instanceId
        ? { scopes: [...scopes], instanceId }
        : { scopes: [...scopes] };
      io.to(minecraftUpdatesRoom).emit("minecraft:changed", change);
    },
    disconnectSession(sessionId) {
      io.in(sessionRoom(sessionId)).disconnectSockets(true);
    },
    disconnectUser(userId) {
      io.in(userRoom(userId)).disconnectSockets(true);
    },
    close(callback) {
      io.close(callback);
    }
  };
}
