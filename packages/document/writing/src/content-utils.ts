/** 功能：提供 Writing 正文的派生统计。作用：在文件迁移和服务返回中共用同一字数算法。关联文件：service.ts、local-files.ts。 */
export function countWritingWords(content: string): number {
  const cjkCharacters = [...content.matchAll(/\p{Script=Han}/gu)].length;
  const otherWords = [...content.replace(/\p{Script=Han}/gu, " ").matchAll(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)].length;
  return cjkCharacters + otherWords;
}
