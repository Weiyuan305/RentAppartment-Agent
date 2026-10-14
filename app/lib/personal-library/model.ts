import { z } from "zod";
import { listings } from "../rental-data";
import { notebookSchema, type DecisionNote } from "../student/notebook";

const ids = new Set(listings.map(listing => listing.id));
export const listingIdSchema = z.string().refine(id => ids.has(id), "Unknown listing");
export const revisionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const owner = z.string().min(1).max(128);
export const libraryCommand = z.discriminatedUnion("kind", [
  z.object({kind:z.literal("favorite"), accountId:owner, listingId:listingIdSchema, saved:z.boolean(), version:revisionSchema}).strict(),
  z.object({kind:z.literal("note"), accountId:owner, listingId:listingIdSchema, note:notebookSchema, version:revisionSchema}).strict(),
  z.object({kind:z.literal("import"), accountId:owner, favorites:z.array(listingIdSchema).max(4), notes:z.array(z.object({listingId:listingIdSchema,note:notebookSchema}).strict()).max(4)}).strict(),
]);
export type LibraryCommand = z.infer<typeof libraryCommand>;
export type FavoriteRecord = {saved:boolean;version:number};
export type NoteRecord = {note:DecisionNote;version:number};
export type LibraryData = {favorites:Record<string,FavoriteRecord>;notes:Record<string,NoteRecord>};
export const emptyLibrary = ():LibraryData => ({favorites:{},notes:{}});
export const favoriteStorageKey = "campus-atlas-saved";
export const notebookStorageKey = "campus-atlas-notebook-v1";
export function readFavorites(raw:string|null):string[] {
  try {const value=JSON.parse(raw??"[]");return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==="string"&&ids.has(id)))]:[];}catch{return [];}
}
/** An older refresh must never roll back an acknowledged write. */
export function mergeLibrary(current:LibraryData, incoming:LibraryData):LibraryData {
  const merged={favorites:{...current.favorites},notes:{...current.notes}};
  for(const [id,row] of Object.entries(incoming.favorites))if(!merged.favorites[id]||row.version>=merged.favorites[id].version)merged.favorites[id]=row;
  for(const [id,row] of Object.entries(incoming.notes))if(!merged.notes[id]||row.version>=merged.notes[id].version)merged.notes[id]=row;
  return merged;
}
