/**
 * 功能：把 Minecraft 玩家联机入口交给独立的 LFAA 联机服务 App。
 * 作用：保持部署/实例 Owner 不变，避免在 Minecraft 中复制一套网络路由管理。
 * 关联文件：MinecraftWorkspace.tsx、packages/client/ui-connectivity/src/ConnectivityWorkspace.tsx。
 */
import { Button, Card, Typography } from "antd";

export function MinecraftConnectivityPanel({ onOpenConnectivity }: { onOpenConnectivity: () => void }) {
  return <Card className="minecraft-card">
    <Typography.Title level={4}>LFAA 联机服务</Typography.Title>
    <Typography.Paragraph type="secondary">
      开服和实例留在 Minecraft 管理；房间域名、Provider 与自备穿透在联机服务配置，目标读取账户下的真实 Minecraft Java 实例。
    </Typography.Paragraph>
    <Button type="primary" onClick={onOpenConnectivity}>打开联机服务</Button>
  </Card>;
}
