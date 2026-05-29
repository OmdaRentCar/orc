import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { initAudio, playStartupSound, setRPM, stopEngine } from './engineSound';

export default function ThreeScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 50);
    camera.position.set(4.5, 2.2, 5.5);
    camera.lookAt(0, 0.3, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0x334466, 0.6));
    const hemi = new THREE.HemisphereLight(0x8899cc, 0x444422, 0.8);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 3.5);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4488ff, 0.8);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff8844, 0.6);
    rim.position.set(-2, 1, 5);
    scene.add(rim);
    const spot = new THREE.SpotLight(0xe72526, 0.3, 15, Math.PI / 6, 0.5, 1);
    spot.position.set(0, 6, 2);
    spot.target.position.set(0, 0, 0);
    scene.add(spot);
    scene.add(spot.target);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.45;
    floor.receiveShadow = true;
    scene.add(floor);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe72526, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
    [{ r1: 1.5, r2: 2.2 }, { r1: 3.0, r2: 3.8 }].forEach(({ r1, r2 }) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r1, r2, 64), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.43;
      scene.add(ring);
    });

    // Particles
    const count = 300;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 10;
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 2] = Math.sin(theta) * r;
      const t = Math.random();
      col[i * 3] = 0.8 + t * 0.2;
      col[i * 3 + 1] = 0.1;
      col[i * 3 + 2] = 0.1;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const particles = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 0.03, vertexColors: true, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    scene.add(particles);

    let wheels: THREE.Object3D[] = [];
    let autoRotate = true;
    let mouseX = 0;
    let rotateTimeout: ReturnType<typeof setTimeout>;

    // Load Ferrari model
    (async () => {
      try {
        const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/loaders/DRACOLoader.js'),
        ]);

        const draco = new DRACOLoader();
        draco.setDecoderPath('/draco/');
        const loader = new GLTFLoader();
        loader.setDRACOLoader(draco);

        const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
          loader.load('/models/ferrari.glb', resolve, undefined, reject);
        });

        const carModel = gltf.scene.children[0] as THREE.Object3D || gltf.scene;

        const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xe72526, metalness: 1.0, roughness: 0.5, clearcoat: 1.0, clearcoatRoughness: 0.03 });
        const detailsMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.5 });
        const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0, transmission: 1.0 });

        const setMat = (name: string, mat: THREE.Material) => {
          const obj = (carModel as THREE.Group).getObjectByName(name);
          if (obj && (obj as THREE.Mesh).material !== undefined) (obj as THREE.Mesh).material = mat;
        };

        setMat('body', bodyMat);
        ['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl', 'trim'].forEach((n) => setMat(n, detailsMat));
        setMat('glass', glassMat);

        wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']
          .map((n) => (carModel as THREE.Group).getObjectByName(n))
          .filter(Boolean) as THREE.Object3D[];

        try {
          const tex = await new Promise<THREE.Texture>((res, rej) =>
            new THREE.TextureLoader().load('/models/ferrari_ao.png', res, undefined, rej)
          );
          const shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
            new THREE.MeshBasicMaterial({ map: tex, blending: THREE.MultiplyBlending, toneMapped: false, transparent: true, premultipliedAlpha: true })
          );
          shadow.rotation.x = -Math.PI / 2;
          shadow.renderOrder = 2;
          (carModel as THREE.Group).add(shadow);
        } catch {}

        (carModel as THREE.Object3D).position.set(0, -0.05, 0);
        (carModel as THREE.Object3D).scale.set(0.85, 0.85, 0.85);
        (carModel as THREE.Object3D).rotation.y = -0.5;
        carModel.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        scene.add(carModel);
      } catch (e) {
        console.warn('Ferrari model failed, using procedural car:', e);
      }
    })();

    // Mouse interaction
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      autoRotate = false;
      clearTimeout(rotateTimeout);
      rotateTimeout = setTimeout(() => { autoRotate = true; }, 3000);
    };

    const onClick = () => {
      initAudio();
      playStartupSound();
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('click', onClick);

    // Animation loop
    let frameId: number;
    let t = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.01;
      particles.rotation.y += 0.0005;

      if (autoRotate) {
        camera.position.x = Math.sin(t * 0.2) * 5.5;
        camera.position.z = Math.cos(t * 0.2) * 5.5;
      } else {
        camera.position.x += (mouseX * 5.5 - camera.position.x) * 0.05;
      }
      camera.lookAt(0, 0.3, 0);

      const speed = 0.03;
      wheels.forEach((w) => { w.rotation.x += speed; });

      setRPM(Math.abs(Math.sin(t * 0.5)) * 0.3);
      renderer.render(scene, camera);
    };

    animate();

    // Resize
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(rotateTimeout);
      ro.disconnect();
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('click', onClick);
      stopEngine();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-pointer"
      title="Click to start engine"
    />
  );
}
