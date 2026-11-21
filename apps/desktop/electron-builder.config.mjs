// 桌面安装包配置（electron-builder）：以 apps/desktop 为工程目录，staging 在 .desktop-build/。
// 与 DSH 一致：打包配置属于桌面应用自身，不放在仓库根目录。
export default {
  appId: "com.lfaa.desktop",
  productName: "LFAA",
  // 显式锁定 Electron 版本：staging 目录不含 electron 依赖，无法从清单推导。
  electronVersion: "45.4.1",
  // 首版关闭 asar：规避 ESM + Cordis Loader 在 asar 内按包名解析的风险（方案 §7.3）。
  asar: false,
  npmRebuild: false,
  directories: {
    app: ".desktop-build/app",
    output: ".desktop-build/release",
    buildResources: "resources",
  },
  files: [
    "dist/**",
    "web/**",
    "desktop-host/**",
    "package.json",
    "node_modules/**",
  ],
  win: {
    icon: "resources/icon.ico",
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
      // 免安装 zip：安装器在个别机器上会被安全软件/占用目录卡住时，可直接解压运行。
      {
        target: "zip",
        arch: ["x64"],
      },
    ],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "LFAA",
    // 卸载不删除 ~/.lfaa：用户的项目与会话数据必须保留。
    deleteAppDataOnUninstall: false,
    runAfterFinish: true,
    artifactName: "LFAA-${version}-setup.${ext}",
  },
};