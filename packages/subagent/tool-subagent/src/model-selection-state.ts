/**
 * 功能：模型选择的运行期状态——记录每个账户上次选用的子代理模型。
 * 作用：跨多次委派保持一致的模型偏好，无需每次重复指定。
 * 关联文件：model-selection.ts、tool-subagent index.ts。
 */

/** 内存态模型选择记录。 */
export class ModelSelectionState {
  private readonly lastByUser = new Map<string, string>();

  remember(userId: string, modelId: string): void {
    this.lastByUser.set(userId, modelId);
  }

  lastUsed(userId: string): string | undefined {
    return this.lastByUser.get(userId);
  }

  clear(userId: string): void {
    this.lastByUser.delete(userId);
  }
}
