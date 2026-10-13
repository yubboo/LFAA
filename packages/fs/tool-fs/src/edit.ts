/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-fs/src/edit.ts。
 * 功能：精确字符串编辑的参数校验与结果格式化（共享合同）。
 * 分工说明（重要，避免工具 id 冲突）：
 *   DSH 的 edit 工具与 LFAA 已有的 tool-str-replace-editor（模型工具 lfaa_str_replace，id fs.str-replace）语义一致；
 *   为避免重复注册同名/同功能工具，本包不再注册第二个编辑工具，而是把 edit 的参数校验与成功文案收敛在此，
 *   供 write.ts 的 diff 与 tool-str-replace-editor 复用。真正面向模型的编辑工具在 lfaa-tool-str-replace-editor。
 * 关联文件：packages/fs/tool-str-replace-editor/src/index.ts、diff.ts。
 */

/** 校验 edit 参数：path 非空、old_string 非空、old !== new、replace_all 默认 false。 */
export function parseEditArgs(args: { path: string; old_string: string; new_string: string; replace_all?: boolean }): {
  path: string;
  oldString: string;
  newString: string;
  replaceAll: boolean;
} {
  if (typeof args.path !== "string" || args.path.trim().length === 0) throw new Error("path 为必填非空字符串。");
  if (typeof args.old_string !== "string" || args.old_string.length === 0) throw new Error("old_string 为必填且不能为空。");
  if (typeof args.new_string !== "string") throw new Error("new_string 必须是字符串。");
  if (args.old_string === args.new_string) throw new Error("old_string 与 new_string 相同，这是空操作。");
  return { path: args.path, oldString: args.old_string, newString: args.new_string, replaceAll: args.replace_all === true };
}

/** 编辑成功的模型可见文案。 */
export function formatEditOutput(display: string, replaceAll: boolean): string {
  return replaceAll
    ? `文件 ${display} 已更新：所有匹配处均已替换。`
    : `文件 ${display} 已更新。`;
}
