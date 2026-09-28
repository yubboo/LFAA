/**
 * 功能：定义可安全返回给 API 调用方的业务错误。
 * 作用：将预期的校验、认证和冲突错误映射为 HTTP 状态码与中文提示。
 * 关联文件：server/src/api/routes.ts、server/src/index.ts。
 */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errorCode: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
