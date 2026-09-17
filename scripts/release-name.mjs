/**
 * 文件：release-name.mjs
 * 作用：根据 lfaa.release.json 生成用户可见发行包基础名称。
 * 不负责：真正打包、签名和上传。
 */

import fs from "node:fs";

const release = JSON.parse(fs.readFileSync("lfaa.release.json", "utf8"));
console.log(`${release.shortName}-v${release.displayVersion}`);
