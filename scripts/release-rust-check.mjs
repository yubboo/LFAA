/**
 * 文件：release-rust-check.mjs
 * 作用：把 Rust workspace 的真实编译与测试纳入统一发布门禁。
 * 负责：确认 Cargo 可用，并依次执行 cargo check --workspace 与 cargo test --workspace。
 * 不负责：安装 Rust、修改 Rust 业务代码、替代 Windows Setup 的工具链准备。
 * 状态归属：Rust 版本由 rust-toolchain.toml 管理；本脚本只执行检查。
 * 对外接口：`node scripts/release-rust-check.mjs`。
 * 关联文件：Cargo.toml、rust-toolchain.toml、package.json、scripts/windows/lfaa-setup.ps1。
 * 修改注意事项：任一 Cargo 命令失败必须原样返回非零，禁止吞掉失败或伪造通过。
 */
import { spawnSync } from "node:child_process";

function runCargo(args, label) {
  console.log(`[LFAA] ${label}`);
  const result = spawnSync("cargo", args, { stdio: "inherit", windowsHide: true });
  if (result.error) throw new Error(`无法启动 cargo：${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label}失败，退出码：${result.status ?? "unknown"}`);
}

try {
  runCargo(["check", "--workspace", "--locked"], "Rust cargo check --workspace --locked");
  runCargo(["test", "--workspace", "--locked"], "Rust cargo test --workspace --locked");
  console.log("[LFAA] Rust 发布检查通过。");
} catch (error) {
  console.error(`[LFAA] Rust 发布检查失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
