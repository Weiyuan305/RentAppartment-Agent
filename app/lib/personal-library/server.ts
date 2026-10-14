import { z } from "zod";
import type { RentalDatabase } from "../agent/database";
import { readBody, sameOrigin, privateHeaders } from "../agent/http";
import { createStore, SessionError } from "../agent/store";
import { notebookSchema } from "../student/notebook";
import { libraryCommand, type LibraryData } from "./model";

type Dependencies = {database:()=>Promise<RentalDatabase>;user:(request:Request)=>Promise<{id:string}|null>};
class LibraryError extends Error {constructor(public code:string,public status:number){super(code);}}
export function createLibraryHandler(deps:Dependencies) {
  async function snapshot(db:RentalDatabase,userId:string):Promise<LibraryData> {
    const [favorites,notes]=await Promise.all([
      db.all<{listing_id:string;saved:number;version:number}>("SELECT listing_id,saved,version FROM account_favorites WHERE user_id=?",[userId]),
      db.all<{listing_id:string;note:string;version:number}>("SELECT listing_id,note,version FROM account_notes WHERE user_id=?",[userId]),
    ]);
    return {favorites:Object.fromEntries(favorites.map(row=>[row.listing_id,{saved:!!row.saved,version:row.version}])),notes:Object.fromEntries(notes.map(row=>[row.listing_id,{note:notebookSchema.parse(JSON.parse(row.note)),version:row.version}]))};
  }
  return async function handle(request:Request) {
    try {
      sameOrigin(request);
      const user=await deps.user(request);
      if(!user)throw new LibraryError("LOGIN_REQUIRED",401);
      const db=await deps.database();
      if(request.method==="GET")return Response.json({accountId:user.id,...await snapshot(db,user.id)},{headers:privateHeaders});
      if(request.method!=="POST")throw new LibraryError("METHOD_NOT_ALLOWED",405);
      const command=libraryCommand.parse(await readBody(request));
      // Identity always comes from the signed session. The body only guards an in-flight account switch.
      if(command.accountId!==user.id)throw new LibraryError("ACCOUNT_CHANGED",409);
      await createStore(deps.database).consumeQuota(`library:write:${user.id}`,120,60000);
      const now=Date.now();
      if(command.kind==="import") {
        // Idempotent, insert-only import. Tombstones prevent old local favorites being resurrected.
        for(const id of new Set(command.favorites))await db.run("INSERT OR IGNORE INTO account_favorites (user_id,listing_id,saved,version,updated) VALUES (?,?,1,1,?)",[user.id,id,now]);
        for(const {listingId,note} of command.notes)await db.run("INSERT OR IGNORE INTO account_notes (user_id,listing_id,note,version,updated) VALUES (?,?,?,1,?)",[user.id,listingId,JSON.stringify(note),now]);
        return Response.json({accountId:user.id,...await snapshot(db,user.id)},{headers:privateHeaders});
      }
      let changes:number;
      if(command.kind==="favorite") {
        const saved=Number(command.saved);
        const result=command.version===0
          ? await db.run("INSERT OR IGNORE INTO account_favorites (user_id,listing_id,saved,version,updated) VALUES (?,?,?,1,?)",[user.id,command.listingId,saved,now])
          : await db.run("UPDATE account_favorites SET saved=?,version=version+1,updated=? WHERE user_id=? AND listing_id=? AND version=?",[saved,now,user.id,command.listingId,command.version]);
        changes=result.changes;
      } else {
        const value=JSON.stringify(command.note);
        const result=command.version===0
          ? await db.run("INSERT OR IGNORE INTO account_notes (user_id,listing_id,note,version,updated) VALUES (?,?,?,1,?)",[user.id,command.listingId,value,now])
          : await db.run("UPDATE account_notes SET note=?,version=version+1,updated=? WHERE user_id=? AND listing_id=? AND version=?",[value,now,user.id,command.listingId,command.version]);
        changes=result.changes;
      }
      if(!changes)return Response.json({code:"VERSION_CONFLICT",accountId:user.id,...await snapshot(db,user.id)},{status:409,headers:privateHeaders});
      return Response.json({accountId:user.id,...await snapshot(db,user.id)},{headers:privateHeaders});
    } catch(error) {
      const status=error instanceof LibraryError?error.status:error instanceof SessionError?error.status:error instanceof z.ZodError?400:503;
      return Response.json({code:error instanceof LibraryError?error.code:error instanceof z.ZodError?"INVALID_INPUT":status===403?"ORIGIN_REJECTED":status===413?"PAYLOAD_TOO_LARGE":status===429?"RATE_LIMITED":"SYNC_UNAVAILABLE"},{status,headers:privateHeaders});
    }
  };
}
