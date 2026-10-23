"use client";
import { useListings } from "@/components/listing-catalog-provider";
import { useLocale } from "@/components/locale-provider";
import { emptyMapSelection, type RentalState } from "@/lib/agent/contract";
import { priceLabel, type Listing } from "@/lib/rental-data";
import { applyInterpretation, interpretAdvisorText } from "@/lib/v2/interpret";
import { readStoredProvider, selectMapProvider, writeStoredProvider, type MapProviderId } from "@/lib/v2/map-provider";
import type { CountrySource } from "@/lib/v2/visitor-country";
import { clearPreferences, countChangeLabel, emptyPreferences, preferenceChips, removePreference, visibleHomes, type Preferences, type PriorityChoice, type ShareChoice } from "@/lib/v2/preferences";
import { selectionNote } from "@/lib/v2/selection-note";
import { preferencesFromIntro, shortlistHomes, type IntroAnswers } from "@/lib/v2/shortlist";
import { signpostMinutes, signpostPlace } from "@/lib/v2/signpost";
import { buildingsInCity } from "@/lib/student/catalog";
import { emptyStudentPlan } from "@/lib/student/state";
import { useBuildingRoute } from "@/lib/student/use-student-journey";
import { useWalkingRoute } from "@/lib/use-walking-route";
import { useEffect, useMemo, useState } from "react";
import { Signpost } from "./signpost";
import { V2Advisor } from "./v2-advisor";
import { V2CityStage, type StageFocus } from "./v2-city-stage";
import { V2Booking, V2Compare, V2Detail } from "./v2-panels";

const BUDGETS = [150, 200, 250, 300] as const;

