/** Rephrase appears only after a long wait, never instead of the first pending frame. */
export const REPHRASE_AFTER_SECONDS = 15;

export function advisorPendingCopy(elapsedSeconds: number, homeCount: number, locale: "zh" | "en") {
  const seconds = Math.max(0, Math.floor(elapsedSeconds));
  const stage = seconds < 4
    ? (locale === "zh" ? `正在看曼城 ${homeCount} 套房…` : `Looking through ${homeCount} Manchester homes…`)
    : seconds < 10
      ? (locale === "zh" ? "正在按通勤和预算筛选…" : "Filtering by commute and budget…")
      : (locale === "zh" ? "正在把结果标到地图上…" : "Marking the results on the map…");
  const elapsed = locale === "zh" ? `已等 ${seconds} 秒` : `Waited ${seconds}s`;
  return { stage, elapsed, rephrase: seconds >= REPHRASE_AFTER_SECONDS };
}
