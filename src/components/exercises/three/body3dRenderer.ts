import * as THREE from "three";
import {
  buildScene,
  solvePose,
  type Exercise3dDefinition,
  type Pose3d,
  type Primitive,
} from "@/domain/exercises/body3d";
import { viewBasis } from "@/domain/exercises/body3d/svg";
import { muscleInstanceState } from "@/domain/exercises/body3d/scene";
import type { BodyModelData } from "@/domain/exercises/body3d/bodyModel";
import { createBodyMesh, type BodyColors, type BodyMesh } from "./bodyMesh";

/**
 * three.js-Darstellung der 3D-Szene (nur im Browser, wird nachgeladen).
 * Mit Körpermodell: realistischer Körper (SkinnedMesh), Muskeln auf der Haut.
 * Ohne Modell (Laden fehlgeschlagen): einfacher Körper aus `buildScene`.
 * Farben aus den CSS-Variablen `--fig-*`, damit Hell/Dunkel passen.
 */

export type ViewMode = "body" | "muscles";

export interface Body3dRenderer {
  setPose(pose: Pose3d, mode: ViewMode): void;
  /** Aktuelles Bild als PNG-Daten-URL (für Standbilder) */
  snapshot(): string;
  /** Blasse Vergleichsfigur (z. B. vorheriges Schlüsselbild), null = aus */
  setGhost(pose: Pose3d | null): void;
  /** Weltpunkt → Bildposition (0…1, links oben = 0,0) und Tiefe (−1 … 1, kleiner = näher) */
  project(p: readonly [number, number, number]): [number, number, number];
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
  anatomy: string;
  ghost: string;
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
    anatomy: v("--fig-anatomy", "#b47a70"),
    ghost: v("--fig-ghost", "#3f8fd8"),
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
  model: BodyModelData | null = null,
): Body3dRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pal = readPalette(colorSource);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(pal.bg);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(120, 260, 180);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 4;
  scene.add(sun);
  scene.add(sun.target);
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
  // Schatten nur um den Körper herum berechnen
  sun.target.position.copy(target);
  sun.position.set(target.x + 80, target.y + 240, target.z + 120);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -span * 0.8;
  sc.right = sc.top = span * 0.8;
  sc.near = 10;
  sc.far = 700;
  sc.updateProjectionMatrix();

  // Boden, Raster, Requisiten
  const staticGroup = new THREE.Group();
  scene.add(staticGroup);
  const floorMat = new THREE.MeshStandardMaterial({ color: pal.bg, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(span * 1.2, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(target.x, -0.2, target.z);
  floor.receiveShadow = true;
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
      m.receiveShadow = m.castShadow = true;
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
      m.receiveShadow = true;
      staticGroup.add(m);
    }
  }

  const camera = new THREE.PerspectiveCamera(30, 1.25, 1, 5000);
  let { yaw, pitch } = initialAngles(def);
  let dist = span * 1.3;
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

  // Realistischer Körper
  let bodyMesh: BodyMesh | null = null;
  if (model) {
    bodyMesh = createBodyMesh(model, bodyColors("body"));
    scene.add(bodyMesh.mesh);
  }
  function bodyColors(mode: ViewMode): BodyColors {
    // In der Muskel-Ansicht ohne Kleidung (Haut unter den Muskelzonen)
    return mode === "muscles"
      ? { skin: pal.skin, shirt: pal.skin, shorts: pal.skin, shoe: pal.skin, hair: pal.hair, eye: "#2a2420" }
      : { skin: pal.skin, shirt: pal.shirt, shorts: pal.pants, shoe: pal.shoe, hair: pal.hair, eye: "#2a2420" };
  }
  let meshMode: ViewMode | null = null;
  function setMeshPose(pose: Pose3d, mode: ViewMode) {
    const bm = bodyMesh!;
    if (mode !== meshMode) {
      bm.setColors(bodyColors(mode));
      bm.setAnatomy(mode === "muscles", pal.anatomy);
      meshMode = mode;
    }
    const solved = solvePose(pose, def.props);
    bm.setPose(solved.frames);
    bm.setMuscles((id) => {
      const st = muscleInstanceState(def, solved.activation, id);
      if (!st.listed) return null;
      const color = st.role === "stretch" ? pal.stretch : pal.work;
      const k = st.role === "stabilize" ? 0.75 : 1;
      return { color, amount: Math.min(1, (0.35 + 0.65 * st.activation) * k) };
    });
  }

  let ghostMesh: BodyMesh | null = null;

  return {
    setGhost(pose) {
      if (!model) return;
      if (!pose) {
        if (ghostMesh) ghostMesh.mesh.visible = false;
        return;
      }
      if (!ghostMesh) {
        ghostMesh = createBodyMesh(model, bodyColors("body"), { ghost: pal.ghost });
        scene.add(ghostMesh.mesh);
      }
      ghostMesh.mesh.visible = true;
      ghostMesh.setPose(solvePose(pose, def.props).frames);
    },
    project(p) {
      const v = new THREE.Vector3(p[0], p[1], p[2]).project(camera);
      return [(v.x + 1) / 2, (1 - v.y) / 2, v.z];
    },
    snapshot() {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },
    setPose(pose, mode) {
      if (bodyMesh) return setMeshPose(pose, mode);
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
      bodyMesh?.dispose();
      ghostMesh?.dispose();
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
