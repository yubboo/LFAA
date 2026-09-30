/**
 * 功能：呈现设置中心里的本机账户管理。
 * 作用：供超级管理员搜索、筛选、新建、编辑、删除账户并转移超级管理员权限。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-settings/src/SettingsPage.css、packages/identity/auth/src/service.ts。
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Empty, Form, Input, Modal, Pagination, Popconfirm, Popover, Select, Space, Spin, Typography, message } from "antd";
import {
  createManagedUser,
  deleteManagedUser,
  getErrorMessage,
  loadUsers,
  transferSuperAdmin,
  updateManagedUser,
  userRoleLabel,
  type ManagedUserInput,
  type User,
  type UserRole,
  type UserSearchFilters
} from "lfaa-client-connection/src/api.js";

interface UserEditorFields {
  username: string;
  email?: string;
  role: Exclude<UserRole, "super_admin">;
  password?: string;
}

interface AccountFilters {
  search: string;
  role?: UserRole;
  createdFrom: string;
  createdTo: string;
}

const emptyFilters: AccountFilters = { search: "", role: undefined, createdFrom: "", createdTo: "" };
const usersPerPage = 8;

function localDayBoundary(day: string, end: boolean): string | undefined {
  if (!day) return undefined;
  const date = new Date(`${day}T00:00:00`);
  if (end) date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function asFilters(filters: AccountFilters): UserSearchFilters {
  return {
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.role ? { role: filters.role } : {}),
    ...(localDayBoundary(filters.createdFrom, false) ? { createdFrom: localDayBoundary(filters.createdFrom, false) } : {}),
    ...(localDayBoundary(filters.createdTo, true) ? { createdTo: localDayBoundary(filters.createdTo, true) } : {})
  };
}

export function AdminUsersPage({ userId }: { userId: string }) {
  const [messageApi, messageContext] = message.useMessage();
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AccountFilters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm<UserEditorFields>();

  const refreshUsers = useCallback(async (nextFilters: UserSearchFilters = {}, showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = await loadUsers(nextFilters);
      setUsers(result.users);
      setPage((current) => Math.min(current, Math.max(1, Math.ceil(result.users.length / usersPerPage))));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  function openEditor(user?: User): void {
    setEditingUser(user ?? null);
    form.setFieldsValue({
      username: user?.username ?? "",
      email: user?.email ?? "",
      role: user?.role === "member" ? "member" : "admin",
      password: ""
    });
    setEditorOpen(true);
  }

  async function saveUser(): Promise<void> {
    let values: UserEditorFields;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const base: ManagedUserInput = {
      username: values.username.trim(),
      email: values.email?.trim() || null
    };
    if (!editingUser || editingUser.role !== "super_admin") base.role = values.role;

    setBusy(true);
    try {
      if (editingUser) {
        await updateManagedUser(editingUser.id, base);
        messageApi.success("账户资料已更新。");
      } else {
        await createManagedUser({ ...base, role: values.role, password: values.password ?? "" });
        messageApi.success("账户已创建。");
      }
      setEditorOpen(false);
      await refreshUsers(asFilters(filters), false);
    } catch (saveError) {
      const messageText = getErrorMessage(saveError);
      setError(messageText);
      messageApi.error(messageText);
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(user: User): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await deleteManagedUser(user.id);
      messageApi.success(`已删除账户 UID ${user.uid}。`);
      await refreshUsers(asFilters(filters), false);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  }

  async function moveSuperAdmin(user: User): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await transferSuperAdmin(user.id);
      // 当前账户会立刻降为管理员；刷新应用以读取服务端的新角色和权限。
      window.location.reload();
    } catch (transferError) {
      setError(getErrorMessage(transferError));
      setBusy(false);
    }
  }

  function applyFilters(nextFilters: AccountFilters = filters): void {
    if (nextFilters.createdFrom && nextFilters.createdTo && nextFilters.createdFrom > nextFilters.createdTo) {
      setError("创建时间范围的开始日期不能晚于结束日期。");
      return;
    }
    setPage(1);
    setFilterOpen(false);
    void refreshUsers(asFilters(nextFilters));
  }

  function resetFilters(): void {
    setFilters(emptyFilters);
    setPage(1);
    setFilterOpen(false);
    void refreshUsers();
  }

  const advancedFilterCount = [filters.role, filters.createdFrom, filters.createdTo].filter(Boolean).length;

  return (
    <section className="admin-page admin-page--embedded" aria-labelledby="admin-heading">
      {messageContext}
      <div className="admin-page__heading">
        <div>
          <Typography.Title id="admin-heading" level={3}>账户管理</Typography.Title>
          <Typography.Paragraph>UID 从 1 开始分配；删除账户后，空出的最小 UID 会优先分配给新账户。</Typography.Paragraph>
        </div>
      </div>

      {error && <Alert className="page-alert" type="error" showIcon message={error} closable onClose={() => setError(null)} />}

      <div className="admin-grid">
        <Card className="content-card account-list-card" title={`账户列表 · ${users.length}`} extra={<Space wrap>
          <Button onClick={() => void refreshUsers(asFilters(filters))}>刷新</Button>
          <Button type="primary" onClick={() => openEditor()}>新增用户</Button>
        </Space>}>
          <Space className="account-user-filter-bar" wrap>
            <Input.Search
              className="account-user-search"
              aria-label="搜索 UID、用户名或邮箱"
              maxLength={254}
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              onSearch={(search) => applyFilters({ ...filters, search })}
              placeholder="搜索 UID、用户名或邮箱"
              enterButton="搜索"
            />
            <Popover
              title="高级筛选"
              trigger="click"
              placement="bottomRight"
              open={filterOpen}
              onOpenChange={setFilterOpen}
              getPopupContainer={(trigger) => (trigger.closest(".settings-page") as HTMLElement | null) ?? document.body}
              content={<div className="account-user-advanced-filters">
                <label className="account-user-advanced-filters__label" htmlFor="account-role-filter">角色</label>
                <Select id="account-role-filter" aria-label="按角色筛选" allowClear value={filters.role} onChange={(role: UserRole | undefined) => setFilters((current) => ({ ...current, role }))} placeholder="全部角色" options={[
                  { value: "super_admin", label: "超级管理员" },
                  { value: "admin", label: "管理员" },
                  { value: "member", label: "普通账户" }
                ]} />
                <label className="account-user-advanced-filters__label">创建时间</label>
                <div className="account-user-advanced-filters__dates">
                  <Input aria-label="创建开始日期" type="date" value={filters.createdFrom} onChange={(event) => setFilters((current) => ({ ...current, createdFrom: event.target.value }))} />
                  <Input aria-label="创建结束日期" type="date" value={filters.createdTo} onChange={(event) => setFilters((current) => ({ ...current, createdTo: event.target.value }))} />
                </div>
                <Space className="account-user-advanced-filters__actions">
                  <Button type="primary" onClick={() => applyFilters()}>应用筛选</Button>
                  <Button onClick={resetFilters}>重置筛选</Button>
                </Space>
              </div>}
            >
              <Button aria-expanded={filterOpen}>高级筛选{advancedFilterCount ? ` · ${advancedFilterCount}` : ""}</Button>
            </Popover>
            <Button onClick={resetFilters}>重置</Button>
          </Space>
          <Spin spinning={loading}>
            <div className="account-user-grid">
              {users.length ? users.slice((page - 1) * usersPerPage, page * usersPerPage).map((user) => <article className={`account-user-card${user.role === "super_admin" ? " account-user-card--super-admin" : ""}`} key={user.id}>
                <div className="account-user-card__topline">
                  <span className="account-user-card__uid">UID <strong>{user.uid}</strong></span>
                  <span className={`role-label role-label--${user.role === "member" ? "member" : "admin"}`}>{userRoleLabel(user.role)}</span>
                </div>
                <div className="account-user-card__identity">
                  <span className="account-user-card__avatar" aria-hidden="true">{Array.from(user.username)[0]?.toLocaleUpperCase("zh-CN")}</span>
                  <div className="account-user-card__identity-copy">
                    <Typography.Title level={4}>{user.username}</Typography.Title>
                    <Typography.Text type="secondary">{user.email || "未设置邮箱"}</Typography.Text>
                  </div>
                </div>
                <div className="account-user-card__created">
                  <Typography.Text type="secondary">创建时间</Typography.Text>
                  <Typography.Text>{new Date(user.createdAt).toLocaleString("zh-CN")}</Typography.Text>
                </div>
                <Space className="account-user-card__actions" wrap size="small">
                  <Button size="small" disabled={busy} onClick={() => openEditor(user)}>编辑</Button>
                  {user.role !== "super_admin" ? <Popconfirm
                    title="转移超级管理员权限？"
                    description={`UID ${user.uid} 将成为超级管理员，你的账户会降为管理员。`}
                    okText="确认转移"
                    cancelText="取消"
                    onConfirm={() => void moveSuperAdmin(user)}
                    getPopupContainer={(trigger) => (trigger.closest(".settings-page") as HTMLElement | null) ?? document.body}
                  ><Button size="small" disabled={busy}>转移权限</Button></Popconfirm> : null}
                  <Popconfirm
                    title={`删除 UID ${user.uid} 的账户？`}
                    description="删除会移除该账户的数据并释放这个 UID。此操作不能撤销。"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => void removeUser(user)}
                    getPopupContainer={(trigger) => (trigger.closest(".settings-page") as HTMLElement | null) ?? document.body}
                  ><Button size="small" danger disabled={busy || user.id === userId || user.role === "super_admin"}>删除</Button></Popconfirm>
                </Space>
              </article>) : <Empty description="没有符合条件的账户" />}
            </div>
          </Spin>
          <Pagination
            className="account-user-pagination"
            current={page}
            pageSize={usersPerPage}
            total={users.length}
            hideOnSinglePage
            showSizeChanger={false}
            onChange={setPage}
          />
        </Card>
      </div>

      <Modal
        title={editingUser ? `编辑账户 · UID ${editingUser.uid}` : "新增账户"}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={() => void saveUser()}
        confirmLoading={busy}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        getContainer={() => document.querySelector<HTMLElement>(".settings-page") ?? document.body}
      >
        <Form<UserEditorFields> form={form} layout="vertical" preserve={false}>
          <Form.Item name="username" label="用户名" rules={[
            { required: true, message: "请输入用户名。" },
            { min: 3, max: 32, message: "用户名长度需为 3 至 32 个字符。" },
            { pattern: /^[\p{L}\p{N}_.-]+$/u, message: "用户名只能包含文字、数字、下划线、点和连字符。" }
          ]}>
            <Input maxLength={32} autoComplete="off" />
          </Form.Item>
          <Form.Item name="email" label="邮箱（可选）" rules={[{ validator: async (_rule, value: string | undefined) => {
            if (!value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) return;
            throw new Error("请输入有效邮箱地址。");
          } }]}>
            <Input maxLength={254} autoComplete="email" />
          </Form.Item>
          {editingUser?.role === "super_admin" ? <Form.Item label="角色"><Input value="超级管理员（请通过转移操作变更）" disabled /></Form.Item> : <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={[{ value: "admin", label: "管理员" }, { value: "member", label: "普通账户" }]} />
          </Form.Item>}
          {!editingUser ? <Form.Item name="password" label="初始密码" extra="至少 8 位，并包含至少 3 类字符。" rules={[
            { required: true, message: "请输入初始密码。" },
            { min: 8, max: 128, message: "密码长度需为 8 至 128 位。" },
            { validator: async (_rule, value: string | undefined) => {
              if (!value) return;
              const groups = [/\p{Lu}/u, /\p{Ll}/u, /\p{N}/u, /[\p{P}\p{S}]/u, /\p{Lo}/u].filter((pattern) => pattern.test(value)).length;
              if (Array.from(value).length < 8 || groups < 3) throw new Error("密码至少需要 8 位，并包含至少 3 类字符。");
            } }
          ]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item> : null}
        </Form>
      </Modal>
    </section>
  );
}
