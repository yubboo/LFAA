import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDataDirectory } from "../packages/util/home-paths/src/resolve-data-directory.mjs";

const defaultProjectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(process.argv[2] ?? defaultProjectRoot);
const configuredValueArgument = process.argv[3];
const environmentFile = resolve(projectRoot, ".env");
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

process.stdout.write(`${resolveDataDirectory(projectRoot, configuredValueArgument ?? process.env.LFAA_DATA_DIR ?? "")}\n`);
