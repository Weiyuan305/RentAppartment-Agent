"use client";
import { PartnerFacts } from "./merchant/partner-facts";
import { useListings } from "@/components/listing-catalog-provider";
import { displayCity, displayArea } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
// Full document links avoid vinext production client-router failures.
import { LanguageSwitch } from "./language-switch";
import { AccountMenu } from "./account-menu";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bath, BedDouble, Check, Footprints, GraduationCap, MapPin, Ruler } from "lucide-react";
import { getCity, priceLabel, type Listing } from "@/lib/rental-data";
import { ListingCommute } from "@/components/listing-commute";
import { ViewingRequestSheet } from "@/components/viewing-request-sheet";
import { trackAtlasEvent } from "@/lib/atlas-events";
import {buildingById} from "@/lib/student/catalog";
import { ListingDossier } from "./student/listing-dossier";
import {housingDetails} from "@/lib/student/planner";
import {browseReturnUrl,browseStorageKey,readBrowseSnapshot} from "@/lib/browse-memory";
export default function ListingDetail({listing,buildingId,compareIds=[]}:{listing:Listing;buildingId?:string;compareIds?:string[]}){
 const listings=useListings();
  const {t, locale} = useLocale();
 const [returnUrl,setReturnUrl]=useState<string|null>(null);
 // Restore this browser-only return link after hydration.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{try {const snapshot=readBrowseSnapshot(sessionStorage.getItem(browseStorageKey(listing.cityId)),new URLSearchParams(window.location.search).get("return"),listing.cityId,listings);if(snapshot)setReturnUrl(browseReturnUrl(snapshot));} catch {}},[listing.cityId,listings]);
 const [index,setIndex]=useState(0);const [viewingOpen,setViewingOpen]=useState(false);const city=getCity(listing.cityId); const cityView=displayCity(city,locale);const building=buildingById(buildingId);const context=new URLSearchParams({city:city.id,listing:listing.id});context.set("building",building?.id??"university-default");context.set("compare",compareIds.join(","));const h=housingDetails(listing);
 return <main className="listing-detail-page"><header><a href={returnUrl??`/?${context}`}><ArrowLeft size={17}/> {t("回到{city}找房",{city:cityView.name})}</a><div className="header-end"><span className="sample-badge">{listing.merchant?(locale==="zh"?"商家房源":"Partner listing"):t("演示房源 · 不可预订")}</span><LanguageSwitch/><AccountMenu/></div></header><div className="detail-page-heading"><div><h1>{listing.name}</h1><p><MapPin size={16}/>{cityView.name} · {displayArea(listing.area,locale)}</p></div><div className="price">{priceLabel(listing)}<small> / {cityView.period}</small></div></div><div className="detail-gallery"><div className="detail-gallery-hero"><img src={listing.photos[index]} alt={listing.merchant?`${listing.name} ${index+1}`:t("室内风格参考 {0}", {0:index+1})}/><span>{listing.merchant?(locale==="zh"?"商家上传照片":"Photos provided by host"):t("库存照片 · 仅展示室内风格，不代表真实房源")}</span></div><div className="detail-gallery-thumbnails">{listing.photos.map((photo,i)=><button key={photo} onClick={()=>setIndex(i)} className={i===index?"active":""} aria-pressed={i===index} aria-label={t("查看参考照片 {0}", {0:i+1})}><img src={photo} alt={t("风格参考缩略图 {0}", {0:i+1})}/></button>)}</div></div><div className="detail-information">{listing.merchant?<PartnerFacts listing={listing}/>:<section><h2>{t("给留学生活，一个自己的空间")}</h2><div className="detail-features"><span><BedDouble/>{t(listing.roomType)}</span><span><Ruler/>{listing.size} m²</span><span><Check/>{t("配备家具")}</span><span><Bath/>{listing.roomType==="合租单间"?t("共用卫浴"):t("独立卫浴")}</span></div><h2>{locale==="zh"?"入住与租期（演示）":"Move-in and lease (demo)"}</h2><p>{h.availableFrom??(locale==="zh"?"日期未知":"Date unknown")} · {h.minLeaseMonths??"?"}–{h.maxLeaseMonths??"?"} {locale==="zh"?"个月":"months"} · {h.status==="available"?(locale==="zh"?"演示可租":"Demo available"):h.status==="unavailable"?(locale==="zh"?"演示不可租":"Demo unavailable"):(locale==="zh"?"状态未知":"Unknown status")}</p><p>{locale==="zh"?"演示字段更新时间":"Demo fields updated"}: {h.updatedAt}</p><h2>{t("样本租住条件")}</h2><p>{listing.bills?t("演示租金包含水、电和网络。"):t("演示租金不含水、电和网络。")} {t("实际房源仍需确认租期、押金、账单范围、担保人及取消政策。")}</p><p className="detail-note">{t("这是一套虚构演示房源，名字、地理位置、房型和价格都用于交互验证。不同参考图片来自不同室内空间，不应视为同一套公寓。")}</p></section>}<aside><GraduationCap size={29}/><h3>{building?.name??cityView.university}</h3><p>{cityView.campus}</p><div className="verification-list"><p><span/>{t("步行路线：按真实路网计算，入口待核验")}</p><p><span/>{t("区域安全：待数据核验")}</p><p><span/>{t("购物便利：待数据核验")}</p></div><ListingCommute listing={listing}/><button type="button" className="listing-viewing-button" onClick={()=>{trackAtlasEvent({name:"viewing_entry_click",listingId:listing.id,cityId:listing.cityId,locale});setViewingOpen(true);}}>{t("预约看房或咨询")}</button><a className="primary-button" href={`/?${context}`}>{t("在城市中定位")} <ArrowRight size={16}/></a><a className="secondary-button detail-route-link" href={`/?${context}&route=walk`}>{t("到学校路线")} <Footprints size={16}/></a></aside></div><ListingDossier key={listing.id} listing={listing} hideFacts={!!listing.merchant}/><ViewingRequestSheet listing={listing} open={viewingOpen} onOpenChange={setViewingOpen}/><footer>{!listing.merchant&&<a href="/photos/sources.json" target="_blank">{t("照片来源与授权 ↗")}</a>}<span>{t("Campus Atlas · 验证样本")}</span></footer></main>;
}
