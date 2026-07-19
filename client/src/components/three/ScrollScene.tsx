import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { initAudio, playStartupSound, stopEngine } from './engineSound';

interface Keyframe {
  x: number; z: number;
  cx: number; cy: number; cz: number;
  fov: number; yaw: number;
}

// Vertical world-space center of the car, matching the `-0.75` offset applied
// to car.position.y below. Kept as one constant so the camera's look-at point
// can never drift out of sync with where the car actually sits.
const CAR_PIVOT_Y = -0.75;

// One keyframe per section (Hero, Overview, Fleet, Features, CTA).
// Establishing wide shot -> closer 3/4 turntable -> parked wide shot (grid stays readable)
// -> detail shot -> hero-style closing shot. cx/cy/cz is the camera position; the camera
// always looks at the car itself (see tick()), so the car stays centered on screen.
export const sceneKeyframes: Keyframe[] = [
  { x: 0,     z: 0,    cx: -2.6, cy: 0.6,  cz: 3.4,  fov: 40, yaw: 0 },
  { x: 0,     z: 0,    cx: 2.4,  cy: 0.5,  cz: 3.0,  fov: 34, yaw: -1.9 },
  { x: -0.4,  z: -0.6, cx: 0,    cy: 5.4,  cz: 0.4,  fov: 22, yaw: 1.4 },
  { x: 0,     z: 0,    cx: -1.6, cy: 0.35, cz: 2.4,  fov: 28, yaw: 3.2 },
  { x: 0,     z: 0,    cx: 1.8,  cy: 0.5,  cz: 3.2,  fov: 36, yaw: 4.6 },
];

const HDR_URL = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/evening_road_01_1k.hdr';

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

