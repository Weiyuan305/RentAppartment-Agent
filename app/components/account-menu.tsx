"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Full navigation preserves the existing vinext routing boundary. */
import { Link2, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "./locale-provider";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";

export function AccountMenu() {
  const {t,locale} = useLocale();
  const {data,isPending} = authClient.useSession();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState(false);
  const user = data?.user;
  if(!user) return <Button variant="outline" size="sm" disabled={isPending} onClick={()=>location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)}><LogIn data-icon="inline-start"/>{t("登录")}</Button>;
  return <div className="account-menu"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" aria-label={t("账号菜单")}><Avatar className="size-7"><AvatarFallback>{(user.name || user.email)[0].toUpperCase()}</AvatarFallback></Avatar><span className="account-name">{user.name}</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>{user.name}<small className="block text-muted-foreground">{user.email}</small></DropdownMenuLabel><DropdownMenuSeparator/><DropdownMenuGroup><DropdownMenuItem onSelect={()=>location.assign("/merchant")}>{locale==="zh"?"商家工作台":"Partner workspace"}</DropdownMenuItem><DropdownMenuItem onSelect={()=>location.assign("/inquiries")}>{locale==="zh"?"咨询与预约":"Enquiries & viewings"}</DropdownMenuItem><DropdownMenuItem onSelect={()=>location.assign(`/login?link=google&next=${encodeURIComponent(location.pathname + location.search)}`)}><Link2/>{t("关联 Google 登录")}</DropdownMenuItem><DropdownMenuItem disabled={busy} onSelect={async()=>{setBusy(true);setError(false);try{const result=await authClient.signOut();if(result.error){setBusy(false);setError(true);}else location.reload();}catch{setBusy(false);setError(true);}}}><LogOut/>{t("退出登录")}</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>{error && <span role="alert">{t("退出失败，请重试。")}</span>}</div>;
}
