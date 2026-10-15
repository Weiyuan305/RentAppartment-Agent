import {mapMotion} from "./map-motion";
import {readMapViewport} from "./map-viewport";
import type * as Cesium from "cesium";
import { amenityCategories, amenityInfo, type Amenity, type AmenityCategory } from "./amenities";

import { amenityIconNodes } from "./amenity-icons";

type Engine = typeof Cesium;
const paths = Object.fromEntries(amenityCategories.map(category => [category,
  amenityIconNodes[category].map(([tag, attributes]) => `<${tag} ${Object.entries(attributes).filter(([key]) => key !== "key").map(([key, value]) => `${key}="${value}"`).join(" ")}/>`).join(""),
])) as Record<AmenityCategory, string>;
const imageCache = new Map<string, string>();
function cacheImage(key: string, value: string) {
  // Mixed clusters change as the camera moves; keep their image cache bounded.
  if (imageCache.size >= 256) imageCache.delete(imageCache.keys().next().value!);
  imageCache.set(key, value);
}
function iconMarkup(category: AmenityCategory) {
  return `<g fill="none" stroke="${amenityInfo[category].color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[category]}</g>`;
}
function markerImage(category: AmenityCategory) {
  if (!imageCache.has(category)) cacheImage(category, `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="9" fill="#fffdf7" stroke="#cfdbd1"/><g transform="translate(6.4 6.4) scale(.8)">${iconMarkup(category)}</g></svg>`)}`);
  return imageCache.get(category)!;
}
export function createAmenityLayer(C: Engine) {
  const layer = new C.CustomDataSource("campus-amenities");
  layer.clustering.enabled = true;
  layer.clustering.pixelRange = 25;
  layer.clustering.minimumClusterSize = 2;
  layer.clustering.clusterLabels = false;
  layer.clustering.clusterPoints = false;
  layer.clustering.clusterEvent.addEventListener((entities: Cesium.Entity[], cluster: { billboard: Cesium.Billboard; label: Cesium.Label; point: Cesium.PointPrimitive }) => {
    const categories = new Set(entities.map(e => e.properties?.category?.getValue()));
    const shown = amenityCategories.filter(category => categories.has(category)).slice(0, 3);
    const color = shown.length === 1 ? amenityInfo[shown[0]].color : "#52617b";
    const width = String(entities.length).length * 7 + 38;
    const key = `cluster:${shown.join(":")}:${entities.length}`;
    if (!imageCache.has(key)) {
      const icon = shown.length === 1 ? iconMarkup(shown[0]) : `<g fill="none" stroke="#36594d" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></g>`;
      cacheImage(key, `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width * 3}" height="90" viewBox="0 0 ${width} 30"><rect x=".5" y=".5" width="${width-1}" height="29" rx="8" fill="#fffdf7" stroke="#cfdbd1"/><g transform="translate(6 6) scale(.75)">${icon}</g><text x="${width-11}" y="19" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="600" fill="${color}">${entities.length}</text></svg>`)}`);
    }
    cluster.label.show = false;
    cluster.point.show = false;
    cluster.billboard.show = true;
    cluster.billboard.id = entities;
    cluster.billboard.image = imageCache.get(key)!;
    cluster.billboard.width = width;
    cluster.billboard.height = 30;
    cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
  });
  return layer;
}
export function updateAmenityLayer(C: Engine, layer: Cesium.CustomDataSource, focus: Cesium.CustomDataSource, places: Amenity[], selectedId?: string, options: {nativeSelectedLabel?: boolean} = {}) {
  layer.entities.suspendEvents();
  focus.entities.suspendEvents();
  layer.entities.removeAll();
  focus.entities.removeAll();
  for (const place of places) {
    const selected = place.id === selectedId;
    // A selected place stays outside clustering, so its marker cannot disappear into a count.
    (selected ? focus : layer).entities.add({ id: `amenity:${place.id}`, name: place.name,
      properties: { category: place.category }, position: C.Cartesian3.fromDegrees(place.lng, place.lat),
      billboard: { show: !(selected && options.nativeSelectedLabel), image: markerImage(place.category), width: 32, height: 32,
        heightReference: C.HeightReference.CLAMP_TO_3D_TILE, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: { show: selected && !options.nativeSelectedLabel, text: place.name.length > 30 ? `${place.name.slice(0, 28)}…` : place.name,
        font: "bold 12px sans-serif", fillColor: C.Color.fromCssColorString("#33415f"), showBackground: true,
        backgroundColor: C.Color.WHITE.withAlpha(0.96), backgroundPadding: new C.Cartesian2(9, 7),
        pixelOffset: new C.Cartesian2(0, -34), heightReference: C.HeightReference.CLAMP_TO_3D_TILE, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    });
  }
  layer.entities.resumeEvents();
  focus.entities.resumeEvents();
}
export function fitAmenities(C: Engine, viewer: Cesium.Viewer, places: Pick<Amenity, "lng" | "lat">[], container: HTMLDivElement | null) {
  if (!places.length) return;
  const sphere = C.BoundingSphere.fromPoints(places.map(p => C.Cartesian3.fromDegrees(p.lng, p.lat, 30)));
  const bounds = container?.getBoundingClientRect();
  if (bounds && (bounds.width < 2 || bounds.height < 2)) return;
  const width=viewer.canvas.clientWidth,height=viewer.canvas.clientHeight;
  const free=readMapViewport(viewer.canvas);
  if(free.right-free.left<40 || free.bottom-free.top<40)return;
  const frustum = viewer.camera.frustum;
  const tangent = frustum instanceof C.PerspectiveFrustum ? Math.tan((frustum.fovy ?? Math.PI / 3) / 2) : .58;
  const range = Math.max(700, sphere.radius * 1.3 / (tangent * Math.min((free.bottom-free.top)/height,(free.right-free.left)/height)));
  const motion=mapMotion(C,viewer,sphere.center);
  viewer.camera.cancelFlight();
  if(places.length===1 && motion.visible){viewer.scene.requestRender();return;}
  viewer.camera.flyToBoundingSphere(sphere, { duration: motion.duration,
    offset: new C.HeadingPitchRange(viewer.camera.heading, -1.15, range), complete: () => {
      if (viewer.isDestroyed()) return;
      viewer.camera.moveDown((height/2-(free.top+free.bottom)/2)/height*2*range*tangent);
      viewer.camera.moveRight((width/2-(free.left+free.right)/2)/height*2*range*tangent);
      viewer.scene.requestRender();
    },
  });
}
