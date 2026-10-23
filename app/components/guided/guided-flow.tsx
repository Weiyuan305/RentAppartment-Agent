"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useListings } from "@/components/listing-catalog-provider";
import { useLocale } from "@/components/locale-provider";
import { usePersonalLibrary } from "@/components/personal-library-provider";
import { parseCityAmenities } from "@/lib/amenities";
import { getCity } from "@/lib/rental-data";
import { buildingById, buildingRouteUrl } from "@/lib/student/catalog";
import { viewingFieldError } from "@/lib/viewing-contact";
import {
  answerChips, answersFromAgent, budgetChoices, buildingLabel, clearChip, commuteFact, compareHome, contextLine,
  emptyAnswers, formatPounds, groceryFact, guidedRentalState, moveInChoices, oneLineReason, priorityChoices,
  questionBuildings, questionSteps, shortlistHomes, signpost, type GuidedAnswers, type PlacePoint, type QuestionStep, type ShortHome,
} from "@/lib/guided/decide";
import { chooseGuidedMapProvider, downloadConsent, localDataTimeoutMs, photorealisticConfigured, readProviderPreference, readRememberedProvider, shouldLoad3D, unmeteredConnection } from "@/lib/guided/map-provider";
import GuidedAdvisor from "./guided-advisor";
import GuidedMap from "./guided-map";
import type { RentalState } from "@/lib/agent/contract";

const prompts: Record<QuestionStep, { title: string; detail: string }> = {
  building: { title: "你主要在哪栋楼上课？", detail: "曼彻斯特大学牛津路。步行时间用已经保存的路网，不临时问路网。" },
  budget: { title: "每周房租预算大概多少？", detail: "账单另计的，对比里月总支出会写成未知。" },
  moveIn: { title: "打算什么时候入住？", detail: "只记在你的条件里。演示房源上的日期不是合同。" },
  living: { title: "一个人住，还是合租？", detail: "再点一下你最在意的事。可以跳过。" },
};

const stages = ["shortlist", "compare", "detail", "viewing"] as const;
type Stage = (typeof stages)[number];
const stageLabel = { shortlist: "短名单", compare: "对比", detail: "详情", viewing: "看房" } as const;

function readConnection() {
  const nav = navigator as Navigator & { connection?: { type?: string; saveData?: boolean } };
  return nav.connection ?? null;
}

