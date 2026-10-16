import { getDatabase } from "@atlas/database";
import { getAuth } from "../auth";
import { SessionError } from "../agent/store";
import { createMerchantService, type Actor } from "./service";
export async function merchantActor(request: Request): Promise<Actor> {
  const session = await (
    await getAuth(request)
  ).api.getSession({ headers: request.headers });
  if (!session?.user) throw new SessionError("请先登录 / Please sign in", 401);
  // Explicitly authorized operator. A matching unverified password signup is not an administrator.
  const admin =
    session.user.emailVerified &&
    session.user.email.toLowerCase() === "xuweiyuan0305@gmail.com" &&
    !!(await (
      await getDatabase()
    ).first(
      "SELECT id FROM auth_account WHERE userId=? AND providerId='google'",
      [session.user.id],
    ));
  return { id: session.user.id, admin };
}
export async function merchantService() {
  return createMerchantService(await getDatabase());
}
export async function getPublicCatalogue() {
  return (await merchantService()).catalogue();
}
