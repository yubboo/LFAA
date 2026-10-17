import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDataDirectory, resolveHomeDirectory } from "../packages/util/home-paths/src/resolve-data-directory.mjs";

const defaultProjectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(process.argv[2] ?? defaultProjectRoot);
const argumentsAfterRoot = process.argv.slice(3);
const printLayout = argumentsAfterRoot.includes("--layout");
const configuredValueArgument = argumentsAfterRoot.find(argument => argument !== "--layout");
const environmentFile = resolve(projectRoot, ".env");
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const homeDirectory = resolveHomeDirectory(projectRoot, process.env.LFAA_HOME ?? "");
const dataDirectory = resolveDataDirectory(projectRoot, configuredValueArgument ?? process.env.LFAA_DATA_DIR ?? "", { lfaaHome: homeDirectory });
if (printLayout) {
  process.stdout.write(`${JSON.stringify({
    homeDirectory,
    pluginInstallDirectory: resolve(homeDirectory, "plugins"),
    defaultDataDirectory: resolve(homeDirectory, "data"),
    dataDirectory
  })}\n`);
} else {
  process.stdout.write(`${dataDirectory}\n`);
}
