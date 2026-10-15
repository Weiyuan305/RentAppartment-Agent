"use client";
import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { oauthErrorMessage } from "@/lib/oauth-errors";
import { safeReturnPath } from "@/lib/i18n";
import { useLocale } from "./locale-provider";
import { Button } from "./ui/button";

export function googleLinkPath(next:string) {
  return `/login?link=google&next=${encodeURIComponent(safeReturnPath(next))}`;
}

// Official multicolour Google G, kept at its original proportions on white.
function GoogleMark() {
  return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.77 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>;
}

export function GoogleAuthButton({link=false,disabled=false,onBusy,onError}:{link?:boolean;disabled?:boolean;onBusy:(busy:boolean)=>void;onError:(message:string)=>void}) {
  const {t} = useLocale();
  const [pending,setPending] = useState(false);
  // Returning via the browser's Back button must release the redirect spinner.
  useEffect(()=>{
    const reset=()=>{setPending(false);onBusy(false);};
    window.addEventListener("pageshow",reset);
    return ()=>window.removeEventListener("pageshow",reset);
  },[onBusy]);
  async function start() {
    if(disabled || pending)return;
    setPending(true);onBusy(true);onError("");
    const next=safeReturnPath(new URLSearchParams(location.search).get("next"));
    const callbackURL=link ? googleLinkPath(next) : next;
    const errorCallbackURL=link ? googleLinkPath(next) : `/login?next=${encodeURIComponent(next)}`;
    try {
      const result=link
        ? await authClient.linkSocial({provider:"google",callbackURL,errorCallbackURL})
        : await authClient.signIn.social({provider:"google",callbackURL,errorCallbackURL});
      if(result.error){onError(result.error.status === 429 ? "尝试次数过多，请稍后再试。" : oauthErrorMessage(result.error.code || "unknown"));setPending(false);onBusy(false);}
      // Better Auth's client navigates to Google's URL on a successful response.
    } catch {onError("网络连接失败，请稍后重试。");setPending(false);onBusy(false);}
  }
  return <Button type="button" variant="outline" className="auth-google-button" disabled={disabled || pending} onClick={start}>
    {pending ? <LoaderCircle className="animate-spin"/> : <GoogleMark/>}<span>{t(pending ? "正在前往 Google…" : link ? "绑定 Google 账号" : "使用 Google 登录")}</span>
  </Button>;
}

export function GoogleAccountLink({email,enabled,onBusy,onError}:{email:string;enabled:boolean;onBusy:(busy:boolean)=>void;onError:(message:string)=>void}) {
  const {t}=useLocale();
  const [status,setStatus]=useState<"loading"|"linked"|"unlinked"|"error">("loading");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    authClient.listAccounts().then(result=>{
      if(active)setStatus(result.error ? "error" : result.data?.some(account=>account.providerId === "google") ? "linked" : "unlinked");
    }).catch(()=>{if(active)setStatus("error");});
    return ()=>{active=false;};
  },[email,retry]);
  return <div className="auth-google-link">
    <p>{t("当前账号")}<strong>{email}</strong></p>
    {status === "loading" ? <p role="status">{t("正在检查登录方式…")}</p> : status === "linked" ? <p className="auth-google-linked" role="status"><Check size={18}/>{t("已绑定 Google，可用 Google 登录此账号。")}</p> : status === "error" ? <Button variant="outline" onClick={()=>setRetry(v=>v+1)}>{t("加载失败，点击重试")}</Button> : enabled ? <><p>{t("选择同邮箱的 Google 账号，已有收藏和记录会继续保留。")}</p><GoogleAuthButton link onBusy={onBusy} onError={onError}/></> : <p>{t("Google 登录暂时不可用，请使用邮箱登录或游客体验。")}</p>}
  </div>;
}