export default function V2Shell({ mode, country, countrySource, mapQuery }: {
  mode: "overview" | "guided";
  country: string | null;
  countrySource: CountrySource;
  mapQuery: string | null;
}) {
  const listings = useListings();
  const { locale } = useLocale();
  const lang = locale === "en" ? "en" : "zh";
  const cityHomes = useMemo(() => listings.filter((listing) => listing.cityId === "manchester"), [listings]);
  const [prefs, setPrefs] = useState<Preferences>(emptyPreferences);
  const [selectedId, setSelectedId] = useState("manchester-1");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [panel, setPanel] = useState<"none" | "detail" | "booking" | "compare">("none");
  const [closing, setClosing] = useState(false);
  const [intro, setIntro] = useState(mode === "guided");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<IntroAnswers>({ buildingId: null, budget: null, moveIn: null, share: null, priority: null });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<StageFocus>({ token: 0, lng: -2.2349, lat: 53.4668, altitude: "overview" });
  const [advisorNote, setAdvisorNote] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [listTick, setListTick] = useState(0);
  const configured = (import.meta.env as { VITE_V2_MAP_PROVIDER?: string }).VITE_V2_MAP_PROVIDER ?? null;
  const initialProvider = selectMapProvider({ country, query: mapQuery, stored: null, configured });
  const storageMayOverride = initialProvider.reason !== "country-cn" && initialProvider.reason !== "query";
  const [providerId, setProviderId] = useState<MapProviderId>(initialProvider.provider);
  const [probeGoogle, setProbeGoogle] = useState(initialProvider.probeGoogle);
  const [providerReady, setProviderReady] = useState(!storageMayOverride);
  const [providerGeneration, setProviderGeneration] = useState(0);
  useEffect(() => {
    if (!storageMayOverride) return;
    const selected = selectMapProvider({ country, query: mapQuery, stored: readStoredProvider(window.localStorage), configured });
    setProviderId(selected.provider);
    setProbeGoogle(selected.probeGoogle);
    setProviderReady(true);
  }, [country, mapQuery, configured, storageMayOverride]);
  function chooseProvider(next: MapProviderId) {
    writeStoredProvider(window.localStorage, next);
    setProviderId(next);
    setProbeGoogle(next === "google-photorealistic");
    setProviderGeneration((value) => value + 1);
    setProviderReady(true);
  }
  const hold = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("advisorHold") === "1";
  const shown = useMemo(() => visibleHomes(cityHomes, prefs), [cityHomes, prefs]);
  const shownIds = useMemo(() => new Set(shown.map((listing) => listing.id)), [shown]);
  const selected = cityHomes.find((listing) => listing.id === selectedId) ?? shown[0] ?? cityHomes[0];
  const building = buildingsInCity("manchester").find((item) => item.id === prefs.buildingId);
  const campusRoute = useWalkingRoute(!building ? selected : undefined);
  const buildingRoute = useBuildingRoute(selected, building, Boolean(building));
  const route = (building ? buildingRoute.route : campusRoute.route)?.coordinates ?? null;
  const chips = preferenceChips(prefs, lang);
  const count = countChangeLabel(cityHomes.length, shown.length, lang);
  const rentalState: RentalState = {
    cityId: "manchester",
    listingId: selected?.id ?? "manchester-1",
    filters: prefs.filters,
    map: emptyMapSelection(),
    student: { ...emptyStudentPlan(), destinationId: prefs.buildingId, campusId: prefs.buildingId ? "manchester-main" : null, housing: prefs.housing, compareIds: compareIds.slice(0, 3) },
  };
  function fly(listing: Listing | undefined, altitude: StageFocus["altitude"]) {
    const lng = listing?.lng ?? -2.2349;
    const lat = listing?.lat ?? 53.4668;
    setFocus((current) => ({ token: current.token + 1, lng, lat, altitude }));
  }
  function choose(id: string) {
    const listing = cityHomes.find((item) => item.id === id);
    if (!listing) return;
    setSelectedId(id);
    fly(listing, "home");
    setAdvisorNote(selectionNote(listing, prefs.buildingId, prefs.filters.budget, lang));
  }
  function changePrefs(next: Preferences) {
    setPrefs(next);
    setListTick((value) => value + 1);
    setRevision((value) => value + 1);
  }
  function finishIntro(answers: IntroAnswers) {
    const picks = shortlistHomes(cityHomes, answers, lang);
    setReasons(Object.fromEntries(picks.map((pick) => [pick.id, pick.reason])));
    changePrefs(preferencesFromIntro(answers, picks.map((pick) => pick.id)));
    setIntro(false);
    const first = cityHomes.find((listing) => listing.id === picks[0]?.id);
    if (first) setSelectedId(first.id);
    fly(first, "campus");
  }
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") setPanel("none"); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const opening = intro ? "" : reasons[selected?.id ?? ""]
    ? (lang === "zh" ? `按你的回答，先看这 ${shown.length} 套。每一套下面有一句理由。` : `Here are ${shown.length} homes from your answers, each with one reason.`)
    : (lang === "zh" ? "你在曼彻斯特大学哪栋楼上课？也可以直接说预算、入住时间和是否合租，我会把房子标在这座城市上。" : "Which Manchester building do you study in? You can also say a budget, a move-in date, or whether you want to share.");
  return <div className={`v2${advisorOpen ? " advisor-open" : ""}${closing ? " is-closing" : ""}`} data-visitor-country={country ?? ""} data-country-source={countrySource} data-map-provider={providerId} data-probe-google={probeGoogle ? "true" : "false"}>
    {intro ? <Intro draft={draft} step={step} locale={lang} onDraft={setDraft} onStep={setStep} onSkip={() => { setIntro(false); fly(undefined, "overview"); }} onDone={() => finishIntro(draft)} /> : null}
    <section className="v2-list" aria-label={lang === "zh" ? "房源" : "Homes"}>
      <header>
        <p className="v2-kicker">Campus Atlas</p>
        <h1>{lang === "zh" ? "房源" : "Homes"}</h1>
        <p className="v2-count" role="status">{count}</p>
        <div className="v2-chips" aria-label={lang === "zh" ? "已用条件" : "Active filters"}>
          {chips.map((chip) => <button type="button" key={chip.id} onClick={() => changePrefs(removePreference(prefs, chip.id))}>{chip.label}<span aria-hidden="true"> ×</span></button>)}
          {chips.length ? <button type="button" className="v2-show-all" onClick={() => { setReasons({}); changePrefs(clearPreferences()); }}>{lang === "zh" ? "显示全部" : "Show all"}</button> : null}
        </div>
      </header>
      <div className="v2-rows" key={listTick}>
        {shown.map((listing) => <HomeRow key={listing.id} listing={listing} locale={lang} buildingId={prefs.buildingId} selected={listing.id === selected?.id} hovered={hoveredId === listing.id} reason={reasons[listing.id]} compared={compareIds.includes(listing.id)} onSelect={() => { choose(listing.id); setPanel("detail"); }} onHover={() => setHoveredId(listing.id)} onLeave={() => setHoveredId(null)} onCompare={() => toggleCompare(listing.id, compareIds, setCompareIds)} />)}
      </div>
      {compareIds.length >= 2 ? <button type="button" className="v2-compare-launch" onClick={() => setPanel("compare")}>{lang === "zh" ? `对比 ${compareIds.length} 套` : `Compare ${compareIds.length}`}</button> : null}
    </section>
    <V2CityStage providerId={providerId} providerReady={providerReady} probeGoogle={probeGoogle} country={country} startToken={providerGeneration} listings={cityHomes} selectedId={selected?.id ?? ""} shownIds={shownIds} hoveredId={hoveredId} buildingId={prefs.buildingId} locale={lang} focus={focus} route={route} onSelect={choose} onHover={setHoveredId} onProvider={chooseProvider} />
    <div className={`v2-advisor-slot${advisorOpen ? " is-open" : ""}`}>
      <button type="button" className="v2-advisor-peek" onClick={() => setAdvisorOpen((open) => !open)}>{lang === "zh" ? "问顾问" : "Ask the advisor"}</button>
      <V2Advisor state={rentalState} uiRevision={revision} homeCount={cityHomes.length} opening={opening} context={advisorNote} hold={hold} onBook={() => selected && setPanel("detail")} onOptimistic={(text) => {
        const ask = interpretAdvisorText(text, cityHomes);
        changePrefs(applyInterpretation(prefs, ask));
        const mentioned = ask.listingIds[0];
        if (mentioned) choose(mentioned);
        else if (ask.buildingId) fly(undefined, "campus");
      }} onState={(next) => {
        changePrefs({ ...prefs, filters: next.filters, housing: next.student?.housing ?? prefs.housing, buildingId: next.student?.destinationId ?? prefs.buildingId, shortlistIds: null });
        if (next.listingId) choose(next.listingId);
      }} />
    </div>
    <div className="v2-cards" aria-label={lang === "zh" ? "房源卡片" : "Home cards"}>
      {shown.map((listing) => <button type="button" key={listing.id} className={listing.id === selected?.id ? "is-on" : ""} onClick={() => { choose(listing.id); setPanel("detail"); }}>
        <img src={listing.photos[0]} alt="" />
        <strong>{priceLabel(listing)}</strong>
        <Signpost minutes={signpostMinutes(listing, prefs.buildingId)} place={signpostPlace(prefs.buildingId, lang)} />
      </button>)}
    </div>
    {panel === "detail" && selected ? <V2Detail listing={selected} buildingId={prefs.buildingId} locale={lang} onClose={() => dismiss(setPanel, setClosing)} onBook={() => setPanel("booking")} onCompare={() => {
      const next = compareIds.includes(selected.id) ? compareIds : [...compareIds, selected.id].slice(0, 3);
      setCompareIds(next);
      if (next.length >= 2) setPanel("compare");
    }} /> : null}
    {panel === "booking" && selected ? <V2Booking listing={selected} locale={lang} onClose={() => setPanel("detail")} /> : null}
    {panel === "compare" ? <V2Compare ids={compareIds.slice(0, 3)} listings={cityHomes} buildingId={prefs.buildingId} locale={lang} onClose={() => dismiss(setPanel, setClosing)} onOpen={(id) => { choose(id); setPanel("booking"); }} /> : null}
    <nav className="v2-mobile-links"><a href="/v2/guided">{lang === "zh" ? "30 秒问答" : "30 second questions"}</a></nav>
  </div>;
}

