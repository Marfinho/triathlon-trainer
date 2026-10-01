import * as THREE from "three";
import {
  buildScene,
  type Exercise3dDefinition,
  type Pose3d,
  type Primitive,
} from "@/domain/exercises/body3d";
import { viewBasis } from "@/domain/exercises/body3d/svg";

/**
 * three.js-Darstellung der 3D-Szene (nur im Browser, wird nachgeladen).
 * Körper und Muskeln kommen ausschließlich aus `buildScene` – dieselben
 * Daten wie die flache SVG-Ansicht. Farben aus den CSS-Variablen `--fig-*`,
 * damit Hell/Dunkel automatisch passen.
 */

export type ViewMode = "body" | "muscles";

export interface Body3dRenderer {
  setPose(pose: Pose3d, mode: ViewMode): void;
  render(): void;
  /** Drehen um die Hochachse (dx) und Neigen (dy), in Grad */
  orbit(dx: number, dy: number): void;
  zoom(factor: number): void;
  resetView(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

interface Palette {
  bg: string;
  shirt: string;
  pants: string;
  skin: string;
  shoe: string;
  hair: string;
  bone: string;
  work: string;
  stretch: string;
  idle: string;
  prop: string;
  grid: string;
}

function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--fig-card", "#f5f8fb"),
    shirt: v("--fig-top", "#5b9be6"),
    pants: v("--fig-leg", "#5f7893"),
    skin: v("--fig-skin", "#e8bd99"),
    shoe: v("--fig-shoe", "#ffffff"),
    hair: v("--fig-hair", "#2b211c"),
    bone: v("--fig-tag", "#e6edf3"),
    work: v("--fig-muscle", "#ff6b6b"),
    stretch: v("--fig-stretch", "#2f8cf0"),
    idle: v("--fig-idle-muscle", "#c9a0a0"),
    prop: v("--fig-prop", "#dfe6ec"),
    grid: v("--fig-propline", "#8597a6"),
  };
}

const UP = new THREE.Vector3(0, 1, 0);

/** Kamera-Ausgangslage: Blickrichtung der Übung, leicht von oben und schräg. */
function initialAngles(def: Exercise3dDefinition): { yaw: number; pitch: number } {
  const c = viewBasis(def.view).toCam;
  const yaw = (Math.atan2(c[0], c[2]) * 180) / Math.PI;
  const pitch = (Math.asin(Math.max(-1, Math.min(1, c[1]))) * 180) / Math.PI;
  if (def.view === "top") return { yaw: 0, pitch: 70 };
  return { yaw: yaw - 18, pitch: Math.max(pitch, 12) };
}

