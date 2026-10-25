/** 文件任务的短期二进制传输界限，由控制端与 Daemon 共用。 */
export const maximumNodeFileTransferBytes = 3 * 1024 * 1024;
export const maximumRetainedNodeFileTransferBytes = 20 * 1024 * 1024;
export const nodeFileTransferLifetimeMilliseconds = 5 * 60 * 1000;
