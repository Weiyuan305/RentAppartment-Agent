import type * as Cesium from "cesium";
import { metersBetween, type WalkingRoute } from "./walking-route";

type Engine = typeof Cesium;

export function fitWalkingRoute(C: Engine, viewer: Cesium.Viewer, route: WalkingRoute, container: HTMLDivElement | null, heading = 0) {
  const sphere = C.BoundingSphere.fromPoints(C.Cartesian3.fromDegreesArray(route.coordinates.flat()));
  const bounds = container?.getBoundingClientRect();
  if (bounds && (bounds.width < 2 || bounds.height < 2)) return;
  const panel = container?.parentElement?.querySelector(".map-route, .map-amenity-selected")?.getBoundingClientRect();
  const toolbar = container?.parentElement?.querySelector(".amenity-filters")?.getBoundingClientRect();
  const topCovered = bounds && toolbar ? Math.min(.4, Math.max(0, (toolbar.bottom - bounds.top + 15) / bounds.height)) : 0;
  const covered = bounds && panel ? Math.min(0.65, Math.max(0.2, (bounds.bottom - panel.top) / bounds.height)) : 0.35;
  const frustum = viewer.camera.frustum;
  const tangent = frustum instanceof C.PerspectiveFrustum ? Math.tan((frustum.fovy ?? Math.PI / 3) / 2) : 0.58;
  const aspect = bounds ? bounds.width / bounds.height : 1;
  const range = Math.max(1100, sphere.radius * 1.35 / (tangent * Math.max(.15, Math.min(1 - covered - topCovered, aspect * 0.85))));
  viewer.camera.flyToBoundingSphere(sphere, {
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1.2,
    offset: new C.HeadingPitchRange(heading, -1.25, range),
    complete: () => {
      if (viewer.isDestroyed()) return;
      // Keep the whole route in the area above the information card, including after rotation.
      viewer.camera.moveDown(range * tangent * (covered - topCovered));
      viewer.scene.requestRender();
    },
  });
}

function endpointImage(text: string, color: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="white" stroke="${color}" stroke-width="1.5"/><circle cx="16" cy="16" r="10.5" fill="${color}"/><text x="16" y="20.5" text-anchor="middle" fill="white" font-family="sans-serif" font-size="12" font-weight="600">${text}</text></svg>`)}`;
}

