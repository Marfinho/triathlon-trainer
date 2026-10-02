import * as THREE from "three";
import { BODY_REGIONS, type BodyModelData } from "@/domain/exercises/body3d/bodyModel";
import type { BodyFrames } from "@/domain/exercises/body3d/kinematics";

/**
 * Realistischer Körper als SkinnedMesh. Die Knochen werden direkt aus den
 * Frames der Kinematik gesetzt (keine Hierarchie nötig). Muskeln werden auf
 * der Haut eingefärbt: je Eckpunkt bis zu zwei Muskelzonen, Farbe und Stärke
 * je Muskel kommen als Uniform-Arrays.
 */

export const MAX_MUSCLES = 48;

export interface BodyColors {
  skin: string;
  shirt: string;
  shorts: string;
  shoe: string;
  hair: string;
  eye: string;
}

export interface MuscleLook {
  color: string;
  /** 0 … 1 Deckkraft der Einfärbung */
  amount: number;
}

export interface BodyMesh {
  mesh: THREE.SkinnedMesh;
  setPose(frames: BodyFrames): void;
  setColors(colors: BodyColors): void;
  setMuscles(look: (id: string) => MuscleLook | null): void;
  /** Anatomie-Ansicht: Muskelzonen in Muskelfarbe mit Trennlinien */
  setAnatomy(on: boolean, color?: string): void;
  dispose(): void;
}

export function createBodyMesh(data: BodyModelData, colors: BodyColors, opts: { ghost?: string } = {}): BodyMesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(data.position, 3));
  g.setIndex(new THREE.BufferAttribute(data.index, 1));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(Uint16Array.from(data.skinIndex), 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(new Float32Array(data.skinWeight).map((x) => x / 255), 4));
  g.setAttribute("muscleIndex", new THREE.BufferAttribute(new Float32Array(data.muscleIndex), 2));
  g.setAttribute("muscleWeight", new THREE.BufferAttribute(new Float32Array(data.muscleWeight).map((x) => x / 255), 2));
  const colorAttr = new THREE.BufferAttribute(new Float32Array(data.vertexCount * 3), 3);
  g.setAttribute("color", colorAttr);
  g.computeVertexNormals();

  const muscleColor = Array.from({ length: MAX_MUSCLES }, () => new THREE.Color(0xff0000));
  const muscleAmount = new Float32Array(MAX_MUSCLES);
  const anatomy = { value: 0 };
  const anatomyColor = { value: new THREE.Color("#b47a70") };
  const material = opts.ghost
    ? new THREE.MeshStandardMaterial({ color: opts.ghost, transparent: true, opacity: 0.22, depthWrite: false, roughness: 1 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
  if (!opts.ghost) material.onBeforeCompile = (shader) => {
    shader.uniforms.muscleColor = { value: muscleColor };
    shader.uniforms.muscleAmount = { value: muscleAmount };
    shader.uniforms.uAnatomy = anatomy;
    shader.uniforms.uAnatomyColor = anatomyColor;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec2 muscleIndex;
attribute vec2 muscleWeight;
uniform vec3 muscleColor[${MAX_MUSCLES}];
uniform float muscleAmount[${MAX_MUSCLES}];
varying vec3 vMuscle;
varying float vMuscleMix;
varying float vCover;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
int mi0 = int(muscleIndex.x + 0.5);
int mi1 = int(muscleIndex.y + 0.5);
float ma0 = mi0 < ${MAX_MUSCLES} ? muscleAmount[mi0] * muscleWeight.x : 0.0;
float ma1 = mi1 < ${MAX_MUSCLES} ? muscleAmount[mi1] * muscleWeight.y : 0.0;
vec3 mc0 = mi0 < ${MAX_MUSCLES} ? muscleColor[mi0] : vec3(0.0);
vec3 mc1 = mi1 < ${MAX_MUSCLES} ? muscleColor[mi1] : vec3(0.0);
vMuscleMix = clamp(ma0 + ma1, 0.0, 1.0);
vCover = mi0 < ${MAX_MUSCLES} ? muscleWeight.x : 0.0;
vMuscle = (mc0 * ma0 + mc1 * ma1) / max(ma0 + ma1, 1e-4);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vMuscle;\nvarying float vMuscleMix;\nvarying float vCover;\nuniform float uAnatomy;\nuniform vec3 uAnatomyColor;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
if (uAnatomy > 0.5) {
  // Muskelfarbe als Grund, dunkle Linien an den Rändern der Muskelzonen
  float cov = smoothstep(0.04, 0.4, vCover);
  diffuseColor.rgb = mix(diffuseColor.rgb, uAnatomyColor, cov);
  float edge = smoothstep(0.12, 0.3, vCover) * (1.0 - smoothstep(0.38, 0.7, vCover));
  diffuseColor.rgb *= 1.0 - 0.38 * edge;
}
diffuseColor.rgb = mix(diffuseColor.rgb, vMuscle, vMuscleMix * 0.9);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vMuscle * vMuscleMix * 0.45;",
      );
  };
  material.customProgramCacheKey = () => "brick-body-muscles";

  const mesh = new THREE.SkinnedMesh(g, material);
  mesh.castShadow = !opts.ghost;
  mesh.frustumCulled = false;
  const bones = data.bones.map(() => {
    const b = new THREE.Bone();
    b.matrixAutoUpdate = false;
    mesh.add(b);
    return b;
  });
  const inverses = data.restMatrices.map((m) => new THREE.Matrix4().fromArray(m).invert());
  mesh.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());

  function setColors(c: BodyColors) {
    const byRegion = new Map<number, THREE.Color>([
      [BODY_REGIONS.skin, new THREE.Color(c.skin)],
      [BODY_REGIONS.shirt, new THREE.Color(c.shirt)],
      [BODY_REGIONS.shorts, new THREE.Color(c.shorts)],
      [BODY_REGIONS.shoe, new THREE.Color(c.shoe)],
      [BODY_REGIONS.hair, new THREE.Color(c.hair)],
      [BODY_REGIONS.eye, new THREE.Color(c.eye)],
    ]);
    const arr = colorAttr.array as Float32Array;
    for (let i = 0; i < data.vertexCount; i++) {
      const col = byRegion.get(data.region[i]) ?? byRegion.get(BODY_REGIONS.skin)!;
      arr[i * 3] = col.r;
      arr[i * 3 + 1] = col.g;
      arr[i * 3 + 2] = col.b;
    }
    colorAttr.needsUpdate = true;
  }
  setColors(colors);

  const m4 = new THREE.Matrix4();
  return {
    mesh,
    setPose(frames) {
      data.bones.forEach((name, i) => {
        const f = frames[name];
        const R = f.R;
        m4.set(R[0], R[1], R[2], f.origin[0], R[3], R[4], R[5], f.origin[1], R[6], R[7], R[8], f.origin[2], 0, 0, 0, 1);
        bones[i].matrix.copy(m4);
        bones[i].matrixWorldNeedsUpdate = true;
      });
    },
    setColors,
    setAnatomy(on, color) {
      anatomy.value = on ? 1 : 0;
      if (color) anatomyColor.value.set(color);
    },
    setMuscles(look) {
      data.muscles.forEach((id, i) => {
        if (i >= MAX_MUSCLES) return;
        const l = look(id);
        muscleAmount[i] = l ? l.amount : 0;
        if (l) muscleColor[i].set(l.color);
      });
    },
    dispose() {
      g.dispose();
      material.dispose();
    },
  };
}
