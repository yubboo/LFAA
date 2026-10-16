/** 功能：展示节点 data 派生的环境分类目录。作用：只读真实 Owner 位置，不再提供三套独立根设置；关联文件：runtime-api、SettingsPage、Runtime Manager。 */
import {useEffect,useState} from "react";
import {Alert,Select,Space,Typography} from "antd";
import {getErrorMessage} from "lfaa-client-connection/src/api.js";
import {loadRuntimeOverview,type RuntimeOverview} from "lfaa-client-connection/src/runtime-api.js";
export function RuntimeStorageSettings() {
  const [devices,setDevices]=useState<RuntimeOverview["devices"]>([]),[target,setTarget]=useState(""),[error,setError]=useState("");
  useEffect(()=>{const controller=new AbortController();void loadRuntimeOverview(controller.signal).then(value=>{if(!controller.signal.aborted)setDevices(value.devices.filter(item=>item.id!=="local"));}).catch(reason=>{if(!controller.signal.aborted)setError(getErrorMessage(reason));});return()=>controller.abort();},[]);
  const storage=devices.find(device=>device.id===target)?.storage;
  return <section aria-label="节点环境存储"><Typography.Title level={4}>节点数据目录</Typography.Title><Typography.Paragraph>每台节点使用自己的 data 根；环境、下载缓存和临时文件统一使用其中的 environments、cache 和 tmp 子目录，无需单独配置。</Typography.Paragraph>{error?<Alert type="error" message={error}/>:null}<Select aria-label="环境存储节点" value={target||undefined} onChange={setTarget} style={{width:"100%"}} placeholder="选择已登记节点" options={devices.map(device=>({value:device.id,label:device.displayName}))}/>{storage?<Space direction="vertical" style={{width:"100%",marginTop:12}}>{([["runtimeDirectory","运行环境"],["downloadCacheDirectory","下载缓存"],["temporaryDirectory","临时文件"]] as const).map(([field,label])=><div key={field}><Typography.Text>{label}：</Typography.Text><Typography.Text code copyable>{storage[field]}</Typography.Text></div>)}</Space>:null}</section>;
}
