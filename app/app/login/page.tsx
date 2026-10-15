import { LoginPage } from "@/components/login-page";
import { googleCredentials } from "@/lib/google-auth-config";
import { oauthErrorMessage } from "@/lib/oauth-errors";

export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  return <LoginPage googleEnabled={!!googleCredentials()} linkGoogle={params.link === "google" || error === "account_not_linked"} initialError={oauthErrorMessage(error)}/>;
}
