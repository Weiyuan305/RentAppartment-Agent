"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, NotebookPen, Save } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Dialog,DialogContent,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import type { Listing } from "@/lib/rental-data";
import { housingDetails } from "@/lib/student/planner";
import { decisionStages, emptyDecisionNote, viewingItems, type DecisionNote } from "@/lib/student/notebook";

import { LibrarySyncStatus, usePersonalLibrary } from "@/components/personal-library-provider";

export function ListingDossierDialog({listing,onClose}:{listing:Listing|null;onClose:()=>void}) {
  const {locale}=useLocale(),w=(zh:string,en:string)=>locale==="zh"?zh:en;
  const title=useRef<HTMLHeadingElement>(null);
  return <Dialog open={!!listing} onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="student-dialog dossier-dialog sm:max-w-[760px]" onOpenAutoFocus={event=>{event.preventDefault();title.current?.focus();}}>
    <DialogTitle ref={title} tabIndex={-1}>{listing?.name}</DialogTitle><DialogDescription>{w("房源资料与我的看房记录","Listing facts & my viewing notes")}</DialogDescription>
    {listing&&<ListingDossier key={listing.id} listing={listing} compact/>}
  </DialogContent></Dialog>;
}

export function ListingDossier({listing,compact=false}:{listing:Listing;compact?:boolean}) {
  const library=usePersonalLibrary();
  return <DossierEditor key={`${library.scope}:${listing.id}`} listing={listing} compact={compact}/>;
}
function DossierEditor({listing,compact}:{listing:Listing;compact:boolean}) {
  const {locale}=useLocale(),w=(zh:string,en:string)=>locale==="zh"?zh:en;
  const h=housingDetails(listing),id=useId();
  const [section,setSection]=useState<"facts"|"notes">("facts");
  const library=usePersonalLibrary(),record=library.notes[listing.id];
  const [note,setNote]=useState<DecisionNote>(record?.note??emptyDecisionNote),[version,setVersion]=useState(record?.version??0),[dirty,setDirty]=useState(false);
  const [message,setMessage]=useState<"saved"|"error"|"conflict"|"">("");
  useEffect(()=>{
    // Refresh untouched fields from the external library; never replace an edited draft.
    if(dirty)return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote(record?.note??emptyDecisionNote());setVersion(record?.version??0);
  },[record,dirty]);
  function update(patch:Partial<DecisionNote>){setNote(value=>({...value,...patch}));setDirty(true);setMessage("");}
  async function save(){
    const result=await library.saveNote(listing.id,note,version);
    if(result.ok){setNote(result.record.note);setVersion(result.record.version);setDirty(false);setMessage("saved");}
    else setMessage(result.reason==="conflict"?"conflict":"error");
  }
  return <div className="listing-dossier">
    {compact&&<div className="dossier-switch" aria-label={w("资料与记录","Facts and notes")}><button aria-pressed={section==="facts"} onClick={()=>setSection("facts")}>{w("房源资料","Listing facts")}</button><button aria-pressed={section==="notes"} onClick={()=>setSection("notes")}>{w("我的看房记录","My viewing notes")}</button></div>}
    <div className="dossier-scroll">
    <section className="listing-facts" hidden={compact&&section!=="facts"}><h2>{w("先确认这些信息","Know what is confirmed")}</h2>
      <p>{w("这是虚构演示房源，不可预订；以下日期与租期仅用于演示筛选。","This is a fictional, non-bookable listing. Dates and lease terms only demonstrate filtering.")}</p>
      <dl>
        <div><dt>{w("房源来源","Listing source")}</dt><dd>{w("Campus Atlas 演示数据；无真实房源发布链接","Campus Atlas sample data; no real listing URL")}</dd></div>
        <div><dt>{w("资料更新","Data updated")}</dt><dd>{h.updatedAt} · {w("非实地核验日期","Not an inspection date")}</dd></div>
        <div><dt>{w("演示入住日期","Demo move-in date")}</dt><dd>{h.availableFrom??w("未知","Unknown")}</dd></div>
        <div><dt>{w("演示租期","Demo lease")}</dt><dd>{h.minLeaseMonths===null?w("待确认","Unknown"):`${h.minLeaseMonths}–${h.maxLeaseMonths} ${w("个月","months")}`}</dd></div>
        <div><dt>{w("真实可租状态","Real availability")}</dt><dd>{w("未核验","Unverified")}</dd></div>
        <div><dt>{w("房东 / 联系人","Landlord / contact")}</dt><dd>{w("未提供，未核验身份","Not provided; identity unverified")}</dd></div>
        <div><dt>{w("担保人 / 付款条件","Guarantor / payment terms")}</dt><dd>{w("待房源方确认","Confirm with the provider")}</dd></div>
        <div><dt>{w("押金保护 / 取消政策","Deposit protection / cancellation")}</dt><dd>{w("未提供，不推断适用规则","Not provided; no applicable rules assumed")}</dd></div>
        <div><dt>{w("照片 / 户型图","Photos / floor plan")}</dt><dd>{w("图片仅为风格参考；没有核验户型图","Style references only; no verified floor plan")} <a href="/photos/sources.json" target="_blank" rel="noreferrer">{w("照片来源","Photo sources")}<ExternalLink size={13}/></a></dd></div>
      </dl>
    </section>
    <section className="viewing-notebook" hidden={compact&&section!=="notes"}><h2><NotebookPen size={20}/>{w("我的看房记录","My viewing notes")}</h2><p>{library.accountId?w("保存后随账号同步，换设备登录也能查看。记录不进入分享链接或 AI 请求，也不代表平台核验。","Saved notes sync with your account across devices. Excluded from share links and AI requests; not platform verification."):w("游客记录仅保存在当前浏览器。登录后可合并到账号；不会进入分享链接或 AI 请求。","Guest notes stay in this browser. Sign in to merge them into your account. Excluded from share links and AI requests.")}</p>
      <LibrarySyncStatus/><form onSubmit={event=>{event.preventDefault();void save();}}>
        <fieldset disabled={!library.ready||library.busy}><legend className="sr-only">{w("记录看房决定","Record your decision")}</legend>
          <div className="notebook-fields"><label htmlFor={`${id}-stage`}>{w("当前决定","Decision stage")}<select id={`${id}-stage`} value={note.stage} onChange={event=>update({stage:event.target.value as DecisionNote["stage"]})}>{decisionStages.map(([value,zh,en])=><option key={value} value={value}>{w(zh,en)}</option>)}</select></label>
          <label htmlFor={`${id}-date`}>{w("看房日期（可留空）","Viewing date (optional)")}<input id={`${id}-date`} type="date" value={note.viewedOn??""} onChange={event=>update({viewedOn:event.target.value||null})}/></label></div>
          <label htmlFor={`${id}-notes`}>{note.stage==="ruled-out"?w("排除理由与备注","Why ruled out & notes"):w("待确认的问题与备注","Questions to confirm & notes")}<textarea id={`${id}-notes`} maxLength={1500} rows={4} value={note.notes} onChange={event=>update({notes:event.target.value})} placeholder={w("例如：周末再确认夜间噪声；询问网络费用是否包含。","For example: check noise at night; ask whether internet is included.")}/></label>
          <p className="notebook-counter">{note.notes.length}/1500</p>
          <h3>{w("看房核对清单","Viewing checklist")}</h3>
          <div className="viewing-checks">{viewingItems.map(([key,zh,en])=><label key={key} htmlFor={`${id}-${key}`}><span>{w(zh,en)}</span><select id={`${id}-${key}`} value={note.checks[key]} onChange={event=>update({checks:{...note.checks,[key]:event.target.value as DecisionNote["checks"][typeof key]}})}><option value="unknown">{w("待查看","Not checked")}</option><option value="checked">{w("已查看","Checked")}</option><option value="concern">{w("有疑问","Concern")}</option></select></label>)}</div>
          <button className="primary-button notebook-save" type="submit"><Save size={16}/>{w("保存我的记录","Save my notes")}</button>
        </fieldset>
        <p role="status" className={message==="error"||message==="conflict"?"notebook-error":"notebook-status"}>{message==="saved"?(library.accountId?w("已保存到账号，可在其他设备登录查看。","Saved to your account. Available on other devices."):w("已保存在此浏览器。","Saved in this browser.")):message==="conflict"?w("其他设备已更新这份记录，你的输入未覆盖云端。请保留需要的文字，再载入云端版本编辑。","Another device updated this note. Your draft has not overwritten it. Copy anything you need, then load the cloud version to edit."):message==="error"?w("保存未完成，当前输入仍保留。请检查日期、网络或存储设置后重试。","Save incomplete. Your draft is preserved. Check the date, connection or storage settings, then retry."):dirty?w("有未保存的修改。","You have unsaved changes."):""}</p>
        {message==="conflict"&&<button type="button" className="secondary-button" onClick={()=>{setNote(record?.note??emptyDecisionNote());setVersion(record?.version??0);setDirty(false);setMessage("");}}>{w("载入云端版本（替换当前输入）","Load cloud version (replace this draft)")}</button>}
      </form>
    </section></div>
  </div>;
}
