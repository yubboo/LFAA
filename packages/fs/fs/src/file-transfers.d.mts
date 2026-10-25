export const maximumNodeFileTransferBytes: number;

export class FileTransferLimitError extends Error {
  code: string;
}

export class FileTransferNotFoundError extends Error {}

export function receiveUserFileTransfer(input: {
  userId: string;
  name: string;
  source: AsyncIterable<Uint8Array> | Iterable<Uint8Array>;
  contentLength?: string | number | undefined;
}): Promise<{ id: string; name: string; size: number; sha256: string }>;

export function getUserUploadFileTransfer(input: { transferId: string; userId: string }): {
  name: string; size: number; sha256: string; bytes: Buffer;
};

export function receiveNodeFileTransfer(input: {
  task: { id: string; nodeId: string; createdBy: string; operation: string; status: string };
  nodeId: string;
  name: string;
  source: AsyncIterable<Uint8Array> | Iterable<Uint8Array>;
  contentLength?: string | number | undefined;
}): Promise<{ id: string; name: string; size: number; sha256: string }>;

export function bindFileTransferToNodeTask(input: { transferId: string; taskId: string; nodeId: string; userId: string }): void;
export function getNodeFileUploadTransfer(input: {
  transferId: string;
  task: { id: string; nodeId: string; createdBy: string; operation: string; status: string; payload: Record<string, unknown> };
}): { name: string; size: number; sha256: string; bytes: Buffer };
export function getUserFileTransfer(input: { transferId: string; userId: string }): {
  id: string; name: string; size: number; sha256: string; bytes: Buffer;
};
export function getNodeFileResultTransfer(input: {
  task: { id: string; nodeId: string; createdBy: string; operation: string; status: string };
}): { id: string; name: string; size: number; sha256: string; bytes: Buffer };
export function discardFileTransfer(input: { transferId: string; userId?: string; taskId?: string }): boolean;
export function discardNodeFileUploadTransfer(task: { id: string; operation: string; payload: Record<string, unknown> }): boolean;
export function discardUnboundUserFileTransfer(input: { transferId: string; userId: string }): boolean;
