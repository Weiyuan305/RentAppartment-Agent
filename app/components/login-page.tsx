"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Use full navigation for the vinext production router. */
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Footprints, Globe2, LoaderCircle, MapPin, Sparkles } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { authClient } from "@/lib/auth-client";
import { safeReturnPath } from "@/lib/i18n";
import { cities } from "@/lib/rental-data";
import { useLocale } from "./locale-provider";
import { LanguageSwitch } from "./language-switch";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./ui/input-group";
import { Alert, AlertDescription } from "./ui/alert";
import { GoogleAccountLink, GoogleAuthButton, googleLinkPath } from "./google-auth";

const authErrors:Record<string,string> = {
  INVALID_EMAIL_OR_PASSWORD:"邮箱或密码不正确。", USER_ALREADY_EXISTS:"这个邮箱已注册，请直接登录。",USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:"这个邮箱已注册，请直接登录。",
  PASSWORD_TOO_SHORT:"密码至少需要 8 个字符。", PASSWORD_TOO_LONG:"密码不能超过 128 个字符。", INVALID_EMAIL:"请输入有效的邮箱地址。",
  TOO_MANY_REQUESTS:"尝试次数过多，请稍后再试。",AUTH_UNAVAILABLE:"登录服务暂时不可用，请稍后重试。",
};
export function LoginPage({googleEnabled=false,linkGoogle=false,initialError=""}:{googleEnabled?:boolean;linkGoogle?:boolean;initialError?:string}) {
  const {t} = useLocale();
  const {data:session,isPending:sessionPending} = authClient.useSession();
  const [mode,setMode] = useState<"login"|"signup">("login");
  const [name,setName] = useState(""); const [email,setEmail] = useState(""); const [password,setPassword] = useState("");
  const [showPassword,setShowPassword] = useState(false);const [busy,setBusy] = useState(false);const [error,setError] = useState(initialError);
  const [formError,setFormError] = useState(false);
  const linking = linkGoogle && !!session?.user;
  function destination(){return safeReturnPath(new URLSearchParams(location.search).get("next"));}
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;setBusy(true);setError("");setFormError(false);
    try {
      const result = mode === "signup" ? await authClient.signUp.email({name:name.trim(),email:email.trim(),password}) : await authClient.signIn.email({email:email.trim(),password,rememberMe:true});
      if(result.error) {setFormError(!!authErrors[result.error.code ?? ""] && result.error.status !== 429);setError(authErrors[result.error.code ?? ""] ?? (result.error.status === 429 ? "尝试次数过多，请稍后再试。" : "登录未完成，请检查输入后重试。"));return;}
      location.assign(linkGoogle ? googleLinkPath(destination()) : destination());
    } catch {setError("网络连接失败，请稍后重试。");} finally {setBusy(false);}
  }
  return <main className="auth-page">
    <header className="auth-header"><a className="brand" href="/?city=london"><BrandMark/><span>{t("远居")}<span className="brand-en">CAMPUS ATLAS</span></span></a><LanguageSwitch/></header>
    <section className="auth-story" aria-label={t("留学生活，从这里开始")}>
      <img className="auth-cover" src="/photos/london.jpg" alt=""/>
      <div className="auth-story-shade"/>
      <div className="auth-story-content"><h1>{t("新城市，")}<br/>{t("也可以有家的感觉。")}</h1><p>{t("从大学旁的一间房，到你喜欢的生活圈，慢慢找到属于自己的位置。")}</p><div className="auth-benefits"><span><Globe2 size={17}/>{t("{count} 座留学城市",{count:cities.length})}</span><span><MapPin size={17}/>{t("实景城市探索")}</span><span><Footprints size={17}/>{t("真实步行路线")}</span></div></div>
      <div className="auth-city-credit"><span className="dot"/>LONDON · BLOOMSBURY<span>01 / 05</span></div>
    </section>
    <section className="auth-form-panel"><div className="auth-form-wrap"><h2>{t(linkGoogle ? "关联 Google 登录" : mode === "signup" ? "创建你的账号" : "欢迎回来")}</h2><p className="auth-subtitle">{t(linkGoogle ? "将 Google 与现有账号关联，保留收藏和历史记录。" : mode === "signup" ? "给你的留学找房之旅，一个新的开始。" : "登录远居，继续探索你的留学新家。")}</p>
      {error && <Alert variant="destructive" id="auth-error" className="auth-feedback"><AlertDescription>{t(error)}</AlertDescription></Alert>}
      {linkGoogle && sessionPending ? <p role="status">{t("正在检查登录方式…")}</p> : linking ? <GoogleAccountLink email={session.user.email} enabled={googleEnabled} onBusy={setBusy} onError={setError}/> : <>
      {googleEnabled && !linkGoogle && <div className="auth-social"><GoogleAuthButton disabled={busy} onBusy={setBusy} onError={setError}/><span className="auth-divider">{t("或使用邮箱")}</span></div>}
      {linkGoogle && <p className="auth-link-instruction">{t("请先用现有账号的邮箱和密码登录，再绑定 Google。")}</p>}
      <form onSubmit={submit} aria-label={t(mode === "signup" ? "邮箱注册" : "邮箱登录")}>
        <FieldGroup>
          {mode === "signup" && <Field><FieldLabel htmlFor="auth-name">{t("怎么称呼你")}</FieldLabel><Input id="auth-name" name="name" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required minLength={1} maxLength={80} placeholder={t("你的名字")} disabled={busy}/></Field>}
          <Field data-invalid={!!error && formError || undefined}><FieldLabel htmlFor="auth-email">{t("邮箱地址")}</FieldLabel><Input id="auth-email" name="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254} placeholder="you@example.com" disabled={busy} aria-invalid={!!error && formError} aria-describedby={error ? "auth-error" : undefined}/></Field>
          <Field data-invalid={!!error && formError || undefined}><FieldLabel htmlFor="auth-password">{t("密码")}</FieldLabel><InputGroup><InputGroupInput id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} maxLength={128} placeholder={t(mode === "signup" ? "至少 8 个字符" : "请输入密码")} disabled={busy} aria-invalid={!!error && formError} aria-describedby={error ? "auth-error" : mode === "signup" ? "password-help" : undefined}/><InputGroupAddon align="inline-end"><InputGroupButton type="button" size="icon-xs" aria-label={t(showPassword ? "隐藏密码" : "显示密码")} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)} disabled={busy}>{showPassword ? <EyeOff/> : <Eye/>}</InputGroupButton></InputGroupAddon></InputGroup>{mode === "signup" && <FieldDescription id="password-help">{t("密码为 8–128 个字符。")}</FieldDescription>}</Field>
          <Button type="submit" disabled={busy} className="w-full">{busy ? <LoaderCircle className="animate-spin" data-icon="inline-start"/> : null}{t(busy ? "正在处理…" : mode === "signup" ? "创建账号并开始探索" : "登录")}{!busy && <ArrowRight data-icon="inline-end"/>}</Button>
        </FieldGroup>
      </form>
      {!linkGoogle && <p className="auth-mode-switch">{t(mode === "signup" ? "已有账号？" : "还没有账号？")} <Button type="button" variant="link" disabled={busy} onClick={()=>{setMode(v=>v === "login" ? "signup" : "login");setError("");setPassword("");setShowPassword(false);}}>{t(mode === "signup" ? "去登录" : "免费注册")}</Button></p>}
      </>}
      <div className="auth-guest"><span>{t(linking ? "准备好了就继续探索" : "也可以先逛逛")}</span><Button variant="outline" className="w-full" disabled={busy} onClick={()=>location.assign(destination())}>{t(session?.user ? "继续探索" : "游客体验")}<ArrowRight data-icon="inline-end"/></Button></div>
      <p className="auth-demo-note"><Sparkles size={14}/>{t("当前为演示版本，房源不可预订。")}</p>
    </div><footer>© {new Date().getFullYear()} Campus Atlas<a href="/privacy">{t("隐私说明")}</a><span>{t("让异乡，也有归属感。")}</span></footer></section>
  </main>;
}
