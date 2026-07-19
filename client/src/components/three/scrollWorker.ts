import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// requestAnimationFrame is available in workers that own an OffscreenCanvas (Chrome/Firefox/Safari)
declare function requestAnimationFrame(cb: FrameRequestCallback): number;

interface Keyframe {
  x: number; z: number;
  cx: number; cy: number; cz: number;
  fov: number; yaw: number;
}

const CAR_PIVOT_Y = -0.75;

const sceneKeyframes: Keyframe[] = [
  { x: 0,    z: 0,    cx: -2.6, cy: 0.6,  cz: 3.4, fov: 40, yaw: 0    },
  { x: 0,    z: 0,    cx:  2.4, cy: 0.5,  cz: 3.0, fov: 34, yaw: -1.9 },
  { x: -0.4, z: -0.6, cx:  0,   cy: 5.4,  cz: 0.4, fov: 22, yaw:  1.4 },
  { x: 0,    z: 0,    cx: -1.6, cy: 0.35, cz: 2.4, fov: 28, yaw:  3.2 },
  { x: 0,    z: 0,    cx:  1.8, cy: 0.5,  cz: 3.2, fov: 36, yaw:  4.6 },
];

const HDR_URL = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/evening_road_01_1k.hdr';
const MODEL_URL = 'https://res.cloudinary.com/dsuoykfqa/raw/upload/v1784478778/porsche-930-turbo.glb';

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

// State updated by messages from the main thread
let scrollY = 0;
let sectionTops: number[] = [];
let sectionBottoms: number[] = [];
let renderer: THREE.WebGLRenderer | null = null;
let camera: THREE.PerspectiveCamera | null = null;

function getSectionScrollData() {
  for (let i = 0; i < sectionTops.length - 1; i++) {
    if (scrollY < sectionBottoms[i]) {
      const segLen = sectionBottoms[i] - sectionTops[i];
      const t = segLen > 0 ? Math.min(Math.max(0, scrollY - sectionTops[i]) / segLen, 1) : 0;
      return { sectionIdx: i, sectionT: easeOutCubic(t) };
    }
  }
  return { sectionIdx: Math.max(sectionTops.length - 1, 0), sectionT: 1 };
}