export function createBody3dRenderer(
  canvas: HTMLCanvasElement,
  def: Exercise3dDefinition,
  colorSource: Element,
): Body3dRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const pal = readPalette(colorSource);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(pal.bg);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(120, 260, 180);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(-160, 120, -140);
  scene.add(rim);

  // Bildausschnitt aus allen Schlüsselbildern
  const box = new THREE.Box3();
  for (const k of def.keyframes)
    for (const p of buildScene(def, k).primitives) {
      if (p.kind === "capsule") {
        box.expandByPoint(new THREE.Vector3(...p.a));
        box.expandByPoint(new THREE.Vector3(...p.b));
      } else box.expandByPoint(new THREE.Vector3(...p.center));
    }
  // Körpermaße plus Polster für die Körperdicke (Mittelpunkte → Oberfläche)
  box.expandByScalar(12);
  const bodyBox = box.clone();
  for (const p of def.props)
    if (p.type === "box") {
      const d = p.d ?? 40;
      box.expandByPoint(new THREE.Vector3(p.x - p.w / 2, 0, (p.z ?? 0) - d / 2));
      box.expandByPoint(new THREE.Vector3(p.x + p.w / 2, p.h, (p.z ?? 0) + d / 2));
    }
  const target = box.getCenter(new THREE.Vector3());
  const span = Math.max(box.getSize(new THREE.Vector3()).length(), 120);

  // Boden, Raster, Requisiten
  const staticGroup = new THREE.Group();
  scene.add(staticGroup);
  const floorMat = new THREE.MeshStandardMaterial({ color: pal.bg, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(span * 1.2, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(target.x, -0.2, target.z);
  staticGroup.add(floor);
  const grid = new THREE.GridHelper(span * 2, Math.round((span * 2) / 20), pal.grid, pal.grid);
  grid.position.set(target.x, 0, target.z);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.25;
  staticGroup.add(grid);
  const propMat = new THREE.MeshStandardMaterial({ color: pal.prop, roughness: 0.9 });
  for (const p of def.props) {
    if (p.type === "box") {
      const d = p.d ?? 40;
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, d), propMat);
      m.position.set(p.x, p.h / 2, p.z ?? 0);
      staticGroup.add(m);
    } else if (p.type === "wall") {
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, 200, 140), propMat);
      m.position.set(p.x + 3, 100, 0);
      staticGroup.add(m);
    } else if (p.type === "mat") {
      // Matte unter dem Körper (Ausdehnung aus allen Schlüsselbildern)
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(bodyBox.max.x - bodyBox.min.x + 20, 60), 1, Math.max(bodyBox.max.z - bodyBox.min.z + 20, 60)),
        new THREE.MeshStandardMaterial({ color: pal.shirt, roughness: 1, transparent: true, opacity: 0.3 }),
      );
      const c = bodyBox.getCenter(new THREE.Vector3());
      m.position.set(c.x, 0.5, c.z);
      staticGroup.add(m);
    }
  }

  const camera = new THREE.PerspectiveCamera(30, 1.25, 1, 5000);
  let { yaw, pitch } = initialAngles(def);
  let dist = span * 1.75;
  const home = { yaw, pitch, dist };
  function placeCamera() {
    const y = (yaw * Math.PI) / 180,
      p = (pitch * Math.PI) / 180;
    camera.position.set(
      target.x + dist * Math.cos(p) * Math.sin(y),
      target.y + dist * Math.sin(p),
      target.z + dist * Math.cos(p) * Math.cos(y),
    );
    camera.lookAt(target);
  }
  placeCamera();

  // Körperteile
  const sphere = new THREE.SphereGeometry(1, 28, 18);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const partMat = (color: string) => {
    let m = materials.get(color);
    if (!m) materials.set(color, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.75 })));
    return m;
  };
  const partColor = (part: string, mode: ViewMode) =>
    mode === "muscles" && part !== "hair" && part !== "shoe"
      ? pal.bone
      : ({ shirt: pal.shirt, pants: pal.pants, skin: pal.skin, shoe: pal.shoe, hair: pal.hair } as Record<string, string>)[part];

  const body = new THREE.Group();
  scene.add(body);
  const objects = new Map<string, THREE.Object3D>();
  const ownGeometries: THREE.BufferGeometry[] = [];
  let currentMode: ViewMode | null = null;

  function clearBody() {
    body.clear();
    objects.clear();
    ownGeometries.splice(0).forEach((g) => g.dispose());
    for (const m of muscleMats.values()) m.dispose();
    muscleMats.clear();
  }

  const muscleMats = new Map<string, THREE.MeshStandardMaterial>();

  function create(p: Primitive, mode: ViewMode): THREE.Object3D {
    if (p.kind === "capsule") {
      const g = new THREE.Group();
      const mat = partMat(partColor(p.part, mode));
      const cylGeo = new THREE.CylinderGeometry(p.rb, p.ra, 1, 24, 1, true);
      cylGeo.translate(0, 0.5, 0);
      ownGeometries.push(cylGeo);
      const cyl = new THREE.Mesh(cylGeo, mat);
      const sa = new THREE.Mesh(sphere, mat);
      sa.scale.setScalar(p.ra);
      const sb = new THREE.Mesh(sphere, mat);
      sb.scale.setScalar(p.rb);
      g.add(cyl, sa, sb);
      return g;
    }
    const mat =
      p.kind === "muscle"
        ? new THREE.MeshStandardMaterial({ roughness: 0.55, transparent: true })
        : partMat(partColor(p.part, mode));
    if (p.kind === "muscle") muscleMats.set(p.id, mat);
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.matrixAutoUpdate = false;
    if (p.kind === "muscle") mesh.renderOrder = 2;
    return mesh;
  }

  const tmpA = new THREE.Vector3(),
    tmpB = new THREE.Vector3(),
    tmpDir = new THREE.Vector3(),
    bx = new THREE.Vector3(),
    by = new THREE.Vector3(),
    bz = new THREE.Vector3();

  function update(obj: THREE.Object3D, p: Primitive, mode: ViewMode) {
    if (p.kind === "capsule") {
      tmpA.set(...p.a);
      tmpB.set(...p.b);
      tmpDir.subVectors(tmpB, tmpA);
      const len = tmpDir.length();
      const [cyl, sa, sb] = obj.children;
      cyl.position.copy(tmpA);
      cyl.quaternion.setFromUnitVectors(UP, len > 1e-6 ? tmpDir.normalize() : UP);
      cyl.scale.set(1, Math.max(len, 1e-3), 1);
      sa.position.copy(tmpA);
      sb.position.copy(tmpB);
      return;
    }
    const R = p.R;
    bx.set(R[0], R[3], R[6]);
    by.set(R[1], R[4], R[7]);
    bz.set(R[2], R[5], R[8]);
    const grow = p.kind === "muscle" && mode === "body" ? 1.12 : 1;
    obj.matrix
      .makeBasis(bx, by, bz)
      .scale(tmpA.set(p.radii[0] * grow, p.radii[1], p.radii[2] * grow))
      .setPosition(p.center[0], p.center[1], p.center[2]);
    obj.matrixWorldNeedsUpdate = true;
    if (p.kind === "muscle") {
      const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const color = p.role === "stretch" ? pal.stretch : p.role === "idle" ? pal.idle : pal.work;
      mat.color.set(color);
      const a = p.role === "idle" ? 0.3 : 0.5 + 0.5 * p.activation;
      mat.opacity = Math.min(1, a);
      mat.emissive.set(color);
      mat.emissiveIntensity = p.role === "idle" ? 0 : 0.35 * p.activation;
    }
  }

  return {
    setPose(pose, mode) {
      if (mode !== currentMode) {
        clearBody();
        currentMode = mode;
      }
      const s = buildScene(def, pose, { mode });
      const seen = new Set<string>();
      for (const p of s.primitives) {
        seen.add(p.id);
        let obj = objects.get(p.id);
        if (!obj) {
          obj = create(p, mode);
          objects.set(p.id, obj);
          body.add(obj);
        }
        obj.visible = true;
        update(obj, p, mode);
      }
      for (const [id, obj] of objects) if (!seen.has(id)) obj.visible = false;
    },
    render() {
      renderer.render(scene, camera);
    },
    orbit(dx, dy) {
      yaw -= dx;
      pitch = Math.max(-5, Math.min(85, pitch + dy));
      placeCamera();
    },
    zoom(factor) {
      dist = Math.max(span * 0.6, Math.min(span * 3, dist * factor));
      placeCamera();
    },
    resetView() {
      ({ yaw, pitch, dist } = home);
      placeCamera();
    },
    resize(width, height) {
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    dispose() {
      clearBody();
      sphere.dispose();
      for (const m of materials.values()) m.dispose();
      staticGroup.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      grid.geometry.dispose();
      renderer.dispose();
    },
  };
}
