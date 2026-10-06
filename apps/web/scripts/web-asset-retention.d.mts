export function readWebAssetHistory(outputDirectory: string): Promise<string[][]>;

export function retainWebAssetGenerations(
  outputDirectory: string,
  currentAssetPaths: string[],
  previousGenerations?: string[][]
): Promise<{ generations: string[][]; removed: string[] }>;

export function createWebAssetRetentionPlugin(repositoryRoot: string): {
  name: string;
  apply: "build";
  configResolved(config: { root: string; build: { outDir: string } }): void;
  buildStart(): Promise<void>;
  writeBundle(this: { info(message: string): void }, options: unknown, bundle: Record<string, unknown>): Promise<void>;
};
