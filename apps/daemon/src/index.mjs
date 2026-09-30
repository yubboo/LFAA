/** 功能：启动节点 Harness。作用：使用 daemon profile 装配节点插件。关联文件：app-boot、bundle/daemon-app。 */
import { boot } from "lfaa-app-boot/src/index.js";
await boot(["--profile", "daemon"]);
