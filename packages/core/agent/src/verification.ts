// 判断一次运行是否修改了需要验证的代码，以及命令是否属于构建/测试/类型检查这类验证动作。

const CODE_FILE_EXTENSION =
  /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json|java|kt|kts|gradle|xml|ya?ml|toml|py|go|rs|c|cc|cpp|h|hpp|cs|php|rb|sh|ps1|sql|css|scss|sass|less|vue|svelte)$/iu;

/** 路径看起来是需要构建或测试的代码/配置，而不是纯文档。 */
export function isCodePath(path: string | undefined): boolean {
  return Boolean(path && CODE_FILE_EXTENSION.test(path.trim()));
}

const VERIFY_RUNNERS =
  /\b(?:pnpm|npm|yarn|bun|npx|mvn|mvnw|gradle|gradlew|cargo|dotnet|pytest|jest|vitest|make|cmake|msbuild|go)\b/iu;
const VERIFY_ACTIONS =
  /\b(?:build|test|lint|check|typecheck|type-check|compile|package|verify|ci)\b/iu;

/** 命令是否属于构建/测试/类型检查等验证动作；用于完成前自检判断。 */
export function isVerificationCommand(command: string): boolean {
  const normalized = command.trim();
  if (!normalized) return false;
  if (/\btsc\b/iu.test(normalized)) return true;
  return VERIFY_RUNNERS.test(normalized) && VERIFY_ACTIONS.test(normalized);
}
