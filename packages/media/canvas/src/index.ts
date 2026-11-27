// 无限画布宿主插件入口，供 Cordis Loader 与 HTTP 装配使用。
import { CanvasService } from "./canvas-service";

export { CanvasService };
export { CanvasError } from "./graph";
export { maxAssetBytes } from "./canvas-store";

declare module "@deepseek-ai/cordis" {
  interface Context {
    canvas: CanvasService;
  }
}

export default CanvasService;
