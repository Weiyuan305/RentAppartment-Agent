/** Shared motion for /v2. Regular UI stays under 320ms; camera and route are the exceptions. */
export const V2_EASE = "cubic-bezier(.16,1,.3,1)";
export const V2_FLIGHT_MS = 750;
export const V2_ROUTE_MS = 700;
export const V2_DETAIL_OPEN_MS = 320;
export const V2_DETAIL_CLOSE_MS = 200;
export const V2_SIGNPOST_MS = 180;
export const V2_ROUTINE_MS = 240;

export function motionMs(ms: number, reduced: boolean) {
  return reduced ? 0 : ms;
}

/** Unit-bezier for cubic-bezier(.16, 1, .3, 1). t is time in 0..1. */
export function v2Ease(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  const x1 = 0.16, y1 = 1, x2 = 0.3, y2 = 1;
  let u = clamped;
  for (let i = 0; i < 8; i++) {
    const x = sample(u, x1, x2) - clamped;
    const dx = sampleDerivative(u, x1, x2);
    if (Math.abs(dx) < 1e-6) break;
    u = Math.min(1, Math.max(0, u - x / dx));
  }
  return sample(u, y1, y2);
}

function sample(t: number, p1: number, p2: number) {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return ((a * t + b) * t + c) * t;
}

function sampleDerivative(t: number, p1: number, p2: number) {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return (3 * a * t + 2 * b) * t + c;
}
