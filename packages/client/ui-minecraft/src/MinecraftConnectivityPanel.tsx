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
      开服和实例仍由 Minecraft 管理。玩家组网、穿透 Provider、自备线路与房间域名统一在 LFAA 联机服务中管理；它会读取当前账户下真实运行的 Minecraft Java 目标。
    </Typography.Paragraph>
    <Button type="primary" onClick={onOpenConnectivity}>打开联机服务</Button>
  </Card>;
}
