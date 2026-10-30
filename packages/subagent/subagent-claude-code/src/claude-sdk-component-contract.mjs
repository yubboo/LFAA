/**
 * The desktop component is fetched only after an explicitly authorized Claude run.
 * Keep this version and SRI value aligned with pnpm-lock.yaml; the desktop packager
 * checks both before it emits the runtime manifest.
 */
export const CLAUDE_SDK_COMPONENT_PACKAGE = "@anthropic-ai/claude-agent-sdk-win32-x64";
export const CLAUDE_SDK_COMPONENT_VERSION = "0.3.310";
export const CLAUDE_SDK_COMPONENT_INTEGRITY = "sha512-zvrIApxPccTJc6gCOtw5hj27QjWhhTi3z5x5iMmf9f0LZAKR+9mrgENVeFL7PP7zRGdYVhhX2SahbzxN83L/eA==";
export const CLAUDE_SDK_COMPONENT_TARBALL_URL = "https://registry.npmjs.org/@anthropic-ai%2fclaude-agent-sdk-win32-x64/-/claude-agent-sdk-win32-x64-0.3.310.tgz";
