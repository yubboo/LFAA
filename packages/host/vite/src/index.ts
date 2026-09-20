/** Vite Host 的通用参数与 localhost 约束。 */
import type { Plugin, UserConfig } from "vite";

export interface LfaaViteHostOptions {
  readonly appRoot: string;
  readonly plugins: readonly Plugin[];
  readonly devPort?: number;
  readonly previewPort?: number;
}

export function createLfaaViteHostConfig(options: LfaaViteHostOptions): UserConfig {
  const devPort = Number.isFinite(options.devPort) ? options.devPort! : 5173;
  const previewPort = Number.isFinite(options.previewPort) ? options.previewPort! : 4173;
  return {
    root: options.appRoot,
    plugins: [...options.plugins],
    server: { host: "127.0.0.1", port: devPort, strictPort: true },
    preview: { host: "127.0.0.1", port: previewPort, strictPort: true },
  };
}
