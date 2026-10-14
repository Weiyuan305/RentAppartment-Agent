"use client";
import { MapPin, Undo2, Check } from "lucide-react";
import { useLocale } from "./locale-provider";
export function AgentActionReceipt({changes,canUndo,undone,onUndo,onMap}:{changes:string[];canUndo:boolean;undone:boolean;onUndo:()=>void;onMap:()=>void}) {
  const {locale}=useLocale(),w=(zh:string,en:string)=>locale==="zh"?zh:en;
  if(!changes.length)return null;
  return <section className="agent-action-receipt" aria-label={w("Agent 操作回执","Agent action receipt")}>
    <strong><Check size={15}/>{undone?w("本次修改已撤销","Changes undone"):w("本次页面修改","Page changes this turn")}</strong>
    {!undone&&<><ul>{changes.map((change,i)=><li key={i}>{change}</li>)}</ul><div>
      <button onClick={onMap}><MapPin size={14}/>{w("查看地图","View map")}</button>
      <button disabled={!canUndo} onClick={onUndo}><Undo2 size={14}/>{w("撤销本次修改","Undo these changes")}</button>
    </div>{!canUndo&&<small>{w("页面已有新的操作，本次修改不再可撤销。","New page actions have made this undo unavailable.")}</small>}</>}
  </section>;
}