export default function GuidedFlow({ country }: { country: string | null }) {
  const listings = useListings();
  const { t } = useLocale();
  const library = usePersonalLibrary();
  const [step, setStep] = useState(0);
  const [asking, setAsking] = useState(true);
  const [answers, setAnswers] = useState<GuidedAnswers>(emptyAnswers);
  const [answeredOnce, setAnsweredOnce] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [shell, setShell] = useState<{ mobile: boolean; unmetered: boolean } | null>(null);
  const [places, setPlaces] = useState<PlacePoint[]>([]);
  const [stage, setStage] = useState<Stage>("shortlist");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [source, setSource] = useState<"guided" | "agent">("guided");
  const [agentState, setAgentState] = useState<RentalState | null>(null);
  const [route, setRoute] = useState<Array<[number, number]> | null>(null);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [viewForm, setViewForm] = useState({ name: "", contact: "", time: "", message: "", video: false, tried: false, pending: false, done: false, error: "" });
  const buildings = questionBuildings();
  const question = questionSteps[step] ?? "living";

  useEffect(() => {
    const query = window.matchMedia("(max-width: 899px)");
    const read = () => setShell({ mobile: query.matches, unmetered: unmeteredConnection(readConnection()) });
    read();
    query.addEventListener("change", read);
    const connection = readConnection() as { addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } | null;
    connection?.addEventListener?.("change", read);
    return () => {
      query.removeEventListener("change", read);
      connection?.removeEventListener?.("change", read);
    };
  }, []);

  useEffect(() => {
    if (asking && !answeredOnce) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), localDataTimeoutMs);
    void fetch("/amenities/manchester.json", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("amenities");
      const parsed = parseCityAmenities(await response.json(), getCity("manchester"));
      setPlaces(parsed.places.map(place => ({
        name: place.name,
        lng: place.lng,
        lat: place.lat,
        category: place.category,
        origin: place.tags.origin ?? place.tags.cuisine,
      })));
    }).catch(() => setPlaces([])).finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [asking, answeredOnce]);

  const ranked = useMemo(() => shortlistHomes(listings, answers, places), [listings, answers, places]);
  const homes = useMemo(() => {
    if (!pinnedId || ranked.some(home => home.listing.id === pinnedId)) return ranked;
    const listing = listings.find(item => item.id === pinnedId && item.cityId === "manchester");
    if (!listing) return ranked;
    const commute = commuteFact(listing, answers.buildingId);
    const grocery = groceryFact(listing, places);
    const extra: ShortHome = { listing, commute, grocery, stretch: [], reason: oneLineReason(listing, answers, commute, grocery), sign: signpost(commute) };
    return [extra, ...ranked].slice(0, 5);
  }, [ranked, pinnedId, listings, answers, places]);

  useEffect(() => {
    if (asking || selectedId || !homes[0]) return;
    setSelectedId(homes[0].listing.id);
  }, [asking, homes, selectedId]);

  useEffect(() => {
    if (!selectedId) { setRoute(null); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), localDataTimeoutMs);
    const url = answers.buildingId ? buildingRouteUrl(selectedId, answers.buildingId) : `/routes/${selectedId}.json`;
    void fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("route");
      const body = await response.json() as { coordinates?: Array<[number, number]> };
      if (!body.coordinates || body.coordinates.length < 2) throw new Error("route");
      setRoute(body.coordinates);
    }).catch(() => setRoute(null)).finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [selectedId, answers.buildingId]);

  const load3d = shell ? shouldLoad3D({ mobile: shell.mobile, unmetered: shell.unmetered, answeredOnce, asking, accepted }) : false;
  const selected = homes.find(home => home.listing.id === selectedId) ?? null;
  const guidedState = guidedRentalState(answers, selected?.listing.id ?? homes[0]?.listing.id ?? "manchester-1", Boolean(selected));
  const rentalState = source === "agent" && agentState ? agentState : guidedState;
  const compared = homes.map(home => compareHome(home.listing, answers, places));
  const detail = selected ? compareHome(selected.listing, answers, places) : null;
  const saved = selected ? Boolean(library.favorites[selected.listing.id]?.saved) : false;
  const chips = answerChips(answers);
  const mobile = shell?.mobile ?? false;
  const consentChoice = shell ? chooseGuidedMapProvider({
    preference: readProviderPreference((import.meta.env as { VITE_GUIDED_MAP_PROVIDER?: string }).VITE_GUIDED_MAP_PROVIDER),
    webgl: true,
    googleReachable: country !== "CN",
    photorealisticConfigured: photorealisticConfigured(import.meta.env as { VITE_MAP_PROVIDER?: string; VITE_CESIUM_ION_ACCESS_TOKEN?: string; VITE_GOOGLE_MAPS_API_KEY?: string }),
    country,
    remembered: readRememberedProvider(window.localStorage),
  }) : null;
  const consent = downloadConsent(consentChoice?.provider ?? "osm-buildings", true);

  function choose<T extends GuidedAnswers[keyof GuidedAnswers]>(patch: Partial<GuidedAnswers>, advance: boolean) {
    setAnsweredOnce(true);
    setSource("guided");
    setAnswers(current => ({ ...current, ...patch }));
    if (advance) {
      if (step >= questionSteps.length - 1) setAsking(false);
      else setStep(value => value + 1);
    }
  }

  function finish() {
    setAnsweredOnce(true);
    setAsking(false);
  }

  function selectHome(id: string) {
    setSource("guided");
    setSelectedId(id);
    setAdvisorOpen(mobile);
    if (stage === "viewing") setStage("detail");
  }

  async function submitViewing(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const next = { ...viewForm, tried: true };
    setViewForm(next);
    if (viewingFieldError("name", next.name, true) || viewingFieldError("contact", next.contact, true) || viewingFieldError("preferredTime", next.time, true)) return;
    setViewForm(current => ({ ...current, pending: true, error: "" }));
    const response = await fetch("/api/viewing-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: selected.listing.id,
        cityId: "manchester",
        name: next.name.trim(),
        contact: next.contact.trim(),
        preferredTime: next.video ? `视频看房 · ${next.time.trim()}` : next.time.trim(),
        message: next.message.trim(),
      }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setViewForm(current => ({ ...current, pending: false, error: payload.error || "没有记下。" }));
      return;
    }
    setViewForm(current => ({ ...current, pending: false, done: true }));
  }

  return (
    <main className="gd-app">
      <h1 className="gd-12" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>帮你决定 · 曼彻斯特大学</h1>
      <GuidedMap
        country={country}
        asking={asking}
        load3d={load3d}
        homes={asking ? [] : homes}
        selectedId={asking ? null : selectedId}
        buildingId={answers.buildingId}
        route={asking ? null : route}
        places={places}
        onSelect={selectHome}
      />
      {asking ? (
        <section className="gd-questions" aria-labelledby="gd-question">
          <header>
            <p className="gd-13 gd-secondary">曼彻斯特大学 · 牛津路</p>
            <p className="gd-13">{step + 1} / {questionSteps.length}</p>
          </header>
          <div className="gd-progress" aria-hidden="true"><span style={{ width: `${((step + 1) / questionSteps.length) * 100}%` }} /></div>
          <h2 id="gd-question" className="gd-40">{prompts[question].title}</h2>
          <p className="gd-secondary">{prompts[question].detail}</p>
          <div className="gd-options">
            {question === "building" ? buildings.map(building => (
              <button key={building.id} type="button" aria-pressed={answers.buildingId === building.id} onClick={() => choose({ buildingId: building.id }, true)}>
                <strong className="gd-17">{building.title}</strong>
                <span className="gd-13 gd-secondary"> {building.detail}</span>
              </button>
            )) : null}
            {question === "budget" ? budgetChoices.map(amount => (
              <button key={amount} type="button" aria-pressed={answers.weeklyBudget === amount} onClick={() => choose({ weeklyBudget: amount }, true)}>
                <strong className="gd-17">每周 {formatPounds(amount)}</strong>
              </button>
            )) : null}
            {question === "moveIn" ? moveInChoices.map(choice => (
              <button key={choice.value} type="button" aria-pressed={answers.moveIn === choice.value} onClick={() => choose({ moveIn: choice.value }, true)}>
                <strong className="gd-17">{choice.label}</strong>
              </button>
            )) : null}
            {question === "living" ? (
              <>
                <button type="button" aria-pressed={answers.living === "alone"} onClick={() => choose({ living: "alone" }, false)}><strong className="gd-17">一个人住</strong></button>
                <button type="button" aria-pressed={answers.living === "shared"} onClick={() => choose({ living: "shared" }, false)}><strong className="gd-17">合租</strong></button>
                <div className="gd-chips" aria-label="最在意">
                  {priorityChoices.map(choice => (
                    <button key={choice.id} type="button" aria-pressed={answers.priority === choice.id} onClick={() => choose({ priority: choice.id }, false)}>{choice.label}</button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <footer>
            <button type="button" className="gd-text-button" disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))}>上一步</button>
            <button type="button" className="gd-text-button" onClick={finish}>跳过</button>
            {question === "living" ? <button type="button" className="gd-primary" onClick={finish}>看这几套</button> : null}
          </footer>
        </section>
      ) : (
        <div className="gd-workspace">
          <section className="gd-column" data-stage={stage} aria-label={stageLabel[stage]}>
            <header>
              <h2 className="gd-17">{stage === "shortlist" ? "按你的回答，先看这几套" : stageLabel[stage]}</h2>
              {stage !== "shortlist" ? <button type="button" className="gd-text-button" onClick={() => setStage("shortlist")}>回到短名单</button> : null}
            </header>
            <div className="gd-steps">
              {stages.map(item => (
                <button key={item} type="button" onClick={() => { if (item === "shortlist" || item === "compare" || selected) setStage(item); }}>
                  <span aria-current={stage === item ? "step" : undefined}>{stageLabel[item]}</span>
                </button>
              ))}
            </div>
            <div className="gd-chips">
              {chips.map(chip => (
                <button key={chip.id} type="button" onClick={() => { setSource("guided"); setAnswers(current => clearChip(current, chip.id)); }}>{chip.label} ×</button>
              ))}
            </div>
            {stage === "shortlist" ? (
              <div className="gd-scroll">
                {homes.map(home => (
                  <button key={home.listing.id} type="button" className={home.listing.id === selectedId ? "gd-home is-selected" : "gd-home"} onClick={() => selectHome(home.listing.id)}>
                    <strong className="gd-17">{home.listing.name}</strong>
                    <p className="gd-13 gd-secondary">{home.listing.area} · {home.listing.roomType} · 每周 {formatPounds(home.listing.price)}</p>
                    <p>{home.reason}</p>
                    <span className="gd-signline">{home.sign}</span>
                    {home.stretch.length ? <p className="gd-13 gd-secondary">{home.stretch.join("，")}</p> : null}
                  </button>
                ))}
                <div style={{ padding: 16 }}>
                  <button type="button" className="gd-text-button" onClick={() => setStage("compare")}>并排对比</button>
                </div>
              </div>
            ) : null}
            {stage === "compare" ? (
              <div className="gd-scroll">
                <div className="gd-compare" style={{ ["--homes" as string]: String(compared.length) }}>
                  <div className="gd-metric">房子</div>
                  {compared.map(home => <div key={home.listingId}><button type="button" onClick={() => { selectHome(home.listingId); setStage("detail"); }}><strong>{home.name}</strong><br /><span className="gd-13 gd-secondary">{home.area}</span></button></div>)}
                  {(["monthlyTotal", "rent", "bills", "commute", "contract", "deposit", "trust"] as const).map(key => {
                    const label = { monthlyTotal: "月总支出", rent: "租金", bills: "账单", commute: "通勤", contract: "合同", deposit: "押金", trust: "房东/运营" }[key];
                    return [
                      <div key={`${key}-label`} className="gd-metric">{label}</div>,
                      ...compared.map(home => <div key={`${key}-${home.listingId}`}><strong>{home[key].text}</strong>{home[key].detail ? <p className="gd-12 gd-secondary">{home[key].detail}</p> : null}</div>),
                    ];
                  })}
                  <div className="gd-metric">风险</div>
                  {compared.map(home => <div key={`risk-${home.listingId}`}>{home.risks.map(risk => <p key={risk} className="gd-12">{risk}</p>)}</div>)}
                </div>
              </div>
            ) : null}
            {stage === "detail" && selected && detail ? (
              <div className="gd-scroll gd-detail">
                <img src={selected.listing.photos[0]} alt="" />
                <h2 className="gd-22">{detail.name}</h2>
                <p className="gd-secondary">{selected.reason}</p>
                <div className="gd-facts">
                  {(["monthlyTotal", "rent", "bills", "commute", "contract", "deposit", "trust"] as const).map(key => {
                    const label = { monthlyTotal: "月总支出", rent: "租金", bills: "账单", commute: "通勤", contract: "合同", deposit: "押金", trust: "房东/运营" }[key];
                    return <div key={key}><span className="gd-13 gd-secondary">{label}</span><span><strong>{detail[key].text}</strong>{detail[key].detail ? <p className="gd-12 gd-secondary">{detail[key].detail}</p> : null}</span></div>;
                  })}
                </div>
                {detail.risks.map(risk => <p key={risk} className="gd-13">{risk}</p>)}
                <p className="gd-13 gd-secondary">上课地点：{buildingLabel(answers.buildingId)}。{buildingById(answers.buildingId)?.name ?? "牛津路校区"}</p>
                <button type="button" className="gd-primary" onClick={() => setStage("viewing")}>预约看房</button>
                <button type="button" className="gd-text-button" onClick={() => void library.toggleFavorite(selected.listing.id)}>{saved ? "已在个人库" : "先放进个人库"}</button>
                <p className="gd-13 gd-secondary">准备材料和签约是看完房之后的事。这里没有电子签，也不会把演示日期当成租期。</p>
              </div>
            ) : null}
            {stage === "viewing" && selected ? (
              <div className="gd-scroll gd-detail">
                <h2 className="gd-22">预约看房 · {selected.listing.name}</h2>
                {viewForm.done ? (
                  <p>已记下看房意向。这不是预订，房东确认前不会锁房。材料准备和签约要等对方给出真实合同，这里不能代签。</p>
                ) : (
                  <form className="gd-form" onSubmit={event => void submitViewing(event)}>
                    <label>姓名
                      <input value={viewForm.name} onChange={event => setViewForm(current => ({ ...current, name: event.target.value }))} autoComplete="name" />
                      <span className="gd-error">{t(viewingFieldError("name", viewForm.name, viewForm.tried))}</span>
                    </label>
                    <label>邮箱或电话
                      <input value={viewForm.contact} onChange={event => setViewForm(current => ({ ...current, contact: event.target.value }))} autoComplete="email" />
                      <span className="gd-error">{t(viewingFieldError("contact", viewForm.contact, viewForm.tried))}</span>
                    </label>
                    <label>方便的时间
                      <input value={viewForm.time} onChange={event => setViewForm(current => ({ ...current, time: event.target.value }))} />
                      <span className="gd-error">{t(viewingFieldError("preferredTime", viewForm.time, viewForm.tried))}</span>
                    </label>
                    <label className="gd-check"><input type="checkbox" checked={viewForm.video} onChange={event => setViewForm(current => ({ ...current, video: event.target.checked }))} /> 改成视频看房</label>
                    <label>补充
                      <textarea value={viewForm.message} maxLength={500} onChange={event => setViewForm(current => ({ ...current, message: event.target.value }))} />
                    </label>
                    {viewForm.error ? <p className="gd-error">{viewForm.error}</p> : null}
                    <button className="gd-primary" type="submit" disabled={viewForm.pending}>预约看房</button>
                  </form>
                )}
              </div>
            ) : null}
          </section>
          <div className="gd-center" />
          <GuidedAdvisor
            state={rentalState}
            note={selected ? contextLine(selected, answers) : ""}
            homeCount={homes.length}
            mobile={mobile}
            open={advisorOpen}
            onOpen={setAdvisorOpen}
            onAgentState={next => {
              if (next.cityId !== "manchester") return;
              setAgentState(next);
              setSource("agent");
              setAnswers(current => answersFromAgent(current, next));
              setSelectedId(next.listingId);
              setPinnedId(next.listingId);
            }}
          />
        </div>
      )}
      {shell && !asking && !load3d ? (
        <div className="gd-consent">
          <p className="gd-17">{consent.title}</p>
          <p className="gd-13 gd-secondary">{consentChoice?.reason === "country" ? "从中国访问时，默认用本校托管的建筑，不请求 Google。" : consent.detail}</p>
          <button type="button" className="gd-primary" onClick={() => setAccepted(true)}>{consent.action}</button>
        </div>
      ) : null}
    </main>
  );
}
