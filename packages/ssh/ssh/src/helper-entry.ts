/**
 * 文件：helper-entry.ts
 * 功能：远端入口脚本（POSIX shell）——在命令输出末尾追加退出码哨兵行。
 * 作用：DSH 依赖远端部署的 Node helper 做长度帧 JSON RPC；Windows OpenSSH 环境通常没有
 *       该 helper，且 store 无 ssh2/node 运行时。等价做法：用一行 sh 包装远端命令，
 *       在其 stdout 之后打印 `__LFAA_SSH_EXIT__=<code>` 哨兵，由客户端解析退出码。
 * 边界：不向远端拷贝任何密钥；脚本只负责把退出码结构化回传。
 * 关联文件：packages/ssh/ssh/src/helper.ts、protocol.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/ssh/ssh/src/helper-entry.ts 的远端入口职责；实现改为 sh 哨兵方案。
 */

/** 退出码哨兵前缀（客户端据此从流尾部解析远端退出码）。 */
export const EXIT_SENTINEL = "__LFAA_SSH_EXIT__";

/**
 * 生成远端包装命令：先（可选）切目录，再执行用户命令，最后打印退出码哨兵。
 * 注意：cwd 已由调用方单引号转义；command 原样执行（远端登录 shell 解释）。
 */
export function buildRemoteWrappedCommand(command: string, cwd?: string): string {
  const cd = cwd === undefined ? "" : `cd '${cwd.replaceAll("'", `'\\''`)}' 2>/dev/null && `;
  // 用 { ... } 合并命令输出，$? 取命令退出码；哨兵打到 stdout 末尾。
  return `set +e; ${cd}{ ${command}; } 2>&1; code=$?; printf '\\n%s=%s\\n' '${EXIT_SENTINEL}' "$code"; exit 0`;
}
