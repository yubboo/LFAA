/**
 * 功能：为 Express 请求增加通过服务端会话校验的身份信息。
 * 作用：让受保护的 API 在类型层面读取当前用户和登录会话编号。
 * 关联文件：packages/credentials/authorization/src/middleware.ts、packages/api/gateway/src/index.ts。
 */
import type { PublicUser } from "lfaa-identity-auth/src/service.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sessionId: string;
        user: PublicUser;
      };
    }
  }
}

export {};
