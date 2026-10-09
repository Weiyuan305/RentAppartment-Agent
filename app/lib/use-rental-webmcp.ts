"use client";
import { useEffect } from "react";
import type { City, Listing } from "./rental-data";
type ModelContext = { registerTool: (tool: {name:string;description:string;inputSchema:object;annotations:object;execute:()=>Promise<string>},options:{signal:AbortSignal})=>Promise<void>|void };
/** Progressive enhancement: local sample data only; no external lookups or reservations. */
export function useRentalWebMCP(city:City,shown:Listing[],selected:string){
  useEffect(()=>{
    const modelContext=(document as Document & {modelContext?:ModelContext}).modelContext ?? (navigator as Navigator & {modelContext?:ModelContext}).modelContext;
    if(!modelContext)return;
    const controller=new AbortController();
    try { void Promise.resolve(modelContext.registerTool({
      name:"get_rental_sample",description:"Read the current city, visible demo listings and selected demo listing in Campus Atlas. All listings/prices/coordinates are fictional; campus walking routes use a saved OSM network estimate; safety and shop opening status are unverified. Does not query external services or book housing.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,consequentialHint:false},
      execute:async()=>JSON.stringify({city:city.name,currency:city.currency,period:city.period,selected,demo:true,visibleListings:shown.map(l=>({id:l.id,name:l.name,price:l.price,roomType:l.roomType,bills:l.bills})),unverified:["building entrances","safety","opening status"]})
    },{signal:controller.signal})).catch(()=>{}); } catch { /* Unsupported experimental implementations do not affect the website. */ }
    return()=>controller.abort();
  },[city,shown,selected]);
}
