/**
 * 文件：apps/web/src/main.ts
 * 作用：LFAA Web 产品启动入口。
 * 负责：把 DOM root 交给 @lfaa/client-web。
 * 不负责：产品 UI、Host API、Runtime、Terminal、Provider 或业务状态。
 * 状态归属：无业务状态。
 * 对外接口：无；由 index.html 作为浏览器入口加载。
 * 关联文件：packages/client/web/src/web-entry.tsx、apps/web/index.html。
 * 修改注意事项：这里只允许启动代码，新增业务必须进入 packages。
 */
import { LfaaWebEntry } from "@lfaa/client-web";

const root = document.getElementById("root");
if (!root) throw new Error("LFAA Web root not found");

new LfaaWebEntry(root).run();
