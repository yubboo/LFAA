//! 文件：crates/secret-store/src/bin/lfaa-secret-broker.rs
//! 作用：LFAA Secret Broker 可执行入口。
//! 负责：调用 lfaa_secret_store::broker_main，并把退出码返回宿主。
//! 不负责：Secret 业务、Provider、UI、日志。
//! 状态归属：无状态。
//! 对外接口：二进制 `lfaa-secret-broker`。
//! 关联文件：../lib.rs、apps/web/dev/bridges/ai/rust-secret-store.ts。
//! 修改注意事项：禁止新增 argv Secret、环境变量 Secret 或调试输出。

fn main() {
    std::process::exit(lfaa_secret_store::broker_main());
}