/** Render an independent road line, rather than painting a stripe across roofs and walls. */
export function drawWalkingRoute(C: Engine, viewer: Cesium.Viewer, tiles: Cesium.Cesium3DTileset, route: WalkingRoute) {
  // Subdivision adds points on existing road segments only. Never round off a real turn.
  const coordinates = [route.coordinates[0]];
  const distances = [0];
  for (let i = 1; i < route.coordinates.length; i++) {
    const a = route.coordinates[i - 1], b = route.coordinates[i];
    const length = metersBetween(a, b);
    const count = Math.max(1, Math.ceil(length / 12));
    for (let j = 1; j <= count; j++) {
      coordinates.push([a[0] + (b[0] - a[0]) * j / count, a[1] + (b[1] - a[1]) * j / count]);
      distances.push(distances[distances.length - 1] + length / count);
    }
  }
  const total = distances[distances.length - 1];
  const anchors = [0];
  const spacing = Math.max(24, total / 120);
  for (let i = 1; i < coordinates.length - 1; i++) {
    if (distances[i] - distances[anchors[anchors.length - 1]] >= spacing) anchors.push(i);
  }
  anchors.push(coordinates.length - 1);

  const line = viewer.entities.add({ id: "walking-route:path", polyline: {
    positions: coordinates.map(p => C.Cartesian3.fromDegrees(p[0], p[1], 2)),
    width: 5.5,
    arcType: C.ArcType.NONE,
    material: new C.PolylineOutlineMaterialProperty({ color: C.Color.fromCssColorString("#4268ed"), outlineColor: C.Color.WHITE, outlineWidth: 1 }),
    // A subdued continuation explains occlusion without colouring the building itself.
    depthFailMaterial: new C.PolylineOutlineMaterialProperty({ color: C.Color.fromCssColorString("#7392ff").withAlpha(0.7), outlineColor: C.Color.WHITE.withAlpha(0.4), outlineWidth: 1 }),
  } });
  const markers = [0, coordinates.length - 1].map((index, i) => viewer.entities.add({
    id: `walking-route:${i === 0 ? "start" : "end"}`,
    position: C.Cartesian3.fromDegrees(coordinates[index][0], coordinates[index][1], 2),
    billboard: { image: endpointImage(i === 0 ? "起" : "终", i === 0 ? "#4268ed" : "#168a70"), width: 30, height: 30, disableDepthTestDistance: Number.POSITIVE_INFINITY },
  }));

  let dirty = true, disposed = false, previous: number[] = [], lastSample = 0;
  const exclusions = [line, ...markers];
  const removeLoadListener = tiles.loadProgress.addEventListener(() => { dirty = true; });
  const removeRenderListener = viewer.scene.postRender.addEventListener(() => {
    if (disposed || !dirty || !viewer.scene.sampleHeightSupported || performance.now() - lastSample < 800) return;
    dirty = false;
    lastSample = performance.now();
    // Read only mesh already loaded by the camera. No extra most-detailed tile requests.
    const sampled = anchors.map(index => {
      const p = coordinates[index];
      const before = coordinates[Math.max(0, index - 1)], after = coordinates[Math.min(coordinates.length - 1, index + 1)];
      const longitudeScale = Math.cos(p[1] * Math.PI / 180);
      const dx = (after[0] - before[0]) * longitudeScale, dy = after[1] - before[1];
      const norm = Math.hypot(dx, dy) || 1;
      // Adjacent samples help avoid treating a projecting roof edge as the road height.
      // These offsets affect display elevation only; every rendered longitude/latitude stays on the route.
      const heights = [0, -3, 3].map(offset => viewer.scene.sampleHeight(C.Cartographic.fromDegrees(
        p[0] - dy / norm * offset / (111320 * longitudeScale), p[1] + dx / norm * offset / 111320,
      ), exclusions)).filter((h): h is number => h !== undefined && Number.isFinite(h));
      return heights.length ? Math.min(...heights) : undefined;
    });
    if (!sampled.some(h => h !== undefined)) return;
    const heights = sampled.map((height, i) => {
      // Suppress isolated roof spikes. This is display elevation, not surveyed road altitude.
      let ground = height ?? Number.POSITIVE_INFINITY;
      for (let j = 0; j < sampled.length; j++) {
        const neighbor = sampled[j];
        const separation = Math.abs(distances[anchors[i]] - distances[anchors[j]]);
        if (neighbor !== undefined && separation < 90) ground = Math.min(ground, neighbor + separation * 0.35);
      }
      if (Number.isFinite(ground)) return ground;
      let nearest = 0;
      for (let j = 0; j < sampled.length; j++) {
        if (sampled[j] !== undefined && (sampled[nearest] === undefined || Math.abs(anchors[j] - anchors[i]) < Math.abs(anchors[nearest] - anchors[i]))) nearest = j;
      }
      return sampled[nearest] ?? 0;
    });
    if (previous.length && heights.every((h, i) => Math.abs(h - previous[i]) < 0.75)) return;
    previous = heights;
    let segment = 0;
    const positions = coordinates.map((p, i) => {
      while (segment < anchors.length - 2 && i > anchors[segment + 1]) segment++;
      const a = anchors[segment], b = anchors[segment + 1];
      const fraction = (distances[i] - distances[a]) / (distances[b] - distances[a] || 1);
      return C.Cartesian3.fromDegrees(p[0], p[1], heights[segment] * (1 - fraction) + heights[segment + 1] * fraction + 2);
    });
    line.polyline!.positions = new C.ConstantProperty(positions);
    markers[0].position = new C.ConstantPositionProperty(positions[0]);
    markers[1].position = new C.ConstantPositionProperty(positions[positions.length - 1]);
    viewer.scene.requestRender();
  });
  return () => { disposed = true; removeLoadListener(); removeRenderListener(); };
}
