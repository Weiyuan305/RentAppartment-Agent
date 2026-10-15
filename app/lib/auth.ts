import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { getDatabase } from "@atlas/database";
import * as schema from "./auth-schema";
import type { RentalDatabase } from "./agent/database";
import { googleCredentials, type GoogleCredentials } from "./google-auth-config";

export function createAuth(database:RentalDatabase, options:{secret:string;origin:string;production?:boolean;google?:GoogleCredentials}) {
  const db = drizzle(async (sql,values,method)=>{
    if(method === "run") {await database.run(sql,values); return {rows:[]};}
    const rows = await database.all<Record<string,unknown>>(sql,values);
    return {rows:method === "get" ? rows[0] ? Object.values(rows[0]) : [] : rows.map(row=>Object.values(row))};
  },{schema});
  return betterAuth({
    appName:"Campus Atlas", secret:options.secret, baseURL:options.origin, basePath:"/api/auth",
    trustedOrigins:[options.origin], database:drizzleAdapter(db,{provider:"sqlite",schema,transaction:false}),
    emailAndPassword:{enabled:true,minPasswordLength:8,maxPasswordLength:128,requireEmailVerification:false},
    socialProviders:options.google ? {google:{...options.google,prompt:"select_account",accessType:"online"}} : {},
    // Existing email accounts are unverified: require signing in before linking,
    // rather than granting access solely because Google returns the same email.
    account:{encryptOAuthTokens:true,accountLinking:{enabled:true,requireLocalEmailVerified:true,allowDifferentEmails:false}},
    onAPIError:{errorURL:`${options.origin}/login`},
    session:{expiresIn:60*60*24*7,updateAge:60*60*24},
    advanced:{cookiePrefix:"atlas-auth",useSecureCookies:options.origin.startsWith("https://"),ipAddress:{ipAddressHeaders:["cf-connecting-ip"]}},
    rateLimit:{enabled:true,storage:"database",window:60,max:30,customRules:{"/sign-in/email":{window:60,max:6},"/sign-up/email":{window:60,max:3}}},
    telemetry:{enabled:false},
  });
}
export async function getAuth(request:Request) {
  const secret = process.env.ATLAS_AUTH_SECRET;
  if(!secret || secret.length < 32) throw new Error("Authentication secret is not configured");
  const url = new URL(request.url);
  // Cloudflare Pages proxies this exact public URL to the Worker via service binding.
  const origin = process.env.ATLAS_AUTH_URL || url.origin;
  return createAuth(await getDatabase(),{secret,origin,google:googleCredentials()});
}
