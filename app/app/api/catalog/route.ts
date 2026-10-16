import { getPublicCatalogue } from "@/lib/merchant/server";
import { errorResponse } from "@/lib/agent/http";
export async function GET(){try{return Response.json({listings:await getPublicCatalogue()},{headers:{"Cache-Control":"no-store"}});}catch(e){return errorResponse(e);}}
