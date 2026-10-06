/** 功能：定义 Web 开发入口到 LFAA Control Plane 的同源请求代理。作用：让 DSH Runtime 与插件 Host API 复用唯一服务端。关联文件：vite.config.ts、packages/host/webserver。 */

interface ProxyServerEvents {
  on(event: string, listener: () => void): unknown;
}

type ProxyConfigure = (proxy: ProxyServerEvents) => void;

/** Keep upstream DSH and plugin routes on the authenticated Control Plane without rewriting their paths. */
export function createHarnessDevProxy(target: string, configure: ProxyConfigure) {
  const route = () => ({ target, configure });
  return {
    "/__dsh": route(),
    "/plugins": route(),
    "/wallpaper-engine": route(),
    "/api": route(),
    "/socket.io": { ...route(), ws: true }
  };
}
