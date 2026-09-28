/**
 * 功能：为 Express 请求增加通过服务端会话校验的身份信息。
 * 作用：让受保护的 API 在类型层面读取当前用户和登录会话编号。
 * 关联文件：server/src/middleware/auth.ts、server/src/api/routes.ts。
 */
import type { PublicUser } from "../modules/auth/service.js";

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
