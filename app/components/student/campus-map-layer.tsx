"use client";
import { buildingCatchment } from "@/lib/student/catchments";
import { useEffect, useMemo, useRef } from "react";
import { Building2, BookOpen, Utensils, GraduationCap } from "lucide-react";
import type * as Cesium from "cesium";
import type { LabelScene } from "@/components/design-lab/map-place-labels";
import { buildingsInCity } from "@/lib/student/catalog";
import type { StudentPlan } from "@/lib/student/state";
import { useLocale } from "@/components/locale-provider";
export default function CampusMapLayer({
  scene,
  cityId,
  plan,
  onSelect,
}: {
  scene: LabelScene | null;
  cityId: string;
  plan: StudentPlan;
  onSelect: (id: string) => void;
}) {
  const { locale } = useLocale(),
    nodes = useRef(new Map<string, HTMLDivElement>()),
    root = useRef<HTMLDivElement>(null);
  const buildings = useMemo(
    () =>
      buildingsInCity(cityId).filter(
        (b) =>
          b.id === plan.destinationId ||
          (plan.showBuildings &&
            (!plan.campusId || b.campusId === plan.campusId) &&
            (plan.buildingCategory === "all" ||
              b.category === plan.buildingCategory)),
      ),
    [
      cityId,
      plan.destinationId,
      plan.showBuildings,
      plan.campusId,
      plan.buildingCategory,
    ],
  );
  useEffect(() => {
    if (!scene || scene.viewer.isDestroyed()) return;
    const { C, viewer } = scene,
      world = new Map<string, Cesium.Cartesian3>();
    let lastSample = -Infinity;
    function project() {
      if (viewer.isDestroyed()) return;
      const sample = performance.now() - lastSample > 500;
      if (sample) lastSample = performance.now();
      if (root.current)
        root.current.dataset.detailed = String(
          viewer.camera.positionCartographic.height < 850,
        );
      for (const b of buildings) {
        const node = nodes.current.get(b.id);
        if (!node) continue;
        if (sample || !world.has(b.id)) {
          const h = viewer.scene.sampleHeightSupported
            ? viewer.scene.sampleHeight(
                C.Cartographic.fromDegrees(b.lng, b.lat),
                viewer.entities.values,
              )
            : undefined;
          world.set(b.id, C.Cartesian3.fromDegrees(b.lng, b.lat, (h ?? 0) + 4));
        }
        const point = world.get(b.id)!,
          towards = C.Cartesian3.subtract(
            point,
            viewer.camera.positionWC,
            new C.Cartesian3(),
          ),
          p =
            C.Cartesian3.dot(towards, viewer.camera.directionWC) > 0
              ? C.SceneTransforms.worldToWindowCoordinates(viewer.scene, point)
              : undefined;
        const visible =
          p &&
          p.x >= 0 &&
          p.y >= 0 &&
          p.x <= viewer.canvas.clientWidth &&
          p.y <= viewer.canvas.clientHeight;
        node.style.visibility = visible ? "visible" : "hidden";
        if (visible && p)
          node.style.transform = `translate3d(${Math.round(p.x)}px,${Math.round(p.y)}px,0)`;
      }
    }
    const remove = viewer.scene.postRender.addEventListener(project);
    project();
    viewer.scene.requestRender();
    return () => remove();
  }, [scene, buildings]);
  useEffect(() => {
    if (!scene || scene.viewer.isDestroyed()) return;
    const { C, viewer } = scene,
      c = buildingCatchment(plan.destinationId, plan.catchmentMinutes);
    if (!c) return;
    const layer = new C.CustomDataSource("student-catchment");
    let disposed = false;
    const polygons =
      c.geometry.type === "Polygon"
        ? [c.geometry.coordinates as number[][][]]
        : (c.geometry.coordinates as number[][][][]);
    for (const rings of polygons) {
      const positions = (ring: number[][]) =>
        C.Cartesian3.fromDegreesArray(ring.flat());
      layer.entities.add({
        polygon: {
          hierarchy: new C.PolygonHierarchy(
            positions(rings[0]),
            rings.slice(1).map((r) => new C.PolygonHierarchy(positions(r))),
          ),
          material: C.Color.fromCssColorString("#58b48c").withAlpha(0.18),
          classificationType: C.ClassificationType.CESIUM_3D_TILE,
        },
        polyline: {
          positions: positions(rings[0]),
          width: 2,
          clampToGround: true,
          material: C.Color.fromCssColorString("#4c9d78").withAlpha(0.7),
        },
      });
    }
    void viewer.dataSources.add(layer).then(() => {
      if (disposed && !viewer.isDestroyed())
        viewer.dataSources.remove(layer, true);
      else if (!viewer.isDestroyed()) viewer.scene.requestRender();
    });
    return () => {
      disposed = true;
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(layer, true);
        viewer.scene.requestRender();
      }
    };
  }, [scene, plan.destinationId, plan.catchmentMinutes]);
  if (!scene) return null;
  const icons = {
    teaching: Building2,
    library: BookOpen,
    services: GraduationCap,
    dining: Utensils,
  };
  return (
    <div
      className="map-campus-layer"
      ref={root}
      aria-label={locale === "zh" ? "校园建筑标记" : "Campus building markers"}
    >
      {plan.catchmentMinutes && (
        <div className="student-catchment-legend">
          <span />
          {plan.catchmentMinutes}{" "}
          {locale === "zh"
            ? "分钟步行至所选楼栋"
            : "min walk to selected building"}{" "}
          · Valhalla / OSM
        </div>
      )}
      {buildings.map((b) => {
        const Icon = icons[b.category];
        return (
          <div
            key={b.id}
            ref={(node) => {
              if (node) nodes.current.set(b.id, node);
              else nodes.current.delete(b.id);
            }}
            className={`map-campus-marker ${b.id === plan.destinationId ? "is-selected" : ""}`}
            style={{ visibility: "hidden" }}
          >
            <button
              title={b.name}
              aria-label={`${locale === "zh" ? "校园楼栋" : "Campus building"}: ${b.name}`}
              aria-pressed={b.id === plan.destinationId}
              onClick={() => onSelect(b.id)}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{b.name}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
