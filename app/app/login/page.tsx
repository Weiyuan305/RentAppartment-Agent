import { LoginPage } from "@/components/login-page";
import { googleCredentials } from "@/lib/google-auth-config";
import { oauthErrorMessage } from "@/lib/oauth-errors";
import { safeReturnPath } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const merchantLogin = safeReturnPath(typeof params.next === "string" ? params.next : null).split("?")[0].split("#")[0] === "/merchant";
  return <LoginPage googleEnabled={!!googleCredentials()} linkGoogle={params.link === "google" || error === "account_not_linked"} merchantLogin={merchantLogin} initialError={oauthErrorMessage(error)}/>;
}
