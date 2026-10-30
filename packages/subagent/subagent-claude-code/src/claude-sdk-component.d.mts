export interface ClaudeSdkComponentOptions {
  manifestPath?: string;
  homeDirectory?: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  onProgress?: (message: string) => void;
}

export function ensureClaudeSdkExecutable(options?: ClaudeSdkComponentOptions): Promise<string | undefined>;
