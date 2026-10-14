import { getDatabase } from "@atlas/database";
import { getAuth } from "@/lib/auth";
import { createLibraryHandler } from "@/lib/personal-library/server";
const handle=createLibraryHandler({database:getDatabase,user:async request=>(await (await getAuth(request)).api.getSession({headers:request.headers}))?.user??null});
export {handle as GET,handle as POST};
