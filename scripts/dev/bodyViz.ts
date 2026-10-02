/** Entwickler-Vorschau des Körpermodells (wird mit esbuild gebündelt, nicht Teil der App). */
import * as THREE from "three";
import { parseBodyModel } from "../../src/domain/exercises/body3d/bodyModel";
import { createBodyMesh } from "../../src/components/exercises/three/bodyMesh";
import { getLibraryExercise } from "../../src/domain/exercises/library";
import { solvePose, type Exercise3dDefinition } from "../../src/domain/exercises/body3d";
import { forwardKinematics } from "../../src/domain/exercises/body3d/kinematics";
import { DIMS } from "../../src/domain/exercises/body3d/skeleton";
import { BODY_REST_POSE } from "../../src/domain/exercises/body3d/bodyModel";

(async () => {
  const data = parseBodyModel(await (await fetch("body.bin")).arrayBuffer());
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") ?? "regions";
  const W = 420, H = 560;
  const shots = (params.get("shots") ?? "rest:side").split(",");
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(W * shots.length, H);
  r.setScissorTest(true);
  document.body.appendChild(r.domElement);
  const hues = [0, 30, 60, 120, 180, 210, 260, 300, 330];
  shots.forEach((shot, i) => {
    const [what, view] = shot.split(":");
    const sc = new THREE.Scene();
    sc.background = new THREE.Color("#f3f6f9");
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.8);
    dl.position.set(120, 260, 180);
    sc.add(dl);
    const body = createBodyMesh(data, { skin: "#e3b08f", shirt: "#3d7ac4", shorts: "#2c3e55", shoe: "#f4f4f2", hair: "#3a2a20", eye: "#2a2420" });
    if (mode === "muscles") body.setMuscles((id) => ({ color: `hsl(${hues[(data.muscles.indexOf(id) * 4) % 9]},85%,50%)`, amount: 1 }));
    let frames;
    if (what === "rest") frames = forwardKinematics(BODY_REST_POSE as never, [0, DIMS.pelvisHeight, 0]);
    else if (what === "neutral") frames = forwardKinematics({}, [0, DIMS.pelvisHeight, 0]);
    else {
      const [id, k] = what.split("@");
      const def = getLibraryExercise(id) as Exercise3dDefinition;
      const kf = k === "f" ? def.fault!.pose : def.keyframes[Number(k)];
      frames = solvePose(kf, def.props).frames;
      if (mode === "muscles") body.setMuscles((mid) => {
        const base = mid.replace(/_[lrc]$/, "");
        const e = def.muscles.find((m) => m.id === base || m.id === mid.replace(/_c$/, ""));
        return e ? { color: e.role === "stretch" ? "#2f8cf0" : "#e5484d", amount: 0.4 + 0.6 * ((kf.activation as Record<string, number> | undefined)?.[e.id] ?? 0.6) } : { color: "#b07a6a", amount: 0.25 };
      });
    }
    body.setPose(frames);
    sc.add(body.mesh);
    sc.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body.mesh, true);
    const c = box.getCenter(new THREE.Vector3());
    const size = Math.max(...box.getSize(new THREE.Vector3()).toArray());
    const cam = new THREE.PerspectiveCamera(30, W / H, 1, 3000);
    const dir = view === "front" ? [1, 0.15, 0.25] : view === "back" ? [-1, 0.15, -0.2] : view === "top" ? [0.3, 1, 0.3] : view === "q" ? [0.8, 0.35, 0.8] : [0.25, 0.12, 1];
    const d = new THREE.Vector3(...dir).normalize().multiplyScalar(size * 2.3);
    cam.position.copy(c).add(d);
    cam.lookAt(c);
    r.setViewport(i * W, 0, W, H);
    r.setScissor(i * W, 0, W, H);
    r.render(sc, cam);
  });
  document.title = "done";
})();
