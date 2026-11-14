/** API 调用方共用的简短错误文案回退。 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "发生了未知错误，请重试。";
}