function HomeRow({ listing, locale, buildingId, selected, hovered, reason, compared, onSelect, onHover, onLeave, onCompare }: {
  listing: Listing; locale: "zh" | "en"; buildingId: string | null; selected: boolean; hovered: boolean; reason?: string; compared: boolean;
  onSelect: () => void; onHover: () => void; onLeave: () => void; onCompare: () => void;
}) {
  return <article className={`v2-row${selected ? " is-on" : ""}${hovered ? " is-hot" : ""}`} onMouseEnter={onHover} onMouseLeave={onLeave}>
    <button type="button" onClick={onSelect} onFocus={onHover} onBlur={onLeave}>
      <img src={listing.photos[0]} alt="" />
      <span>
        <strong>{priceLabel(listing)} <em>/ {locale === "zh" ? "周" : "wk"}</em></strong>
        <Signpost minutes={signpostMinutes(listing, buildingId)} place={signpostPlace(buildingId, locale)} />
        <small>{listing.area} · {listing.roomType}{listing.bills ? "" : locale === "zh" ? " · 账单另计" : " · bills extra"}</small>
        {reason ? <small className="v2-reason">{reason}</small> : null}
      </span>
    </button>
    <button type="button" className="v2-compare-add" aria-pressed={compared} onClick={onCompare}>{compared ? "✓" : "+"}</button>
  </article>;
}