// Single message handler for all message types
addEventListener('message', (e: MessageEvent) => {
  const msg = e.data as { type: string } & Record<string, unknown>;
  switch (msg.type) {
    case 'init':
      initScene(msg.canvas as OffscreenCanvas, msg.width as number, msg.height as number);
      break;
    case 'scroll':
      scrollY = msg.scrollY as number;
      sectionTops = msg.sectionTops as number[];
      sectionBottoms = msg.sectionBottoms as number[];
      break;
    case 'resize':
      scrollY = msg.scrollY as number;
      sectionTops = msg.sectionTops as number[];
      sectionBottoms = msg.sectionBottoms as number[];
      if (camera && renderer) {
        const w = msg.width as number;
        const h = msg.height as number;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
      break;
  }
});

function initScene(canvas: OffscreenCanvas, width: number, height: number) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 3.0;

  const scene = new THREE.Scene();
  const clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0.5, 3.4);
  camera.lookAt(0, CAR_PIVOT_Y, 0);

  const rimLight = new THREE.DirectionalLight(0xff4500, 0.0);
  rimLight.position.set(-4, 1.5, -5);
  scene.add(rimLight);

  const keyLight = new THREE.DirectionalLight(0xff9500, 1.0);
  const keyLightTarget = new THREE.Object3D();
  scene.add(keyLightTarget);
  keyLight.target = keyLightTarget;
  scene.add(keyLight);

  new RGBELoader().load(HDR_URL, (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = tex;
  });

  let car: THREE.Object3D | null = null;
  (async () => {
    try {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
        loader.load(MODEL_URL, resolve, undefined, reject);
      });
      car = gltf.scene;
      const box = new THREE.Box3().setFromObject(car);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const scale = 4.4 / Math.max(size.x, size.y, size.z);
      car.scale.setScalar(scale);
      car.position.x = -center.x * scale;
      car.position.y = -center.y * scale - 0.75;
      car.position.z = -center.z * scale;
      car.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            const mat = m as THREE.MeshStandardMaterial;
            if (mat.envMapIntensity !== undefined) mat.envMapIntensity = 1.19;
          });
        }
      });
      scene.add(car);
    } catch (err) {
      console.warn('Porsche model failed to load:', err);
    }
  })();

  let currentX = 0, currentZ = 0;
  let currentCX = sceneKeyframes[0].cx;
  let currentCY = sceneKeyframes[0].cy;
  let currentCZ = sceneKeyframes[0].cz;
  let currentFOV = sceneKeyframes[0].fov;
  let dragYaw = 0;

  const lookAtVec = new THREE.Vector3();
  const baseOffsetVec = new THREE.Vector3();
  const orbitMat = new THREE.Matrix4();

  const tick = () => {
    requestAnimationFrame(tick);

    const dt = Math.min(clock.getDelta(), 0.1);
    const speed = 1 - Math.pow(1 - 0.065, dt * 60);

    const { sectionIdx, sectionT } = getSectionScrollData();
    const kA = sceneKeyframes[Math.min(sectionIdx, sceneKeyframes.length - 1)];
    const kB = sceneKeyframes[Math.min(sectionIdx + 1, sceneKeyframes.length - 1)];

    const targetX   = lerp(kA.x,   kB.x,   sectionT);
    const targetZ   = lerp(kA.z,   kB.z,   sectionT);
    const targetCX  = lerp(kA.cx,  kB.cx,  sectionT);
    const targetCY  = lerp(kA.cy,  kB.cy,  sectionT);
    const targetCZ  = lerp(kA.cz,  kB.cz,  sectionT);
    const targetFOV = lerp(kA.fov, kB.fov, sectionT);
    const targetYaw = lerp(kA.yaw, kB.yaw, sectionT);

    const needsRender =
      Math.abs(targetCX  - currentCX)  > 0.0001 ||
      Math.abs(targetCY  - currentCY)  > 0.0001 ||
      Math.abs(targetCZ  - currentCZ)  > 0.0001 ||
      Math.abs(targetFOV - currentFOV) > 0.001  ||
      Math.abs(targetYaw - dragYaw)    > 0.0001;

    if (car) {
      currentX = lerp(currentX, targetX, speed);
      currentZ = lerp(currentZ, targetZ, speed);
      car.position.x = currentX;
      car.position.z = currentZ;
    }
    currentCX  = lerp(currentCX,  targetCX,  speed);
    currentCY  = lerp(currentCY,  targetCY,  speed);
    currentCZ  = lerp(currentCZ,  targetCZ,  speed);
    currentFOV = lerp(currentFOV, targetFOV, speed);
    dragYaw    = lerp(dragYaw,    targetYaw, speed);

    if (!needsRender) return;

    camera!.fov = currentFOV;
    camera!.updateProjectionMatrix();

    lookAtVec.set(currentX, CAR_PIVOT_Y, currentZ);
    baseOffsetVec.set(currentCX - currentX, currentCY - CAR_PIVOT_Y, currentCZ - currentZ);
    orbitMat.makeRotationY(dragYaw);
    baseOffsetVec.applyMatrix4(orbitMat);
    camera!.position.set(
      lookAtVec.x + baseOffsetVec.x,
      lookAtVec.y + baseOffsetVec.y,
      lookAtVec.z + baseOffsetVec.z,
    );
    camera!.lookAt(lookAtVec);

    const LIGHT_ANGLE = Math.PI * 0.18;
    keyLight.position.set(currentX + Math.sin(LIGHT_ANGLE) * 12, 14, currentZ + Math.cos(LIGHT_ANGLE) * 12);
    keyLightTarget.position.set(currentX, 0, currentZ);
    keyLightTarget.updateMatrixWorld();
    rimLight.position.set(currentX - 4, 3.5, currentZ - 5);

    renderer!.render(scene, camera!);
  };

  tick();
}
