/** 功能：把 Typert 方法接入现有 API Gateway。作用：复用登录身份、请求取消和统一错误边界。关联文件：packages/typert/registry、packages/api/remotes/src/route-contracts.ts。 */
import { randomUUID } from "node:crypto";
import { type Response, type Router } from "express";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { asyncHandler, parseBody, typertRemoteCallSchema } from "lfaa-api-remotes/src/route-contracts.js";
import { TypertError } from "lfaa-typert-protocol/src/index.js";
import type { TypertRegistry } from "lfaa-typert-registry/src/index.js";

interface TypertRequestBody { input: unknown }

/** 只公开已登记的方法名；每次调用仍由方法自身授权器和输入/输出解析器决定是否可执行。 */
export function registerTypertRoutes(router: Router, registry: TypertRegistry): void {
  router.post("/typert/:namespace/:method", requireAuthentication, asyncHandler(async (request, response, next) => {
    const { namespace, method } = request.params;
    if (!isRemoteIdentifier(namespace) || !isRemoteIdentifier(method)) {
      response.status(404).json({ error: "method_not_found", message: "找不到远程方法。" });
      return;
    }

    const body = parseBody<TypertRequestBody>(typertRemoteCallSchema, request.body);
    const controller = new AbortController();
    const abortOnRequest = (): void => controller.abort();
    const abortOnResponseClose = (): void => { if (!response.writableEnded) controller.abort(); };
    if (request.aborted) controller.abort();
    request.once("aborted", abortOnRequest);
    response.once("close", abortOnResponseClose);

    try {
      const result = await registry.invoke(namespace, method, body.input, {
        requestId: requestIdOf(response),
        principal: request.auth,
        signal: controller.signal
      });
      if (!controller.signal.aborted && !response.destroyed) response.json({ result });
    } catch (error) {
      if (controller.signal.aborted || response.destroyed) return;
      if (error instanceof TypertError) {
        const mapped = mapTypertError(error);
        if (mapped) {
          response.status(mapped.status).json({ error: mapped.code, message: mapped.message });
          return;
        }
      }
      next(error);
    } finally {
      request.off("aborted", abortOnRequest);
      response.off("close", abortOnResponseClose);
    }
  }));
}

function requestIdOf(response: Response): string {
  const requestId = response.locals.requestId;
  return typeof requestId === "string" ? requestId : randomUUID();
}

function isRemoteIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length <= 128 && /^[a-z0-9][a-z0-9._-]*$/u.test(value);
}

function mapTypertError(error: TypertError): { status: number; code: string; message: string } | null {
  switch (error.code) {
    case "method_not_found": return { status: 404, code: "method_not_found", message: "找不到远程方法。" };
    case "invalid_input": return { status: 400, code: "invalid_remote_input", message: "远程方法参数不符合协议。" };
    case "forbidden": return { status: 403, code: "permission_denied", message: "当前账户无权调用此远程方法。" };
    case "cancelled": return { status: 408, code: "remote_call_cancelled", message: "远程调用已取消。" };
    case "closed": return { status: 503, code: "remote_registry_unavailable", message: "远程方法服务当前不可用。" };
    case "duplicate_method": return { status: 409, code: "remote_method_conflict", message: "远程方法登记冲突。" };
    case "invalid_contribution":
    case "invalid_output": return null;
  }
}