function toggleCompare(id: string, ids: string[], setIds: (ids: string[]) => void) {
  if (ids.includes(id)) setIds(ids.filter((item) => item !== id));
  else if (ids.length < 3) setIds([...ids, id]);
}

function dismiss(setPanel: (panel: "none") => void, setClosing: (value: boolean) => void) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPanel("none"); return; }
  setClosing(true);
  window.setTimeout(() => { setPanel("none"); setClosing(false); }, 200);
}

function Intro({ draft, step, locale, onDraft, onStep, onSkip, onDone }: {
  draft: IntroAnswers; step: number; locale: "zh" | "en";
  onDraft: (next: IntroAnswers) => void; onStep: (step: number) => void; onSkip: () => void; onDone: () => void;
}) {
  const zh = locale === "zh";
  const buildings = buildingsInCity("manchester");
  const last = step === 4;
  return <section className="v2-intro" aria-labelledby="v2-intro-title">
    <p>{zh ? "大约 30 秒" : "About 30 seconds"}</p>
    <h1 id="v2-intro-title">{[zh ? "你在哪栋楼上课？" : "Where do you study?", zh ? "每周预算？" : "Weekly budget?", zh ? "打算哪天入住？" : "When do you move in?", zh ? "一个人住，还是合租？" : "Alone or shared?", zh ? "最在意什么？" : "What matters most?"][step]}</h1>
    {step === 0 ? <div className="v2-choices">{buildings.map((building) => <button type="button" key={building.id} className={draft.buildingId === building.id ? "is-on" : ""} onClick={() => onDraft({ ...draft, buildingId: building.id })}>{zh ? (building.aliases.find((alias) => /[\u4e00-\u9fff]/.test(alias)) ?? building.name) : building.name}</button>)}</div> : null}
    {step === 1 ? <div className="v2-choices">{BUDGETS.map((budget) => <button type="button" key={budget} className={draft.budget === budget ? "is-on" : ""} onClick={() => onDraft({ ...draft, budget })}>{`≤£${budget}`}</button>)}<button type="button" className={draft.budget == null ? "is-on" : ""} onClick={() => onDraft({ ...draft, budget: null })}>{zh ? "不限" : "No limit"}</button></div> : null}
    {step === 2 ? <label className="v2-date">{zh ? "入住日期" : "Move-in date"}<input type="date" value={draft.moveIn ?? ""} onChange={(event) => onDraft({ ...draft, moveIn: event.target.value || null })} /></label> : null}
    {step === 3 ? <div className="v2-choices">{(["alone", "shared"] as ShareChoice[]).map((share) => <button type="button" key={share} className={draft.share === share ? "is-on" : ""} onClick={() => onDraft({ ...draft, share })}>{share === "alone" ? (zh ? "单住" : "Alone") : (zh ? "合租" : "Shared")}</button>)}</div> : null}
    {step === 4 ? <div className="v2-choices">{(["commute", "budget", "bills"] as PriorityChoice[]).map((priority) => <button type="button" key={priority} className={draft.priority === priority ? "is-on" : ""} onClick={() => onDraft({ ...draft, priority })}>{priority === "commute" ? (zh ? "通勤近" : "Short commute") : priority === "budget" ? (zh ? "租金低" : "Lower rent") : (zh ? "账单包含" : "Bills included")}</button>)}</div> : null}
    <div className="v2-intro-actions">
      <button type="button" className="v2-primary" onClick={() => last ? onDone() : onStep(step + 1)}>{last ? (zh ? "看这几套房子" : "Show these homes") : (zh ? "下一步" : "Next")}</button>
      <button type="button" className="v2-quiet" onClick={onSkip}>{zh ? "跳过，直接看地图" : "Skip, show me the map"}</button>
    </div>
  </section>;
}
