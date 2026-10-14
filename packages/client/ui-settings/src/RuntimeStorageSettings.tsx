/** 功能：设置中心的节点环境存储覆盖。作用：以目标设备回报的路径为默认值，避免控制端绝对路径误用到远端。 */
import {useEffect,useState} from "react";
import {Alert,Button,Input,Select,Space,Typography} from "antd";
import {getErrorMessage} from "lfaa-client-connection/src/api.js";
import {loadRuntimeOverview,saveRuntimeStorage,type RuntimeOverview,type RuntimeStorage} from "lfaa-client-connection/src/runtime-api.js";
export function RuntimeStorageSettings() {
  const [devices,setDevices]=useState<RuntimeOverview["devices"]>([]),[target,setTarget]=useState("");
  const [draft,setDraft]=useState<RuntimeStorage|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
  useEffect(()=>{const controller=new AbortController();void loadRuntimeOverview(controller.signal).then(value=>{if(!controller.signal.aborted)setDevices(value.devices.filter(item=>item.id!=="local"));}).catch(reason=>{if(!controller.signal.aborted)setError(getErrorMessage(reason));});return()=>controller.abort();},[]);
  function select(id:string){setTarget(id);setDraft(devices.find(device=>device.id===id)?.storage??null);setSaved(false);setError("");}
  async function save(){if(!draft)return;setBusy(true);setError("");try{const result=await saveRuntimeStorage(target,draft);setDraft(result);setDevices(current=>current.map(device=>device.id===target?{...device,storage:result}:device));setSaved(true);}catch(reason){setError(getErrorMessage(reason));}finally{setBusy(false);}}
  return <section aria-label="节点环境存储"><Typography.Title level={4}>节点运行环境位置</Typography.Title><Typography.Paragraph>本机控制端使用项目存储设置；执行节点各自使用自己的数据目录或下方覆盖位置。保存不会搬迁已有环境。</Typography.Paragraph>{error?<Alert type="error" message={error}/>:null}{saved?<Alert type="success" message="节点位置已保存；下次执行按此位置准备环境。"/>:null}<Select aria-label="环境存储节点" value={target||undefined} onChange={select} disabled={busy} style={{width:"100%"}} placeholder="选择已登记节点" options={devices.map(device=>({value:device.id,label:`${device.displayName} · ${device.platform}/${device.architecture}`}))}/>{draft?<Space direction="vertical" style={{width:"100%",marginTop:12}}>{([["runtimeDirectory","节点运行环境目录"],["downloadCacheDirectory","节点下载缓存目录"],["temporaryDirectory","节点临时目录"]] as const).map(([field,label])=><label key={field}>{label}<Input aria-label={label} value={draft[field]} maxLength={2048} disabled={busy} onChange={event=>setDraft(current=>current?{...current,[field]:event.target.value}:current)}/></label>)}<Button type="primary" loading={busy} onClick={()=>void save()}>保存节点环境位置</Button></Space>:null}</section>;
}
