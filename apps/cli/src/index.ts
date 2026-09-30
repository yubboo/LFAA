/** 功能：启动 LFAA Harness。作用：把命令行指定的运行组合交给共享启动器。关联文件：packages/boot/app-boot/src/index.ts。 */
import { boot } from "lfaa-app-boot/src/index.js";
await boot(process.argv.slice(2));
