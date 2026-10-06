/** 功能：定义存储枢纽的稳定错误码。作用：让调用方按错误类别恢复，不依赖报错文本。 */
export type StorageErrorCode =
  | "backend-not-found"
  | "form-not-mounted"
  | "duplicate-backend"
  | "duplicate-mount"
  | "version-mismatch"
  | "malformed-medium"
  | "backend-not-ready"
  | "closed";

export class StorageError extends Error {
  override readonly name = "StorageError";

  constructor(readonly code: StorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
  }
}
