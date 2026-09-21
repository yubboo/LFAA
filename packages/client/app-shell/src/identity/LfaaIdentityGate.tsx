/**
 * 文件：packages/client/app-shell/src/identity/LfaaIdentityGate.tsx
 * 作用：LFAA 产品 Shell 的实例身份门禁，负责 First Run 注册与 Login 第一屏交互。
 * 负责：bootstrap/me 恢复、首次超级管理员创建、登录、登出后回到 Login、加载与错误状态。
 * 不负责：密码散列、Cookie、用户管理、Workspace、Agent Runtime、业务 App Pack。
 * 状态归属：仅持有当前页面的临时表单/加载/密码可见状态；身份长期真值归 Identity Host。
 * 对外接口：LfaaIdentityGate、IdentityClientHost。
 * 关联文件：@lfaa/identity、@lfaa/client-connection、packages/client/web/src/App.tsx。
 * 修改注意事项：First Run 是唯一匿名注册入口；初始化完成后不得重新开放注册。密码只保存在受控表单生命周期内。
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { InitializeSuperAdminInput, LfaaAuthenticatedUser, LfaaIdentityBootstrapState, LoginInput } from "@lfaa/identity";
import "../product-surface.css";
import styles from "./IdentityGate.module.css";

export interface IdentityClientHost {
  bootstrapState(): Promise<LfaaIdentityBootstrapState>;
  initializeSuperAdmin(input: InitializeSuperAdminInput): Promise<LfaaAuthenticatedUser>;
  login(input: LoginInput): Promise<LfaaAuthenticatedUser>;
  me(): Promise<LfaaAuthenticatedUser>;
  logout(): Promise<void>;
}

type GateState = "loading" | "first-run" | "login" | "authenticated";

type FieldIconName = "user" | "profile" | "lock";

function FieldIcon({ name }: { name: FieldIconName }) {
  if (name === "lock") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10" width="13" height="10" rx="2.4"/><path d="M8.5 10V7.7a3.5 3.5 0 0 1 7 0V10"/></svg>;
  if (name === "profile") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.8 19c.8-3.4 2.9-5.2 6.2-5.2s5.4 1.8 6.2 5.2"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.2c.9-3.6 3.1-5.5 6.5-5.5s5.6 1.9 6.5 5.5"/></svg>;
}

function EyeIcon({ visible }: { visible: boolean }) {
  return visible
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z"/><circle cx="12" cy="12" r="2.3"/></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4 20 20M9.7 7.2A8.7 8.7 0 0 1 12 7c5.8 0 9 5 9 5a14 14 0 0 1-2.4 2.8M14.7 16.5c-.8.3-1.7.5-2.7.5-5.8 0-9-5-9-5a14.5 14.5 0 0 1 3-3.4"/></svg>;
}

export function LfaaIdentityGate({ host, children }: { host: IdentityClientHost; children: (identity: LfaaAuthenticatedUser, logout: () => Promise<void>) => ReactNode }) {
  const [state, setState] = useState<GateState>("loading");
  const [identity, setIdentity] = useState<LfaaAuthenticatedUser | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  if (state === "loading") return <div className={styles.loading}><span className={styles.mark}>L</span><span className={styles.loadingPulse}/><p>正在验证 LFAA 实例身份…</p></div>;

  const firstRun = state === "first-run";
  return (
    <main className={styles.page} data-mode={firstRun ? "register" : "login"}>
      <section className={styles.visual} aria-label="LFAA 介绍">
        <div className={styles.ambient} aria-hidden="true"><span/><span/><span/><span/></div>
        <div className={styles.brand}><span className={styles.mark}>L</span><strong>LFAA</strong><i/><small>YOUR AI WORKSPACE</small></div>
        <div className={styles.hero}>
          <p className={styles.eyebrow}>{firstRun ? "FIRST RUN · LOCAL ACCESS" : "WELCOME BACK"}</p>
          <h1>{firstRun ? <>开始你的<br/>LFAA 工作空间。</> : "欢迎回来。"}</h1>
          <p>{firstRun ? "创建这台实例唯一的首个本地管理员账户，在统一入口中连接创作、研究、工作与更多能力。" : "登录后进入你的工作区，连接项目、Agent、插件、终端与其他受保护能力。"}</p>
          <div className={styles.features}>
            <div><span>01</span><strong>集中工作</strong><small>在一个空间连接全部能力</small></div>
            <div><span>02</span><strong>激发创造</strong><small>与 AI 一起把目标推进到成果</small></div>
            <div><span>03</span><strong>安全可控</strong><small>本地身份与权限边界持续生效</small></div>
          </div>
        </div>
        <div className={styles.securityNote}><i/><span>本地安全访问 · 由 Identity Gate 保护</span><small>IDENTITY GATE — AUTHSESSION — HOST API GATE</small></div>
      </section>

      <section className={styles.formPane}>
        <div className={styles.formTopline}>更少的切换&nbsp;&nbsp;&nbsp;更专注的创造 <i/></div>
        <form className={styles.card} onSubmit={firstRun ? submitFirstRun : submitLogin}>
          <header className={styles.cardHeader}>
            <div className={styles.cardBrand}><span className={styles.smallMark}>L</span><div><strong>LFAA</strong><small>你的 AI 工作空间</small></div></div>
            <div className={styles.modeTabs} aria-label="身份入口状态"><span data-active={!firstRun}>登录</span><span data-active={firstRun}>注册</span></div>
          </header>
          <div className={styles.titleBlock}><h2>{firstRun ? "创建 LFAA 账户" : "登录 LFAA"}</h2><p>{firstRun ? "首次初始化 · 创建本地超级管理员" : "使用当前 LFAA 实例账户继续"}</p></div>

          <label className={styles.field}><span>用户名</span><div className={styles.inputShell}><FieldIcon name="user"/><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder={firstRun ? "请输入用户名" : "输入用户名"} required minLength={3} maxLength={32}/></div>{firstRun ? <small>3–32 个字符，用于登录当前本地实例</small> : null}</label>
          {firstRun ? <label className={styles.field}><span>显示名称 <small>可选</small></span><div className={styles.inputShell}><FieldIcon name="profile"/><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：二鱼" maxLength={80}/></div></label> : null}
          <label className={styles.field}><span>密码</span><div className={styles.inputShell}><FieldIcon name="lock"/><input type={showPassword ? "text" : "password"} autoComplete={firstRun ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={firstRun ? "至少 12 位" : "输入密码"} required minLength={12} maxLength={256}/><button className={styles.reveal} type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((value) => !value)}><EyeIcon visible={showPassword}/></button></div>{firstRun ? <small>至少 12 位；密码只在当前受控表单生命周期内存在</small> : null}</label>
          {firstRun ? <label className={styles.field}><span>确认密码</span><div className={styles.inputShell}><FieldIcon name="lock"/><input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" required minLength={12} maxLength={256}/><button className={styles.reveal} type="button" aria-label={showConfirmPassword ? "隐藏确认密码" : "显示确认密码"} onClick={() => setShowConfirmPassword((value) => !value)}><EyeIcon visible={showConfirmPassword}/></button></div></label> : null}

          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <button className={styles.primary} type="submit" disabled={busy}><span>{busy ? "正在处理…" : firstRun ? "创建账户并进入 LFAA" : "登录"}</span><b>→</b></button>
          <div className={styles.divider}><span/><small>{firstRun ? "仅用于首次初始化当前实例" : "本地账户访问"}</small><span/></div>
          <p className={styles.hint}>{firstRun ? "初始化完成后，匿名注册入口会永久关闭；其他用户由已授权管理员在系统内创建。" : "该账户只属于当前 LFAA 实例，不等同于 OpenAI / DeepSeek 等模型提供商账户。"}</p>
          <div className={styles.secureBadge}><span>⌾</span> 通过 Identity Gate 进行本地安全保护</div>
        </form>
      </section>
    </main>
  );
}
