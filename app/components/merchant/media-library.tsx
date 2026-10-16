"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated media. */
import { useEffect, useState } from "react";
import { useLocale } from "../locale-provider";
export function MediaLibrary({
  onSelect,
}: {
  onSelect?: (id: string) => void;
}) {
  const { locale } = useLocale(),
    w = (a: string, b: string) => (locale === "zh" ? a : b),
    [items, setItems] = useState<{ id: string; size: number; used: number }[]>(
      [],
    ),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/merchant/media", { signal: c.signal })
      .then(async (r) => {
        const d = (await r.json()) as { items: typeof items; error?: string };
        if (!r.ok) throw new Error(d.error);
        setItems(d.items);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [tick]);
  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/merchant/media/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(((await r.json()) as { error: string }).error);
      setTick((t) => t + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <p className="mw-note">
        {items.length}/60 ·{" "}
        {w(
          "已在服务器草稿或公开房源中使用的图片不可删除。删除前先保存房源的图片变更。",
          "Photos used in server drafts or live listings cannot be deleted. Save property changes before deleting unused photos.",
        )}
      </p>
      {error && (
        <p className="mw-error" role="alert">
          {error}
        </p>
      )}
      <div className="mw-media-grid">
        {items.map((p, i) => (
          <div key={p.id}>
            <img
              loading="lazy"
              src={`/api/merchant/media/${p.id}`}
              alt={`${w("图库图片", "Library photo")} ${i + 1}`}
            />
            <small>
              {Math.ceil(p.size / 1024)} KB ·{" "}
              {p.used ? w("使用中", "In use") : w("未使用", "Unused")}
            </small>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(p.id)}>
                {w("使用此图片", "Use photo")}
              </button>
            ) : (
              <button
                disabled={!!p.used || busy}
                onClick={() => void remove(p.id)}
              >
                {w("删除未使用图片", "Delete unused photo")}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
