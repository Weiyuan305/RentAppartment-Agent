"use client";
/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- Authenticated photos and full navigation preserve the existing vinext routing boundary. */
import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Plus,
  RefreshCw,
  Search,
  X,
  Upload,
  Copy,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { useLocale } from "../locale-provider";
import { LanguageSwitch } from "../language-switch";
import { AccountMenu } from "../account-menu";
import { BrandMark } from "../brand-mark";
import { authClient } from "@/lib/auth-client";
import { cities, getCity, type CityId, type Listing } from "@/lib/rental-data";
import { useListings } from "../listing-catalog-provider";
import {
  newProperty,
  publicationIssues,
  propertySchema,
  type Application,
  type Merchant,
  type Property,
  type PropertyRecord,
  type Conversation,
} from "@/lib/merchant/model";
import "./workbench.css";
import { PropertyLocation } from "./property-location";
import { MediaLibrary } from "./media-library";

type Dashboard = {
  admin: boolean;
  merchant: Merchant | null;
  properties: PropertyRecord[];
  merchants?: Merchant[];
  conversations?: Conversation[];
  reports?: { id: string; listing: string; reason: string; resolved: number }[];
  audit?: { action: string; target: string; reason: string; created: number }[];
};
const api = async (body: unknown) => {
  const r = await fetch("/api/merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    data = (await r.json()) as { error?: string; id: string };
  if (!r.ok) throw new Error(data.error);
  return data as { id?: string };
};
function useWords() {
  const { locale } = useLocale();
  return (zh: string, en: string) => (locale === "zh" ? zh : en);
}
const statusNames: Record<string, [string, string]> = {
  draft: ["草稿", "Draft"],
  pending: ["待审核", "In review"],
  approved: ["审核通过", "Approved"],
  rejected: ["需修改", "Changes requested"],
  offline: ["已下架", "Offline"],
  open: ["待处理", "Open"],
  accepted: ["已确认", "Accepted"],
  declined: ["已婉拒", "Declined"],
  closed: ["已结束", "Closed"],
};
function Status({ value }: { value: string }) {
  const w = useWords(),
    n = statusNames[value] ?? [value, value];
  return (
    <span className={`mw-status mw-status-${value}`}>{w(n[0], n[1])}</span>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "mw-field mw-wide" : "mw-field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export default function Workbench({
  mode,
}: {
  mode: "merchant" | "admin" | "student";
}) {
  const w = useWords(),
    {
      data: session,
      isPending,
      error: sessionError,
      refetch: retrySession,
    } = authClient.useSession(),
    [snapshot, setData] = useState<(Dashboard & { accountId: string }) | null>(
      null,
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<PropertyRecord | null | undefined>(),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [tab, setTab] = useState("properties");
  const userId = session?.user.id;
  const data = snapshot?.accountId === userId ? snapshot : null;
  useEffect(() => {
    if (!userId) return;
    const c = new AbortController();
    fetch(`/api/merchant?mode=${mode}`, { signal: c.signal })
      .then(async (r) => {
        const d = (await r.json()) as Dashboard & { error?: string };
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then((d) => {
        if (!c.signal.aborted) setData({ ...d, accountId: userId });
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [mode, userId, revision]);
  async function run(body: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await api(body);
      setRevision((v) => v + 1);
      setNotice("saved");
      return r;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const perform = (body: unknown) => void run(body).catch(() => {});
  const title =
    mode === "admin"
      ? w("平台审核", "Platform review")
      : mode === "student"
        ? w("咨询与预约", "Enquiries & viewings")
        : w("商家工作台", "Partner workspace");
  return (
    <main className="merchant-workbench">
      <header className="mw-header">
        <a className="mw-brand" href="/">
          <BrandMark />
          <span>Campus Atlas</span>
        </a>
        <div>
          <LanguageSwitch />
          <AccountMenu />
        </div>
      </header>
      <div className="mw-shell">
        <nav
          className="mw-nav"
          aria-label={w("工作台导航", "Workspace navigation")}
        >
          <a href="/">
            <ArrowLeft size={16} />
            {w("回到找房", "Find a home")}
          </a>
          <a
            href="/merchant"
            aria-current={mode === "merchant" ? "page" : undefined}
          >
            <Building2 size={17} />
            {w("商家工作台", "Partner workspace")}
          </a>
          <a
            href="/inquiries"
            aria-current={mode === "student" ? "page" : undefined}
          >
            <MessageSquare size={17} />
            {w("我的咨询", "My enquiries")}
          </a>
          {data?.admin && (
            <a
              href="/admin"
              aria-current={mode === "admin" ? "page" : undefined}
            >
              <ShieldCheck size={17} />
              {w("平台审核", "Platform review")}
            </a>
          )}
        </nav>
        <div className="mw-content">
          <div className="mw-heading">
            <div>
              <p className="mw-eyebrow">
                CAMPUS ATLAS /{" "}
                {mode === "admin"
                  ? "REVIEW"
                  : mode === "student"
                    ? "CONVERSATIONS"
                    : "PARTNERS"}
              </p>
              <h1>{title}</h1>
              <p>
                {mode === "merchant"
                  ? w(
                      "把房源信息整理清楚，让学生安心做选择。",
                      "Clear information helps students choose with confidence.",
                    )
                  : mode === "admin"
                    ? w(
                        "先核对资料，再公开发布。审核不代表实地核验。",
                        "Review before publication. Approval is not an on-site inspection.",
                      )
                    : w(
                        "与商家确认房源和看房安排；不会分享你的 AI 对话或私人看房笔记。",
                        "Confirm details with the host. Your AI chats and private notes stay private.",
                      )}
              </p>
            </div>
            {session?.user && (
              <button
                className="mw-icon"
                aria-label={w("刷新", "Refresh")}
                onClick={() => setRevision((v) => v + 1)}
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>
          {error && (
            <div className="mw-error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <p role="status" className="mw-notice">
              <Check size={15} />
              {w("已保存", "Saved")}
            </p>
          )}
          {isPending ? (
            <p role="status">{w("正在读取账号…", "Loading account…")}</p>
          ) : sessionError ? (
            <section className="mw-card mw-empty" role="alert">
              <h2>{w("暂时无法读取账号", "Unable to load your account")}</h2>
              <p>
                {w(
                  "请检查网络后重试，已保存的房源不会丢失。",
                  "Check your connection and try again. Your saved properties are safe.",
                )}
              </p>
              <button
                className="mw-primary"
                onClick={() => void retrySession()}
              >
                <RefreshCw size={18} />
                {w("重新连接账号", "Retry account connection")}
              </button>
            </section>
          ) : !session?.user ? (
            <section className="mw-card mw-empty">
              <h2>{w("登录后继续", "Sign in to continue")}</h2>
              <p>
                {w(
                  "使用现有邮箱或 Google 账号。游客仍可浏览所有公开房源。",
                  "Use your email or Google account. Guests can still browse published homes.",
                )}
              </p>
              <a
                className="mw-primary"
                href={`/login?next=/${mode === "student" ? "inquiries" : mode}`}
                onClick={(e) => {
                  e.currentTarget.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
                }}
              >
                {w("登录 / 注册", "Sign in / Register")}
                <ArrowRight size={16} />
              </a>
            </section>
          ) : !data ? (
            <p role="status">
              {error
                ? w("请刷新重试。", "Refresh to retry.")
                : w("正在加载…", "Loading…")}
            </p>
          ) : (
            <>
              {mode === "merchant" &&
              (!data.merchant || data.merchant.status !== "approved") ? (
                <ApplicationForm
                  key={data.merchant?.version ?? "new"}
                  merchant={data.merchant}
                  busy={busy}
                  onSubmit={perform}
                />
              ) : mode === "merchant" && editing !== undefined ? (
                <PropertyEditor
                  key={editing?.id ?? "new"}
                  record={editing}
                  defaultCityId={data.merchant?.defaultCityId ?? "london"}
                  accountId={session.user.id}
                  busy={busy}
                  run={run}
                  onClose={() => setEditing(undefined)}
                />
              ) : (
                <>
                  {mode === "merchant" && (
                    <>
                      <div className="mw-default-city">
                        <div>
                          <span>
                            {w(
                              "新增房源默认城市",
                              "Default city for new homes",
                            )}
                          </span>
                          <strong>
                            {w(
                              getCity(data.merchant!.defaultCityId).name,
                              getCity(data.merchant!.defaultCityId).english,
                            )}
                          </strong>
                          <small>
                            {w(
                              "已跟账号保存，新房源自动沿用",
                              "Saved to your account; applied to new homes",
                            )}
                          </small>
                        </div>
                        <details>
                          <summary>{w("切换城市", "Change city")}</summary>
                          <label className="mw-field">
                            <span>{w("默认城市", "Default city")}</span>
                            <select
                              value={data.merchant!.defaultCityId}
                              disabled={busy}
                              onChange={(e) => {
                                const cityId = getCity(e.target.value).id;
                                void run({ kind: "setCity", cityId })
                                  .then(() => {
                                    setData((current) =>
                                      current &&
                                      current.accountId === userId &&
                                      current.merchant
                                        ? {
                                            ...current,
                                            merchant: {
                                              ...current.merchant,
                                              defaultCityId: cityId,
                                            },
                                          }
                                        : current,
                                    );
                                  })
                                  .catch(() => {});
                              }}
                            >
                              {cities.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {w(c.name, c.english)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </details>
                      </div>
                      <div className="mw-metrics">
                        {[
                          [w("房源", "Properties"), data.properties.length],
                          [
                            w("待审核", "In review"),
                            data.properties.filter(
                              (p) => p.status === "pending",
                            ).length,
                          ],
                          [
                            w("待处理咨询", "Open enquiries"),
                            data.conversations?.filter(
                              (c) => c.status === "open",
                            ).length ?? 0,
                          ],
                        ].map(([label, n]) => (
                          <div key={label}>
                            <span>{label}</span>
                            <strong>{n}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="mw-tabs">
                        <button
                          aria-pressed={tab === "properties"}
                          onClick={() => setTab("properties")}
                        >
                          {w("房源管理", "Properties")}
                        </button>
                        <button
                          aria-pressed={tab === "conversations"}
                          onClick={() => setTab("conversations")}
                        >
                          {w("咨询与预约", "Enquiries & viewings")}
                        </button>
                        <button
                          aria-pressed={tab === "media"}
                          onClick={() => setTab("media")}
                        >
                          {w("图片库", "Photo library")}
                        </button>
                      </div>
                    </>
                  )}
                  {mode === "admin" && (
                    <AdminQueue data={data} busy={busy} run={perform} />
                  )}
                  {mode === "merchant" && tab === "media" && (
                    <div className="mw-card">
                      <MediaLibrary />
                    </div>
                  )}
                  {mode === "merchant" && tab === "properties" && (
                    <>
                      <div className="mw-toolbar">
                        <label className="mw-search">
                          <Search size={17} />
                          <input
                            aria-label={w("搜索房源", "Search properties")}
                            placeholder={w(
                              "搜索房源名称",
                              "Search property name",
                            )}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </label>
                        <select
                          aria-label={w("房源状态", "Property status")}
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="all">
                            {w("全部状态", "All statuses")}
                          </option>
                          {Object.entries(statusNames)
                            .slice(0, 5)
                            .map(([v, n]) => (
                              <option key={v} value={v}>
                                {w(...n)}
                              </option>
                            ))}
                        </select>
                        <button
                          className="mw-primary"
                          disabled={busy}
                          onClick={() => setEditing(null)}
                        >
                          <Plus size={16} />
                          {w("添加公寓", "Add property")}
                        </button>
                      </div>
                      <div className="mw-property-list">
                        {data.properties
                          .filter(
                            (p) =>
                              (status === "all" || p.status === status) &&
                              p.draft.name
                                .toLowerCase()
                                .includes(query.toLowerCase()),
                          )
                          .map((p) => (
                            <article className="mw-card" key={p.id}>
                              <div className="mw-row">
                                <div>
                                  <Status value={p.status} />
                                  <h2>
                                    {p.draft.name ||
                                      w("未命名公寓", "Untitled property")}
                                  </h2>
                                  <p>
                                    {w(
                                      getCity(p.draft.cityId).name,
                                      getCity(p.draft.cityId).english,
                                    )}{" "}
                                    · {p.draft.rooms.length}{" "}
                                    {w("种房型", "room types")}
                                  </p>
                                </div>
                                <span>
                                  {p.published
                                    ? w(
                                        "公开版本在线",
                                        "Published version live",
                                      )
                                    : w("学生端不可见", "Not publicly visible")}
                                </span>
                              </div>
                              {p.reason && (
                                <p className="mw-note">{p.reason}</p>
                              )}
                              <div className="mw-actions">
                                <button onClick={() => setEditing(p)}>
                                  {w("编辑 / 预览", "Edit / Preview")}
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    void run({
                                      kind: "save",
                                      version: 0,
                                      draft: {
                                        ...p.draft,
                                        name: `${p.draft.name} (copy)`,
                                        rooms: p.draft.rooms.map((r) => ({
                                          ...r,
                                          id: crypto.randomUUID().slice(0, 8),
                                        })),
                                      },
                                    }).catch(() => {})
                                  }
                                >
                                  <Copy size={15} />
                                  {w("复制", "Duplicate")}
                                </button>
                                {p.status !== "pending" && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      perform({
                                        kind: "submit",
                                        id: p.id,
                                        version: p.version,
                                      })
                                    }
                                  >
                                    {w("提交审核", "Submit for review")}
                                  </button>
                                )}
                                {(p.published || p.status === "pending") && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      perform({
                                        kind: "withdraw",
                                        id: p.id,
                                        version: p.version,
                                      })
                                    }
                                  >
                                    {w("撤回 / 下架", "Withdraw / Unpublish")}
                                  </button>
                                )}
                                {p.published && (
                                  <a
                                    href={`/listing/${p.id}_${p.published.rooms[0].id}`}
                                  >
                                    {w("查看公开详情", "View public listing")}{" "}
                                    ↗
                                  </a>
                                )}
                              </div>
                            </article>
                          ))}
                        {!data.properties.length && (
                          <section className="mw-card mw-empty">
                            <Building2 size={36} />
                            <h2>
                              {w(
                                "从第一套公寓开始",
                                "Start with your first property",
                              )}
                            </h2>
                            <p>
                              {w(
                                "同一公寓可添加多种房型，无需重复填写地址。",
                                "Add multiple room types without repeating the address.",
                              )}
                            </p>
                            <button
                              className="mw-primary"
                              disabled={busy}
                              onClick={() => setEditing(null)}
                            >
                              <Plus size={17} />
                              {w("添加公寓", "Add property")}
                            </button>
                          </section>
                        )}
                      </div>
                    </>
                  )}
                  {(mode === "student" ||
                    (mode === "merchant" && tab === "conversations")) && (
                    <>
                      <StudentInquiry enabled={mode === "student"} run={run} />
                      <ConversationList
                        conversations={data.conversations ?? []}
                        mode={mode}
                        busy={busy}
                        run={perform}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
function ApplicationForm({
  merchant,
  busy,
  onSubmit,
}: {
  merchant: Merchant | null;
  busy: boolean;
  onSubmit: (v: unknown) => void;
}) {
  const w = useWords(),
    [profile, setProfile] = useState<Application>(
      merchant?.profile ?? {
        name: "",
        kind: "landlord",
        contact: "",
        cities: ["london"],
        evidence: "",
      },
    );
  const patch = (v: Partial<Application>) =>
    setProfile((p) => ({ ...p, ...v }));
  if (merchant?.status === "pending")
    return (
      <section className="mw-card mw-empty">
        <ShieldCheck size={36} />
        <h2>{w("入驻申请已提交", "Application received")}</h2>
        <p>
          {w(
            "平台审核后即可发布房源，可用右上角刷新查看结果。",
            "You can publish after approval. Refresh here to check the result.",
          )}
        </p>
        <p>{profile.name}</p>
        <Status value="pending" />
      </section>
    );
  return (
    <form
      className="mw-card"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ kind: "apply", profile, version: merchant?.version ?? 0 });
      }}
    >
      <h2>{w("申请商家入驻", "Become a partner")}</h2>
      {merchant?.reason && <p className="mw-note">{merchant.reason}</p>}
      <div className="mw-grid">
        <Field label={w("商家 / 房东名称", "Business / landlord name")}>
          <input
            required
            minLength={2}
            maxLength={100}
            value={profile.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label={w("主体类型", "Type")}>
          <select
            value={profile.kind}
            onChange={(e) =>
              patch({ kind: e.target.value as Application["kind"] })
            }
          >
            <option value="landlord">{w("个人房东", "Landlord")}</option>
            <option value="company">
              {w("公司 / 公寓运营方", "Company / Operator")}
            </option>
          </select>
        </Field>
        <Field
          label={w(
            "业务联系邮箱或电话（仅供审核）",
            "Business email or phone (review only)",
          )}
          wide
        >
          <input
            required
            minLength={5}
            maxLength={200}
            value={profile.contact}
            onChange={(e) => patch({ contact: e.target.value })}
          />
        </Field>
        <fieldset className="mw-wide">
          <legend>{w("经营城市", "Cities served")}</legend>
          <div className="mw-checks">
            {cities.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={profile.cities.includes(c.id)}
                  onChange={(e) =>
                    patch({
                      cities: e.target.checked
                        ? [...profile.cities, c.id]
                        : profile.cities.filter((id) => id !== c.id),
                    })
                  }
                />
                {w(c.name, c.english)}
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          label={w(
            "主体及房源管理权说明（仅供审核）",
            "Business identity and property authority (review only)",
          )}
          wide
        >
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            placeholder={w(
              "填写公司登记信息、官网及你有权发布房源的依据。无需提交身份证件。",
              "Provide business registration, website and your authority to list the property. Do not upload identity documents.",
            )}
            value={profile.evidence}
            onChange={(e) => patch({ evidence: e.target.value })}
          />
        </Field>
      </div>
      <button className="mw-primary" disabled={busy || !profile.cities.length}>
        {w("提交入驻申请", "Submit application")}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
async function compressPhoto(file: File) {
  if (
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw new Error(
      "请选择小于 15 MB 的 JPEG / PNG / WebP 图片 / Choose a JPEG, PNG or WebP under 15 MB",
    );
  const image = await createImageBitmap(file),
    canvas = document.createElement("canvas"),
    scale = Math.min(1, 1400 / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  for (const quality of [0.85, 0.7, 0.5, 0.3]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= 250 * 1024) return blob;
  }
  throw new Error(
    "压缩后仍超过 250 KB，请换用较小图片 / Image is still too large after compression",
  );
}
function PhotoEditor({
  ids,
  onChange,
}: {
  ids: string[];
  onChange: (v: string[]) => void;
}) {
  const w = useWords(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [libraryOpen, setLibraryOpen] = useState(false);
  async function upload(files: File[]) {
    setBusy(true);
    setError("");
    const next = [...ids];
    try {
      for (const file of files.slice(0, 12 - ids.length)) {
        const blob = await compressPhoto(file),
          r = await fetch("/api/merchant/media", {
            method: "POST",
            headers: { "Content-Type": blob.type },
            body: blob,
          }),
          data = (await r.json()) as { error?: string; id: string };
        if (!r.ok) throw new Error(data.error);
        next.push(data.id);
        onChange([...next]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mw-photo-editor">
      <div className="mw-photos">
        {ids.map((id, i) => (
          <div key={id}>
            <img
              src={`/api/merchant/media/${id}`}
              alt={`${w("房源照片", "Property photo")} ${i + 1}`}
            />
            <div>
              <span>{i === 0 ? w("封面", "Cover") : i + 1}</span>
              <button
                type="button"
                disabled={i === 0 || busy}
                aria-label={w("照片前移", "Move photo earlier")}
                onClick={() => {
                  const n = [...ids];
                  [n[i - 1], n[i]] = [n[i], n[i - 1]];
                  onChange(n);
                }}
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={w("移除照片", "Remove photo")}
                onClick={() => onChange(ids.filter((v) => v !== id))}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <label className="mw-upload">
        <Upload size={17} />
        {busy
          ? w("压缩并上传中…", "Compressing and uploading…")
          : w("选择图片（可多选）", "Choose photos (multiple allowed)")}
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || ids.length >= 12}
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      <p className="mw-note">
        {w(
          "第一张为封面；自动压缩至 250 KB 内，最多 12 张。请仅上传有权使用的真实照片。",
          "First photo is the cover. Auto-compressed under 250 KB, up to 12 photos. Upload real photos you have permission to use.",
        )}
      </p>
      {error && (
        <p role="alert" className="mw-error">
          {error}
        </p>
      )}
      <details onToggle={(e) => setLibraryOpen(e.currentTarget.open)}>
        <summary>
          {w("从已上传图片中选择", "Choose from uploaded photos")}
        </summary>
        {libraryOpen && (
          <MediaLibrary
            onSelect={(id) => {
              if (ids.length < 12 && !ids.includes(id)) onChange([...ids, id]);
            }}
          />
        )}
      </details>
    </div>
  );
}
function PropertyEditor({
  record,
  defaultCityId,
  accountId,
  busy,
  run,
  onClose,
}: {
  record: PropertyRecord | null;
  defaultCityId: CityId;
  accountId: string;
  busy: boolean;
  run: (v: unknown) => Promise<{ id?: string }>;
  onClose: () => void;
}) {
  const w = useWords(),
    [draft, setDraft] = useState<Property>(() =>
      record?.draft
        ? propertySchema.parse(record.draft)
        : newProperty(defaultCityId),
    ),
    [current, setCurrent] = useState({
      id: record?.id,
      version: record?.version ?? 0,
    }),
    [step, setStep] = useState(0),
    [dirty, setDirty] = useState(false),
    [recovery, setRecovery] = useState<Property | null>(null),
    [localSaved, setLocalSaved] = useState(false);
  const key = `atlas-merchant-draft:${accountId}:${record?.id ?? "new"}`,
    patch = (v: Partial<Property>) => {
      setDirty(true);
      setDraft((p) => ({ ...p, ...v }));
    };
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
      if (
        saved &&
        saved.version === (record?.version ?? 0) &&
        propertySchema.safeParse(saved.draft).success
      ) {
        // Browser-only persisted draft is read after deterministic SSR.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecovery(propertySchema.parse(saved.draft));
      }
    } catch {}
  }, [key, record?.version]);
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ draft, version: current.version }),
      );
      // The acknowledgement reflects a completed external storage write.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalSaved(true);
    } catch {
      setLocalSaved(false);
    }
  }, [draft, dirty, key, current.version]);
  const heading = useRef<HTMLHeadingElement>(null),
    previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [step]);
  const steps = [
    w("基本信息", "Basics"),
    w("位置与设施", "Location & amenities"),
    w("图片", "Photos"),
    w("价格与可租情况", "Price & availability"),
    w("预览与提交", "Preview & submit"),
  ];
  async function save(submit = false) {
    try {
      const r = await run({
          kind: "save",
          id: current.id,
          version: current.version,
          draft,
        }),
        id = r.id ?? current.id!;
      const version = current.id ? current.version + 1 : 0;
      setCurrent({ id, version });
      setDirty(false);
      setLocalSaved(false);
      setRecovery(null);
      try {
        localStorage.removeItem(key);
      } catch {}
      if (submit) {
        await run({ kind: "submit", id, version });
        onClose();
      }
    } catch {}
  }
  const city = getCity(draft.cityId),
    issues = publicationIssues(draft);
  return (
    <section className="mw-editor">
      <div className="mw-row">
        <button onClick={onClose}>
          <ArrowLeft size={16} />
          {w("房源列表", "Properties")}
        </button>
        <small role="status">
          {localSaved
            ? w("草稿已保存在此设备", "Draft saved on this device")
            : dirty
              ? w("有未保存更改", "Unsaved changes")
              : w("已同步服务器版本", "Server version loaded")}
        </small>
      </div>
      {recovery && (
        <div className="mw-note">
          {w(
            "发现此设备上的未完成草稿。",
            "An unfinished draft was found on this device.",
          )}
          <button
            onClick={() => {
              setDraft(recovery);
              setDirty(true);
              setRecovery(null);
            }}
          >
            {w("恢复草稿", "Restore draft")}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem(key);
              setRecovery(null);
            }}
          >
            {w("忽略", "Dismiss")}
          </button>
        </div>
      )}
      <ol className="mw-steps">
        {steps.map((name, i) => (
          <li key={name}>
            <button
              aria-current={step === i ? "step" : undefined}
              onClick={() => setStep(i)}
            >
              <span>{i + 1}</span>
              {name}
            </button>
          </li>
        ))}
      </ol>
      <fieldset disabled={busy} className="mw-card">
        <h2 ref={heading} tabIndex={-1}>
          {steps[step]}
        </h2>
        {step === 0 && (
          <div className="mw-grid">
            <Field label={w("公寓名称", "Property name")} wide>
              <input
                maxLength={120}
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <Field label={w("主要介绍", "Description")} wide>
              <textarea
                maxLength={4000}
                rows={5}
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>
            <Field
              label={w("英文介绍（可选）", "English description (optional)")}
              wide
            >
              <textarea
                maxLength={4000}
                rows={4}
                value={draft.descriptionEn}
                onChange={(e) => patch({ descriptionEn: e.target.value })}
              />
            </Field>
            <Field label={w("担保人要求", "Guarantor requirements")} wide>
              <textarea
                maxLength={1000}
                rows={2}
                value={draft.guarantor}
                onChange={(e) => patch({ guarantor: e.target.value })}
              />
            </Field>
            <Field label={w("付款条款", "Payment terms")} wide>
              <textarea
                maxLength={1000}
                rows={2}
                value={draft.paymentTerms}
                onChange={(e) => patch({ paymentTerms: e.target.value })}
              />
            </Field>
            <Field label={w("取消条款", "Cancellation terms")} wide>
              <textarea
                maxLength={2000}
                rows={3}
                value={draft.cancellation}
                onChange={(e) => patch({ cancellation: e.target.value })}
              />
            </Field>
            <label className="mw-check">
              <input
                type="checkbox"
                checked={draft.studentOnly}
                onChange={(e) => patch({ studentOnly: e.target.checked })}
              />
              {w("仅限学生", "Students only")}
            </label>
          </div>
        )}
        {step === 1 && (
          <div className="mw-grid">
            <PropertyLocation draft={draft} patch={patch} disabled={busy} />
            <fieldset className="mw-wide">
              <legend>{w("设施", "Amenities")}</legend>
              <div className="mw-checks">
                {[
                  ["furnished", "家具", "Furnished"],
                  ["laundry", "洗衣", "Laundry"],
                  ["lift", "电梯", "Lift"],
                  ["accessible", "无障碍", "Accessible"],
                  ["private-kitchen", "独立厨房", "Private kitchen"],
                  ["secure-entry", "门禁", "Controlled entry"],
                ].map(([id, zh, en]) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={draft.facilities.includes(
                        id as Property["facilities"][number],
                      )}
                      onChange={(e) =>
                        patch({
                          facilities: e.target.checked
                            ? [
                                ...draft.facilities,
                                id as Property["facilities"][number],
                              ]
                            : draft.facilities.filter((v) => v !== id),
                        })
                      }
                    />
                    {w(zh, en)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
        {step === 2 && (
          <>
            <PhotoEditor
              ids={draft.photos}
              onChange={(photos) => patch({ photos })}
            />
            <h3>{w("户型图（可选）", "Floor plans (optional)")}</h3>
            <PhotoEditor
              ids={draft.floorPlans ?? []}
              onChange={(floorPlans) => patch({ floorPlans })}
            />
          </>
        )}
        {step === 3 && (
          <>
            <p>
              {w(
                "租金使用所在城市币种。周 / 月换算用于学生端统一比较，详情保留原始报价。",
                "Prices use the city currency. Weekly / monthly conversion supports comparison; details retain your original quote.",
              )}{" "}
              {city.currency}
            </p>
            {draft.rooms.map((room, index) => {
              const update = (v: Partial<Property["rooms"][number]>) =>
                patch({
                  rooms: draft.rooms.map((r, i) =>
                    i === index ? { ...r, ...v } : r,
                  ),
                });
              return (
                <fieldset key={room.id} className="mw-room">
                  <legend>
                    {w("房型", "Room type")} {index + 1}
                  </legend>
                  <div className="mw-grid">
                    <Field label={w("房型名称", "Room name")}>
                      <input
                        maxLength={80}
                        value={room.name}
                        onChange={(e) => update({ name: e.target.value })}
                      />
                    </Field>
                    <Field label={w("房型", "Type")}>
                      <select
                        value={room.roomType}
                        onChange={(e) =>
                          update({
                            roomType: e.target.value as typeof room.roomType,
                          })
                        }
                      >
                        <option value="独立 Studio">Studio</option>
                        <option value="独卫单间">
                          {w("独卫单间", "En-suite")}
                        </option>
                        <option value="合租单间">
                          {w("合租单间", "Shared bathroom")}
                        </option>
                      </select>
                    </Field>
                    {(
                      [
                        ["size", w("面积 m²", "Size m²")],
                        ["price", `${w("租金", "Rent")} ${city.currency}`],
                        [
                          "deposit",
                          w("押金（可退金额）", "Refundable deposit"),
                        ],
                        [
                          "fees",
                          w("必须支付的一次性费用", "Mandatory one-off fees"),
                        ],
                        ["quantity", w("可租数量", "Available units")],
                        [
                          "minMonths",
                          w("最短租期（月）", "Minimum lease (months)"),
                        ],
                        [
                          "maxMonths",
                          w("最长租期（月）", "Maximum lease (months)"),
                        ],
                      ] as const
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          type="number"
                          min={
                            key === "deposit" ||
                            key === "fees" ||
                            key === "quantity"
                              ? 0
                              : 1
                          }
                          step={
                            key === "price" ||
                            key === "deposit" ||
                            key === "fees" ||
                            key === "size"
                              ? "0.01"
                              : "1"
                          }
                          value={room[key]}
                          onChange={(e) =>
                            update({ [key]: Number(e.target.value) })
                          }
                        />
                      </Field>
                    ))}
                    <Field label={w("租金周期", "Rent period")}>
                      <select
                        value={room.period}
                        onChange={(e) =>
                          update({ period: e.target.value as "week" | "month" })
                        }
                      >
                        <option value="week">{w("每周", "Per week")}</option>
                        <option value="month">{w("每月", "Per month")}</option>
                      </select>
                    </Field>
                    <Field label={w("可入住日期", "Available from")}>
                      <input
                        type="date"
                        value={room.availableFrom}
                        onInput={(e) =>
                          update({ availableFrom: e.currentTarget.value })
                        }
                        onChange={(e) =>
                          update({ availableFrom: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={w("可租至", "Available until")}>
                      <input
                        type="date"
                        value={room.availableUntil}
                        onInput={(e) =>
                          update({ availableUntil: e.currentTarget.value })
                        }
                        onChange={(e) =>
                          update({ availableUntil: e.target.value })
                        }
                      />
                    </Field>
                    <label className="mw-check">
                      <input
                        type="checkbox"
                        checked={room.bills}
                        onChange={(e) => update({ bills: e.target.checked })}
                      />
                      {w(
                        "租金包含全部水电网",
                        "All utilities and internet included",
                      )}
                    </label>
                    <Field
                      label={w(
                        "账单范围、上限及额外费用",
                        "Bill coverage, caps and extra costs",
                      )}
                      wide
                    >
                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={room.billDetails}
                        onChange={(e) =>
                          update({ billDetails: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <details>
                    <summary>
                      {w(
                        "房型专属照片（不填则使用公寓照片）",
                        "Room photos (defaults to property photos)",
                      )}
                    </summary>
                    <PhotoEditor
                      ids={room.photos}
                      onChange={(photos) => update({ photos })}
                    />
                  </details>
                  {draft.rooms.length > 1 && (
                    <button
                      className="mw-danger"
                      onClick={() =>
                        patch({
                          rooms: draft.rooms.filter((r) => r.id !== room.id),
                        })
                      }
                    >
                      {w("删除此房型", "Remove room type")}
                    </button>
                  )}
                </fieldset>
              );
            })}
            <button
              disabled={draft.rooms.length >= 8}
              onClick={() =>
                patch({
                  rooms: [
                    ...draft.rooms,
                    {
                      ...newProperty(draft.cityId).rooms[0],
                      period: city.period === "周" ? "week" : "month",
                    },
                  ],
                })
              }
            >
              <Plus size={16} />
              {w("添加房型", "Add room type")}
            </button>
          </>
        )}
        {step === 4 && (
          <>
            <PropertyPreview property={draft} />
            {issues.length ? (
              <div className="mw-error">
                <strong>{w("提交前还需要完成", "Before submitting")}</strong>
                <ul>
                  {issues.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mw-notice">
                <Check size={16} />
                {w("资料完整，可以提交审核。", "Ready for review.")}
              </p>
            )}
            <p className="mw-note">
              {w(
                "审核通过后才会出现在地图、搜索和 AI 工具里。更新公开房源时，现有公开版本保留至复审通过。",
                "Only approved listings appear in search, maps and AI tools. Existing listings stay live while edits are reviewed.",
              )}
            </p>
          </>
        )}
      </fieldset>
      <div className="mw-editor-footer">
        <button disabled={busy} onClick={() => void save()}>
          {w("保存草稿到服务器", "Save draft to server")}
        </button>
        <div>
          <button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft size={16} />
            {w("上一步", "Back")}
          </button>
          {step < 4 ? (
            <button
              className="mw-primary"
              onClick={() => setStep((s) => s + 1)}
            >
              {w("下一步", "Next")}
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="mw-primary"
              disabled={busy || issues.length > 0}
              onClick={() => void save(true)}
            >
              {w("提交审核", "Submit for review")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
function PropertyPreview({ property: p }: { property: Property }) {
  const w = useWords(),
    city = getCity(p.cityId);
  return (
    <div className="mw-preview">
      <div className="mw-preview-photos">
        {p.photos.map((id) => (
          <img
            key={id}
            src={`/api/merchant/media/${id}`}
            alt={w("公寓照片", "Property photo")}
          />
        ))}
      </div>
      {p.floorPlans?.length > 0 && (
        <>
          <h4>{w("户型图", "Floor plans")}</h4>
          <div className="mw-preview-photos">
            {p.floorPlans.map((id) => (
              <img
                key={id}
                src={`/api/merchant/media/${id}`}
                alt={w("户型图", "Floor plan")}
              />
            ))}
          </div>
        </>
      )}
      <h3>{p.name || w("未命名公寓", "Untitled property")}</h3>
      <p>
        {w(city.name, city.english)} · {p.address}
        {p.postcode ? ` · ${p.postcode}` : ""}
      </p>
      <p>{p.description}</p>
      {p.descriptionEn && <p lang="en">{p.descriptionEn}</p>}
      <dl>
        <dt>{w("设施 / 资格", "Amenities / Eligibility")}</dt>
        <dd>
          {p.facilities
            .map(
              (id) =>
                ({
                  furnished: w("家具", "Furnished"),
                  laundry: w("洗衣", "Laundry"),
                  lift: w("电梯", "Lift"),
                  accessible: w("无障碍", "Accessible"),
                  "private-kitchen": w("独立厨房", "Private kitchen"),
                  "secure-entry": w("门禁", "Secure entry"),
                })[id],
            )
            .join(" · ")}{" "}
          ·{" "}
          {p.studentOnly
            ? w("仅限学生", "Students only")
            : w("不限学生", "Open to non-students")}
        </dd>
        <dt>{w("担保要求", "Guarantor")}</dt>
        <dd>{p.guarantor}</dd>
        <dt>{w("付款方式", "Payment")}</dt>
        <dd>{p.paymentTerms}</dd>
        <dt>{w("取消条款", "Cancellation")}</dt>
        <dd>{p.cancellation}</dd>
      </dl>
      {p.rooms.map((r) => (
        <section className="mw-room" key={r.id}>
          <h4>
            {r.name} · {r.size} m²
          </h4>
          <strong>
            {city.currency}
            {r.price} /{" "}
            {r.period === "week" ? w("周", "week") : w("月", "month")}
          </strong>
          <p>
            {r.quantity} {w("套可租", "available")} · {r.availableFrom} –{" "}
            {r.availableUntil} · {r.minMonths}–{r.maxMonths}{" "}
            {w("个月", "months")}
          </p>
          <p>
            {w("押金", "Deposit")}: {city.currency}
            {r.deposit} · {w("一次性费用", "One-off fees")}: {city.currency}
            {r.fees}
          </p>
          <p>{r.billDetails}</p>
          <div className="mw-preview-photos">
            {r.photos.map((id) => (
              <img key={id} src={`/api/merchant/media/${id}`} alt={r.name} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
function AdminQueue({
  data,
  busy,
  run,
}: {
  data: Dashboard;
  busy: boolean;
  run: (v: unknown) => void;
}) {
  const w = useWords(),
    [section, setSection] = useState("merchants");
  return (
    <>
      <div className="mw-tabs">
        {[
          ["merchants", w("商家入驻", "Applications")],
          ["properties", w("房源审核", "Listings")],
          ["reports", w("举报处理", "Reports")],
          ["audit", w("操作记录", "Audit log")],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {section === "merchants" &&
        (data.merchants?.length ? (
          data.merchants.map((m) => (
            <section className="mw-card" key={m.id}>
              <Status value={m.status} />
              <h2>{m.profile.name}</h2>
              <p>
                {m.profile.kind} · {m.profile.cities.join(", ")}
              </p>
              <p>{m.profile.contact}</p>
              <p className="mw-prose">{m.profile.evidence}</p>
              {m.status === "pending" && (
                <ReviewActions
                  busy={busy}
                  onReview={(approve, reason) =>
                    run({
                      kind: "reviewMerchant",
                      id: m.id,
                      version: m.version,
                      approve,
                      reason,
                    })
                  }
                />
              )}
            </section>
          ))
        ) : (
          <p>{w("暂无入驻申请", "No applications yet")}</p>
        ))}
      {section === "properties" &&
        (data.properties.length ? (
          data.properties.map((p) => (
            <details className="mw-card" key={p.id}>
              <summary>
                <Status value={p.status} /> {p.draft.name} ·{" "}
                {w(
                  getCity(p.draft.cityId).name,
                  getCity(p.draft.cityId).english,
                )}
              </summary>
              <PropertyPreview property={p.draft} />
              {p.published && (
                <details>
                  <summary>
                    {w("当前公开版本", "Currently published version")}
                  </summary>
                  <PropertyPreview property={p.published} />
                </details>
              )}
              {p.status === "pending" && (
                <ReviewActions
                  busy={busy}
                  onReview={(approve, reason) =>
                    run({
                      kind: "reviewProperty",
                      id: p.id,
                      version: p.version,
                      approve,
                      reason,
                    })
                  }
                />
              )}{" "}
              {p.published && (
                <ReviewActions
                  busy={busy}
                  takedown
                  onReview={(_, reason) =>
                    run({
                      kind: "takedown",
                      id: p.id,
                      version: p.version,
                      reason,
                    })
                  }
                />
              )}
            </details>
          ))
        ) : (
          <p>{w("暂无待审核房源", "No listings yet")}</p>
        ))}
      {section === "reports" &&
        (data.reports?.length ? (
          data.reports.map((r) => (
            <section className="mw-card" key={r.id}>
              <a href={`/listing/${r.listing}`}>{r.listing}</a>
              <p>{r.reason}</p>
              <button
                disabled={busy || !!r.resolved}
                onClick={() => run({ kind: "resolveReport", id: r.id })}
              >
                {r.resolved
                  ? w("已处理", "Resolved")
                  : w("标记处理完成", "Mark resolved")}
              </button>
            </section>
          ))
        ) : (
          <p>{w("暂无举报", "No reports")}</p>
        ))}
      {section === "audit" && (
        <div className="mw-card">
          {data.audit?.length ? (
            data.audit.map((a, i) => (
              <div className="mw-audit" key={i}>
                <time>{new Date(a.created).toLocaleString()}</time>
                <strong>{a.action}</strong>
                <span>{a.target}</span>
                <p>{a.reason}</p>
              </div>
            ))
          ) : (
            <p>{w("暂无操作", "No actions yet")}</p>
          )}
        </div>
      )}
    </>
  );
}
function ReviewActions({
  onReview,
  busy,
  takedown = false,
}: {
  onReview: (approve: boolean, reason: string) => void;
  busy: boolean;
  takedown?: boolean;
}) {
  const w = useWords(),
    [reason, setReason] = useState("");
  return (
    <div className="mw-review">
      <Field
        label={w(
          "审核说明（至少 5 字）",
          "Review note (at least 5 characters)",
        )}
      >
        <textarea
          maxLength={1500}
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <div className="mw-actions">
        {!takedown && (
          <button
            className="mw-primary"
            disabled={busy || reason.trim().length < 5}
            onClick={() => onReview(true, reason)}
          >
            {w("审核通过", "Approve")}
          </button>
        )}
        <button
          disabled={busy || reason.trim().length < 5}
          onClick={() => onReview(false, reason)}
        >
          {takedown
            ? w("立即下架公开版本", "Unpublish listing")
            : w("退回修改", "Request changes")}
        </button>
      </div>
    </div>
  );
}
function StudentInquiry({
  enabled,
  run,
}: {
  enabled: boolean;
  run: (v: unknown) => Promise<unknown>;
}) {
  const w = useWords(),
    homes = useListings(),
    [listing, setListing] = useState<Listing>(),
    [message, setMessage] = useState(""),
    [type, setType] = useState("enquiry"),
    [date, setDate] = useState(""),
    [mode, setMode] = useState("online"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (enabled)
      // Resolve the browser query after deterministic SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setListing(
        homes.find(
          (l) =>
            l.id === new URLSearchParams(location.search).get("listing") &&
            l.merchant,
        ),
      );
  }, [enabled, homes]);
  if (!listing) return null;
  return (
    <form
      className="mw-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await run(
            type === "report"
              ? { kind: "report", listing: listing.id, reason: message }
              : {
                  kind: "inquire",
                  listing: listing.id,
                  message,
                  type,
                  appointment: date ? new Date(date).toISOString() : "",
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  mode,
                },
          );
          setListing(undefined);
        } catch {
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{listing.name}</h2>
      <p>
        {w(
          "发送后，商家仅收到这里填写的内容。预约须等待商家确认。",
          "The host only receives what you send here. Viewings require host confirmation.",
        )}
      </p>
      <div className="mw-grid">
        <Field label={w("联系目的", "Reason for contact")}>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="enquiry">{w("咨询房源", "Ask a question")}</option>
            <option value="viewing">
              {w("预约看房", "Request a viewing")}
            </option>
            <option value="report">
              {w("向平台举报", "Report to platform")}
            </option>
          </select>
        </Field>
        {type === "viewing" && (
          <>
            <Field label={w("看房方式", "Viewing type")}>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="online">{w("视频看房", "Video viewing")}</option>
                <option value="in-person">
                  {w("实地看房", "In-person viewing")}
                </option>
              </select>
            </Field>
            <Field
              label={`${w("你的当地时间", "Your local time")} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
            >
              <input
                type="datetime-local"
                required
                value={date}
                onInput={(e) => setDate(e.currentTarget.value)}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </>
        )}
        <Field
          label={
            type === "report"
              ? w("举报原因（仅平台可见）", "Report details (platform only)")
              : w("想确认的事项", "Your message")
          }
          wide
        >
          <textarea
            rows={4}
            required
            minLength={5}
            maxLength={type === "report" ? 1500 : 2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
      </div>
      <button disabled={busy} className="mw-primary">
        {w("发送", "Send")}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
function ConversationList({
  conversations,
  mode,
  busy,
  run,
}: {
  conversations: Conversation[];
  mode: string;
  busy: boolean;
  run: (v: unknown) => void;
}) {
  const w = useWords();
  return (
    <div>
      {!conversations.length ? (
        <section className="mw-card mw-empty">
          <MessageSquare size={32} />
          <h2>{w("暂无咨询", "No enquiries yet")}</h2>
          <p>
            {mode === "student"
              ? w(
                  "在商家房源详情页发送咨询或预约看房。",
                  "Send an enquiry from a partner listing's details page.",
                )
              : w(
                  "学生发送的咨询和看房请求会出现在这里。",
                  "Student enquiries and viewing requests will appear here.",
                )}
          </p>
        </section>
      ) : (
        conversations.map((c) => (
          <ConversationCard
            key={`${c.id}:${c.version}`}
            conversation={c}
            mode={mode}
            busy={busy}
            run={run}
          />
        ))
      )}
    </div>
  );
}
function ConversationCard({
  conversation: c,
  mode,
  busy,
  run,
}: {
  conversation: Conversation;
  mode: string;
  busy: boolean;
  run: (v: unknown) => void;
}) {
  const w = useWords(),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState(c.status);
  return (
    <details className="mw-card">
      <summary>
        <Status value={c.status} /> {c.name} ·{" "}
        {c.kind === "viewing" ? w("预约看房", "Viewing") : w("咨询", "Enquiry")}
      </summary>
      {c.appointment && (
        <p>
          {new Date(c.appointment).toLocaleString()} ·{" "}
          {Intl.DateTimeFormat().resolvedOptions().timeZone} (
          {w("申请时区", "Requested in")} {c.timezone}) ·{" "}
          {c.mode === "online"
            ? w("视频看房", "Video viewing")
            : w("实地看房", "In-person viewing")}
        </p>
      )}
      <div className="mw-conversation">
        {c.messages.map((m, i) => (
          <div className={`mw-message mw-message-${m.by}`} key={i}>
            <small>
              {m.by === "student" ? w("学生", "Student") : w("商家", "Host")} ·{" "}
              {new Date(m.at).toLocaleString()}
            </small>
            <p>{m.text}</p>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run({ kind: "reply", id: c.id, version: c.version, message, status });
        }}
      >
        <Field
          label={w(
            "回复（改期可在消息中协商，确认后另发预约）",
            "Reply (discuss changes here, then submit a new viewing request)",
          )}
        >
          <textarea
            required
            maxLength={2000}
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <div className="mw-actions">
          <select
            aria-label={w("处理状态", "Conversation status")}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            {(mode === "student"
              ? [...new Set([c.status, "open", "closed"])]
              : ["open", "accepted", "declined", "closed"]
            ).map((s) => (
              <option value={s} key={s}>
                {w(...statusNames[s])}
              </option>
            ))}
          </select>
          <button className="mw-primary" disabled={busy || !message.trim()}>
            {w("发送回复", "Send reply")}
          </button>
        </div>
      </form>
    </details>
  );
}
