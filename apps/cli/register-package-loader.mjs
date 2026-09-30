/** 功能：注册工作区包解析器。作用：让源码与根 dist/apps/control-plane 使用同一组包名。关联文件：package-loader.mjs、CLI 入口与桌面外壳。 */
import { register } from "node:module";

register("./package-loader.mjs", import.meta.url);
