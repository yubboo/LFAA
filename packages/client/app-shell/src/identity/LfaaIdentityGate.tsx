/**
 * 文件：packages/client/app-shell/src/identity/LfaaIdentityGate.tsx
 * 作用：LFAA 产品 Shell 的实例身份门禁，负责 First Run 与 Login 的第一屏交互。
 * 负责：bootstrap/me 恢复、首次超级管理员创建、登录、登出后回到 Login、加载与错误状态。
 * 不负责：密码散列、Cookie、用户管理、Workspace、Agent Runtime、业务 App Pack。
 * 状态归属：仅持有当前页面的临时表单/加载状态；身份长期真值归 Identity Host。
 * 对外接口：LfaaIdentityGate、IdentityClientHost。
 * 关联文件：@lfaa/identity、@lfaa/client-connection、packages/client/web/src/App.tsx。
 * 修改注意事项：密码只保存在受控表单生命周期内；不得写入 localStorage/sessionStorage/log。
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { InitializeSuperAdminInput, LfaaAuthenticatedUser, LfaaIdentityBootstrapState, LoginInput } from "@lfaa/identity";
import styles from "./IdentityGate.module.css";

export interface IdentityClientHost {
  bootstrapState(): Promise<LfaaIdentityBootstrapState>;
  initializeSuperAdmin(input: InitializeSuperAdminInput): Promise<LfaaAuthenticatedUser>;
  login(input: LoginInput): Promise<LfaaAuthenticatedUser>;
  me(): Promise<LfaaAuthenticatedUser>;
  logout(): Promise<void>;
}

type GateState = "loading" | "first-run" | "login" | "authenticated";

export function LfaaIdentityGate({ host, children }: { host: IdentityClientHost; children: (identity: LfaaAuthenticatedUser, logout: () => Promise<void>) => ReactNode }) {
  const [state, setState] = useState<GateState>("loading");
  const [identity, setIdentity] = useState<LfaaAuthenticatedUser | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const bootstrap = await host.bootstrapState();
        if (!active) return;
        if (!bootstrap.initialized) { setState("first-run"); return; }
        try {
          const current = await host.me();
          if (!active) return;
          setIdentity(current); setState("authenticated");
        } catch {
          if (active) setState("login");
        }
      } catch (caught) {
        if (active) { setError(caught instanceof Error ? caught.message : String(caught)); setState("login"); }
      }
    })();
    return () => { active = false; };
  }, [host]);

  const submitFirstRun = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) { setError("两次输入的密码不一致。"); return; }
    setBusy(true); setError(null);
    try {
      const current = await host.initializeSuperAdmin({ username, password, ...(displayName.trim() ? { displayName: displayName.trim() } : {}) });
      setPassword(""); setConfirmPassword(""); setIdentity(current); setState("authenticated");
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  };
  const submitLogin = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const current = await host.login({ username, password });
      setPassword(""); setIdentity(current); setState("authenticated");
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    try { await host.logout(); } finally { setIdentity(null); setPassword(""); setState("login"); }
  };

  if (state === "authenticated" && identity) return children(identity, logout);
  if (state === "loading") return <div className={styles.loading}><span className={styles.mark}>L</span><p>正在验证 LFAA 实例身份…</p></div>;

  const firstRun = state === "first-run";
  return (
    <main className={styles.page}>
      <section className={styles.visual} aria-label="LFAA 介绍">
        <div className={styles.brand}><span className={styles.mark}>L</span><strong>LFAA</strong></div>
        <div className={styles.hero}>
          <p className={styles.eyebrow}>{firstRun ? "FIRST RUN SETUP" : "LOCAL ACCESS"}</p>
          <h1>{firstRun ? "先为这台 LFAA 创建一把真正的钥匙。" : "欢迎回来。"}</h1>
          <p>{firstRun ? "第一个账户将成为此 LFAA 实例的超级管理员。初始化完成后，任何人都必须通过账号与权限验证才能进入工作区和调用本地 API。" : "登录后才能进入 App Hub、项目、Agent、插件、终端以及其他受保护能力。"}</p>
        </div>
        <div className={styles.securityNote}><span>本地实例安全</span><strong>Identity Gate → AuthSession → Host API Gate</strong></div>
      </section>
      <section className={styles.formPane}>
        <form className={styles.card} onSubmit={firstRun ? submitFirstRun : submitLogin}>
          <header><span className={styles.smallMark}>L</span><div><h2>{firstRun ? "初始化 LFAA" : "登录 LFAA"}</h2><p>{firstRun ? "创建 First Run 超级管理员" : "使用本地实例账户继续"}</p></div></header>
          <label><span>用户名</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" required minLength={3} maxLength={32} /></label>
          {firstRun ? <label><span>显示名称 <small>可选</small></span><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：二鱼" maxLength={80} /></label> : null}
          <label><span>密码</span><input type="password" autoComplete={firstRun ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={firstRun ? "至少 12 位" : "输入密码"} required minLength={12} maxLength={256} /></label>
          {firstRun ? <label><span>确认密码</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" required minLength={12} maxLength={256} /></label> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <button className={styles.primary} type="submit" disabled={busy}>{busy ? "正在处理…" : firstRun ? "创建超级管理员并进入 LFAA" : "登录"}</button>
          <p className={styles.hint}>{firstRun ? "初始化完成后，First Run 入口将永久关闭。超级管理员可在系统中创建其他用户、角色与权限。" : "账户属于当前 LFAA 实例，不等同于 OpenAI / DeepSeek 等模型提供商账户。"}</p>
        </form>
      </section>
    </main>
  );
}
