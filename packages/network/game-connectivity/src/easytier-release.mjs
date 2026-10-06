/** 功能：固定 LFAA 支持的 EasyTier 官方运行包。作用：统一下载来源、平台、版本与摘要，不接受运行时覆盖。 */
export const EASYTIER_RUNTIME_RELEASE = Object.freeze({
  version: "2.6.4",
  tag: "v2.6.4",
  assetName: "easytier-windows-x86_64-v2.6.4.zip",
  url: "https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-windows-x86_64-v2.6.4.zip",
  sha256: "27af91e270e554709b048bd32327fefd2dfce5062ae1e8701af7550c6f525f84",
  sizeBytes: 32657720,
  maximumBytes: 40 * 1024 * 1024,
  installCapability: "connectivity-engine-install-v1",
  runtimeCapability: "connectivity-easytier-v2.6.4",
  platform: "win32",
  architecture: "x64",
  license: "LGPL-3.0"
});
