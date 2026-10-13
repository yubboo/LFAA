/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-session。
 * 会话准备：一个尚未发布到注册表的 Session 的独占生命周期，发布或回滚时释放 provider 侧状态。
 * 实现权威在 kernel.ts（SessionPreparation）；本模块按 DSH 形态重导出。
 *
 * 文件：preparation.ts
 * 功能：SessionPreparation。
 */
export { SessionPreparation } from "./kernel.js";
