/**
 * 文件：release-name.mjs
 * 作用：从 lfaa.release.json 读取当前版本并输出统一发布包名称。
 * 负责：发布名称格式化。
 * 不负责：修改版本号、创建 ZIP、发布 GitHub Release。
 * 状态归属：版本事实归 lfaa.release.json。
 * 对外接口：`pnpm run release:name` / `node scripts/release-name.mjs`。
 * 关联文件：lfaa.release.json、DEVELOPMENT.md、docs/RELEASES.md。
 * 修改注意事项：发布名规则变化必须与 Packaging/Versioning 文档同步。
 */
import fs from "node:fs";

const release = JSON.parse(fs.readFileSync("lfaa.release.json", "utf8"));
console.log(`${release.shortName}-v${release.displayVersion}`);