export default function ScrollScene() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const progressBar = progressRef.current;
    if (!wrapper || !canvas || !progressBar) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 3.0;

    const clock = new THREE.Clock();
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0.5, 3.4);
    camera.lookAt(0, 0.1, 0);

    function loadHDR() {
      import('three/examples/jsm/loaders/RGBELoader.js').then(({ RGBELoader }) => {
        new RGBELoader().load(HDR_URL, (hdrTexture) => {
          hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
          scene.environment = hdrTexture;
        });
      });
    }

    const rimLight = new THREE.DirectionalLight(0xff4500, 0.0);
    rimLight.position.set(-4, 1.5, -5);
    scene.add(rimLight);

    const keyLight = new THREE.DirectionalLight(0xff9500, 1.0);
    keyLight.position.set(8, 14, 8);
    const keyLightTarget = new THREE.Object3D();
    scene.add(keyLightTarget);
    keyLight.target = keyLightTarget;
    scene.add(keyLight);

    let car: THREE.Object3D | null = null;

    loadHDR();
    (async () => {
      try {
        const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/libs/meshopt_decoder.module.js'),
        ]);

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);

        const MODEL_URL = 'https://res.cloudinary.com/dsuoykfqa/raw/upload/v1784478778/porsche-930-turbo.glb';
        const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
          loader.load(MODEL_URL, resolve, undefined, reject);
        });

        car = gltf.scene;
        const box = new THREE.Box3().setFromObject(car);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 4.4 / maxDim;
        car.scale.setScalar(scale);
        car.position.x = -center.x * scale;
        car.position.y = -center.y * scale - 0.75;
        car.position.z = -center.z * scale;

        car.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              const mat = m as THREE.MeshStandardMaterial;
              if (mat.envMapIntensity !== undefined) mat.envMapIntensity = 1.19;
            });
          }
        });

        scene.add(car);
      } catch (e) {
        console.warn('Porsche model failed to load:', e);
      }
    })();

    const onClick = () => { initAudio(); playStartupSound(); };
    canvas.addEventListener('click', onClick);

    // SCROLL-DRIVEN CAMERA
    let scrollY = window.scrollY;
    const onScroll = () => { scrollY = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Section offsets only change on resize/content-load, not every frame —
    // cache them instead of forcing a layout reflow on every tick().
    let sectionTops: number[] = [];
    let sectionBottoms: number[] = [];
    const recomputeSectionOffsets = () => {
      const sections = document.querySelectorAll<HTMLElement>('#scroll-container > section');
      sectionTops = Array.from(sections).map((s) => s.offsetTop);
      sectionBottoms = sectionTops.map((_, i) =>
        i < sectionTops.length - 1 ? sectionTops[i + 1] : document.body.scrollHeight
      );
    };
    recomputeSectionOffsets();

    function getSectionScrollData() {
      for (let i = 0; i < sectionTops.length - 1; i++) {
        if (scrollY < sectionBottoms[i]) {
          const segLen = sectionBottoms[i] - sectionTops[i];
          const segProgress = Math.max(0, scrollY - sectionTops[i]);
          const t = segLen > 0 ? Math.min(segProgress / segLen, 1) : 0;
          return { sectionIdx: i, sectionT: easeOutCubic(t) };
        }
      }
      return { sectionIdx: Math.max(sectionTops.length - 1, 0), sectionT: 1 };
    }

    let currentX = 0, currentZ = 0;
    let currentCX = sceneKeyframes[0].cx, currentCY = sceneKeyframes[0].cy, currentCZ = sceneKeyframes[0].cz;
    let currentFOV = sceneKeyframes[0].fov;
    let dragYaw = 0;

    // Reused per-frame to avoid allocating new Vector3/Matrix4 on every tick.
    const lookAtVec = new THREE.Vector3();
    const baseOffsetVec = new THREE.Vector3();
    const orbitMat = new THREE.Matrix4();

    let frameId: number;
    const tick = () => {
      frameId = requestAnimationFrame(tick);

      const totalHeight = document.body.scrollHeight - window.innerHeight;
      const scrollFrac = totalHeight > 0 ? Math.min(scrollY / totalHeight, 1) : 0;
      progressBar.style.width = `${scrollFrac * 100}%`;

      const { sectionIdx, sectionT } = getSectionScrollData();
      const clampedIdx = Math.min(sectionIdx, sceneKeyframes.length - 1);
      const kA = sceneKeyframes[clampedIdx];
      const kB = sceneKeyframes[Math.min(clampedIdx + 1, sceneKeyframes.length - 1)];

      const targetX = lerp(kA.x, kB.x, sectionT);
      const targetZ = lerp(kA.z, kB.z, sectionT);
      const targetCX = lerp(kA.cx, kB.cx, sectionT);
      const targetCY = lerp(kA.cy, kB.cy, sectionT);
      const targetCZ = lerp(kA.cz, kB.cz, sectionT);
      const targetFOV = lerp(kA.fov, kB.fov, sectionT);
      const targetYaw = lerp(kA.yaw, kB.yaw, sectionT);

      // Delta-time normalized lerp: same perceived animation speed on any frame rate.
      // Base factor 0.065 at 60 fps — cinematic but responsive.
      const dt = Math.min(clock.getDelta(), 0.1); // clamp to avoid huge jumps after tab-switch
      const speed = 1 - Math.pow(1 - 0.065, dt * 60);

      // Check distance to target BEFORE lerping — catches the very first frame of motion
      // (prev-based checks miss it because current hasn't moved yet).
      const needsRender =
        Math.abs(targetCX - currentCX) > 0.0001 ||
        Math.abs(targetCY - currentCY) > 0.0001 ||
        Math.abs(targetCZ - currentCZ) > 0.0001 ||
        Math.abs(targetFOV - currentFOV) > 0.001 ||
        Math.abs(targetYaw - dragYaw) > 0.0001;

      if (car) {
        currentX = lerp(currentX, targetX, speed);
        currentZ = lerp(currentZ, targetZ, speed);
        car.position.x = currentX;
        car.position.z = currentZ;
      }

      currentCX = lerp(currentCX, targetCX, speed);
      currentCY = lerp(currentCY, targetCY, speed);
      currentCZ = lerp(currentCZ, targetCZ, speed);
      currentFOV = lerp(currentFOV, targetFOV, speed);
      dragYaw = lerp(dragYaw, targetYaw, speed);

      camera.fov = currentFOV;
      camera.updateProjectionMatrix();

      lookAtVec.set(currentX, CAR_PIVOT_Y, currentZ);
      baseOffsetVec.set(currentCX - currentX, currentCY - CAR_PIVOT_Y, currentCZ - currentZ);
      orbitMat.makeRotationY(dragYaw);
      baseOffsetVec.applyMatrix4(orbitMat);
      camera.position.set(lookAtVec.x + baseOffsetVec.x, lookAtVec.y + baseOffsetVec.y, lookAtVec.z + baseOffsetVec.z);
      camera.lookAt(lookAtVec);

      if (!needsRender) return;

      const lightRadius = 12;
      const LIGHT_ANGLE = Math.PI * 0.18;
      keyLight.position.set(
        currentX + Math.sin(LIGHT_ANGLE) * lightRadius,
        14,
        currentZ + Math.cos(LIGHT_ANGLE) * lightRadius
      );
      keyLightTarget.position.set(currentX, 0, currentZ);
      keyLightTarget.updateMatrixWorld();
      rimLight.position.set(currentX - 4, 3.5, currentZ - 5);

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      recomputeSectionOffsets();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('click', onClick);
      stopEngine();
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div className="scroll-progress" ref={progressRef} />
      <div ref={wrapperRef} className="fixed inset-0 w-full h-screen z-[1] pointer-events-none">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
      <div
        className="fixed inset-0 w-full h-full z-[2] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 75% 65% at 50% 60%, transparent 40%, rgba(10,10,10,0.35) 62%, rgba(10,10,10,0.75) 82%, #0a0a0a 100%)',
        }}
      />
    </>
  );
}
