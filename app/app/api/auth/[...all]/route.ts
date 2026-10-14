import { getAuth } from "@/lib/auth";
async function handle(request:Request) {
  try {
    const response = await (await getAuth(request)).handler(request);
    response.headers.set("Cache-Control","private, no-store");
    return response;
  } catch {
    return Response.json({code:"AUTH_UNAVAILABLE",message:"Authentication is temporarily unavailable"},{status:503,headers:{"Cache-Control":"private, no-store"}});
  }
}
export {handle as GET,handle as POST};
