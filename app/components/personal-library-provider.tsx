"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { emptyLibrary, favoriteStorageKey, notebookStorageKey, mergeLibrary, readFavorites, type LibraryCommand, type LibraryData, type NoteRecord } from "@/lib/personal-library/model";
import { notebookSchema, readNotebook, type DecisionNote } from "@/lib/student/notebook";
import { useLocale } from "./locale-provider";

type Problem="network"|"storage"|"conflict"|"auth";
type SaveResult={ok:true;record:NoteRecord}|{ok:false;reason:Problem};
type LibraryContext=LibraryData & {
  scope:string;accountId:string|null;ready:boolean;busy:boolean;problem:Problem|null;hasGuestData:boolean;imported:boolean;
  refresh:()=>Promise<void>;toggleFavorite:(id:string)=>Promise<void>;
  saveNote:(id:string,note:DecisionNote,version:number)=>Promise<SaveResult>;importGuest:()=>Promise<void>;
};
const Context=createContext<LibraryContext|null>(null);
export function usePersonalLibrary(){const value=useContext(Context);if(!value)throw new Error("PersonalLibraryProvider missing");return value;}

export function PersonalLibraryProvider({children}:{children:ReactNode}) {
  const session=authClient.useSession();
  const accountId=session.data?.user.id??null;
  const mode=session.isPending?"pending":session.error?"unavailable":accountId??"guest";
  // Keep the map mounted while the library changes identity.
  return <LibraryScope scope={mode} accountId={accountId}>{children}</LibraryScope>;
}
function guestData():LibraryData {
  return {favorites:Object.fromEntries(readFavorites(localStorage.getItem(favoriteStorageKey)).map(id=>[id,{saved:true,version:0}])),notes:Object.fromEntries(Object.entries(readNotebook(localStorage.getItem(notebookStorageKey))).map(([id,note])=>[id,{note,version:0}]))};
}
function LibraryScope({children,scope,accountId}:{children:ReactNode;scope:string;accountId:string|null}) {
  const [data,setData]=useState<LibraryData>(emptyLibrary),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
  const [problem,setProblem]=useState<Problem|null>(scope==="unavailable"?"auth":null);
  const [hasGuestData,setHasGuestData]=useState(false),[imported,setImported]=useState(false);
  const [stateScope,setStateScope]=useState(scope);
  const identity=useRef(scope);
  const dataRef=useRef(data),writing=useRef(false),alive=useRef(true),controllers=useRef(new Set<AbortController>());
  if(stateScope!==scope){
    setStateScope(scope);setData(emptyLibrary());setReady(false);setBusy(false);setImported(false);
    setProblem(scope==="unavailable"?"auth":null);
  }
  useLayoutEffect(()=>{identity.current=scope;dataRef.current=emptyLibrary();writing.current=false;},[scope]);
  const apply=useCallback((next:LibraryData,merge=true)=>{
    if(!alive.current||identity.current!==scope)return;
    const value=merge?mergeLibrary(dataRef.current,next):next;
    dataRef.current=value;setData(value);
  },[scope]);
  const request=useCallback(async(command?:LibraryCommand)=>{
    const controller=new AbortController();controllers.current.add(controller);
    const timer=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch("/api/library",{method:command?"POST":"GET",credentials:"same-origin",cache:"no-store",signal:controller.signal,headers:command?{"Content-Type":"application/json"}:undefined,body:command?JSON.stringify(command):undefined});
      const body=await response.json() as LibraryData & {accountId?:string;code?:string};
      if(!alive.current||identity.current!==scope)throw new Error("Scope changed");
      if(response.status===401||body.code==="ACCOUNT_CHANGED"||body.accountId&&body.accountId!==accountId){apply(emptyLibrary(),false);setReady(false);setProblem("auth");return {ok:false as const,reason:"auth" as const};}
      if(response.ok||body.code==="VERSION_CONFLICT")apply(body);
      if(!response.ok){const reason=body.code==="VERSION_CONFLICT"?"conflict" as const:"network" as const;setProblem(reason);return {ok:false as const,reason};}
      setReady(true);setProblem(null);return {ok:true as const,data:body};
    } catch {
      if(alive.current&&identity.current===scope)setProblem("network");
      return {ok:false as const,reason:"network" as const};
    } finally {clearTimeout(timer);controllers.current.delete(controller);}
  },[accountId,apply,scope]);
  const refresh=useCallback(async()=>{
    if(writing.current||scope==="pending"||scope==="unavailable")return;
    if(accountId){await request();return;}
    try{apply(guestData(),false);setProblem(null);}catch{setProblem("storage");}
    setReady(true);
  },[accountId,scope,request,apply]);
  useEffect(()=>{
    alive.current=true;
    const pending=controllers.current;
    // Hydrate this identity from browser storage / the authenticated server after SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const inspectGuest=()=>{try{const guest=guestData();setHasGuestData(Object.keys(guest.favorites).length+Object.keys(guest.notes).length>0);}catch{setHasGuestData(false);}};
    inspectGuest();
    const onFocus=()=>{if(document.visibilityState==="visible")void refresh();};
    const onStorage=(event:StorageEvent)=>{if(event.key===favoriteStorageKey||event.key===notebookStorageKey||event.key===null){inspectGuest();if(!accountId)void refresh();}};
    window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onFocus);window.addEventListener("storage",onStorage);
    return()=>{alive.current=false;pending.forEach(controller=>controller.abort());window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("storage",onStorage);};
  },[accountId,refresh]);
  async function toggleFavorite(id:string){
    if(!ready||writing.current)return;
    writing.current=true;setBusy(true);
    try {
      const row=dataRef.current.favorites[id],saved=!row?.saved;
      if(accountId){await request({kind:"favorite",accountId,listingId:id,saved,version:row?.version??0});return;}
      const ids=new Set(readFavorites(localStorage.getItem(favoriteStorageKey)));
      if(saved)ids.add(id);else ids.delete(id);
      localStorage.setItem(favoriteStorageKey,JSON.stringify([...ids]));apply(guestData(),false);setProblem(null);
    }catch{setProblem("storage");}finally{if(identity.current===scope){writing.current=false;if(alive.current)setBusy(false);}}
  }
  async function saveNote(id:string,note:DecisionNote,version:number):Promise<SaveResult>{
    if(!ready||writing.current)return {ok:false,reason:problem??"network"};
    const valid=notebookSchema.safeParse(note);if(!valid.success)return {ok:false,reason:"storage"};
    writing.current=true;setBusy(true);
    try {
      if(accountId){const result=await request({kind:"note",accountId,listingId:id,note:valid.data,version});return result.ok?{ok:true,record:result.data.notes[id]}:result;}
      const notes=readNotebook(localStorage.getItem(notebookStorageKey));
      localStorage.setItem(notebookStorageKey,JSON.stringify({...notes,[id]:valid.data}));apply(guestData(),false);setProblem(null);
      return {ok:true,record:{note:valid.data,version:0}};
    }catch{setProblem("storage");return {ok:false,reason:"storage"};}finally{if(identity.current===scope){writing.current=false;if(alive.current)setBusy(false);}}
  }
  async function importGuest(){
    if(!accountId||!ready||writing.current)return;
    writing.current=true;setBusy(true);setImported(false);
    try {
      const guest=guestData(),favorites=Object.keys(guest.favorites),notes=Object.entries(guest.notes).map(([listingId,row])=>({listingId,note:row.note}));
      for(let offset=0;offset<Math.max(favorites.length,notes.length);offset+=4){
        const result=await request({kind:"import",accountId,favorites:favorites.slice(offset,offset+4),notes:notes.slice(offset,offset+4)});
        if(!result.ok)return;
      }
      // Keep the original guest copy: imports never overwrite existing cloud rows.
      if(alive.current)setImported(true);
    }catch{setProblem("storage");}finally{if(identity.current===scope){writing.current=false;if(alive.current)setBusy(false);}}
  }
  const value:LibraryContext={...data,scope:problem==="auth"?`${scope}:locked`:scope,accountId,ready,busy,problem,hasGuestData,imported,refresh,toggleFavorite,saveNote,importGuest};
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function LibrarySyncStatus({compact=false}:{compact?:boolean}={}){
  const library=usePersonalLibrary(),{locale}=useLocale(),w=(zh:string,en:string)=>locale==="zh"?zh:en;
  const text=library.problem==="auth"?w("登录状态已变化，请重新加载后同步。","Sign-in changed. Reload to sync.")
    :library.problem==="network"?w("同步未完成，请检查网络后重试。","Sync incomplete. Check your connection and retry.")
    :library.problem==="storage"?w("浏览器未能保存，请检查存储设置。","Browser storage unavailable. Check your settings.")
    :library.problem==="conflict"?w("其他设备已更新，已读取最新数据；未覆盖你的输入。","Another device updated this item. Latest data loaded; your draft is preserved.")
    :library.busy?w("正在保存…","Saving…"):!library.ready?w("正在读取收藏和记录…","Loading saved homes and notes…")
    :library.accountId?w("收藏与记录 · 已连接账号同步","Saved homes & notes · Account sync connected"):w("游客收藏与记录 · 保存在此浏览器","Guest saved homes & notes · This browser only");
  const summary=compact&&!library.problem&&library.ready&&!library.busy
    ?library.accountId?w("收藏与记录 · 账号同步","Saves & notes · Account sync"):w("游客收藏与记录 · 仅存本机","Guest saves & notes · This device only")
    :text;
  return <div className={`library-sync-status${compact?" library-sync-status--compact":""}`}><p role="status" title={compact?text:undefined}>{summary}</p>{library.problem==="auth"?<button onClick={()=>location.reload()}>{w("重新加载","Reload")}</button>:library.accountId&&<button disabled={library.busy} onClick={()=>void library.refresh()}>{w("刷新同步","Refresh")}</button>}
    {library.accountId&&library.hasGuestData&&library.ready&&<><button disabled={library.busy} onClick={()=>void library.importGuest()}>{w("合并本机游客收藏与记录","Merge this browser’s guest saves & notes")}</button><small>{library.imported?w("已合并新增数据。同一房源已有云端记录时保留云端版本；游客原件仍留在本机。","New items merged. Existing cloud records kept; original guest copies remain on this browser."):w("只补充账号中没有的数据，已有云端记录不覆盖。","Adds missing items only; existing cloud records stay unchanged.")}</small></>}
  </div>;
}
