/**
 * 功能：呈现设置中心里的本机账户列表。
 * 作用：只读查看管理员可访问的已有账户，不提供后续注册或新增账户入口。
 * 关联文件：frontend/src/api.ts、frontend/src/components/SettingsPage.tsx、frontend/src/styles/pages.css。
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Table, Typography, type TableColumnsType } from "antd";
import { getErrorMessage, loadUsers, type User, type UserRole } from "../api.js";

const columns: TableColumnsType<User> = [
  {
    title: "用户名",
    dataIndex: "username",
    key: "username"
  },
  {
    title: "角色",
    dataIndex: "role",
    key: "role",
    render: (role: UserRole) => <span className={`role-label role-label--${role}`}>{role === "admin" ? "管理员" : "普通账户"}</span>
  },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    key: "createdAt",
    render: (createdAt: string) => new Date(createdAt).toLocaleString("zh-CN")
  }
];

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadUsers();
      setUsers(result.users);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  return (
    <section className="admin-page admin-page--embedded" aria-labelledby="admin-heading">
      <div className="admin-page__heading">
        <div>
          <Typography.Title id="admin-heading" level={3}>已有账户</Typography.Title>
          <Typography.Paragraph>本机账户仅在首次初始化时创建超级管理员；此处只查看已有账户，不提供后续注册。</Typography.Paragraph>
        </div>
      </div>

      {error && <Alert className="page-alert" type="error" showIcon message={error} />}

      <div className="admin-grid">
        <Card className="content-card account-list-card" title="已有账户" extra={<Button onClick={() => void refreshUsers()}>刷新</Button>}>
          <Table<User>
            rowKey="id"
            columns={columns}
            dataSource={users}
            loading={loading}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            locale={{ emptyText: "暂无账户" }}
          />
          <Typography.Text type="secondary">升级前已存在的账户会保留；此版本不能再创建新账户。</Typography.Text>
        </Card>
      </div>
    </section>
  );
}

