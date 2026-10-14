/** 官方资源使用独立代理传输；遵循 HTTPS_PROXY/HTTP_PROXY/NO_PROXY，不改变全局请求或 TLS。 */
import {EnvHttpProxyAgent} from "undici";
import {isRetryableDownloadError} from "./download.mjs";
export async function fetchRuntimeResource(value,options={}) {
  const url=new URL(value);
  if(url.protocol!=="https:"||url.username||url.password)throw new Error("运行环境仅接受无内嵌凭据的 HTTPS 来源。");
  for(let attempt=0;attempt<2;attempt++) {
    const dispatcher=new EnvHttpProxyAgent({connections:2,pipelining:1});
    try {
      const response=await fetch(url,{...options,dispatcher});
      // close 等待响应流结束再关闭连接；取消/异常则销毁，不遗留连接池。
      void dispatcher.close().catch(()=>dispatcher.destroy());
      if(attempt===0&&[408,425,429,500,502,503,504].includes(response.status)){await response.body?.cancel();continue;}
      return response;
    }catch(error){await dispatcher.destroy();if(options.signal?.aborted)throw options.signal.reason;if(attempt===0&&isRetryableDownloadError(error))continue;throw new Error(`官方来源网络连接失败（${error.cause?.code??error.code??"connection_error"}）。`,{cause:error});}
  }
}
