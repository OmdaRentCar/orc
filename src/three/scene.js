import * as THREE from 'three';

export function createScene(container) {
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

  return { scene, camera, renderer };
}

export function createLights(scene) {
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
}

export function createFloor(scene) {
  const geo = new THREE.PlaneGeometry(16, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.9 });
  const floor = new THREE.Mesh(geo, mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.45;
  floor.receiveShadow = true;
  scene.add(floor);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0xe72526, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
  const r1 = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.2, 64), ringMat);
  r1.rotation.x = -Math.PI / 2;
  r1.position.y = -0.43;
  scene.add(r1);
  const r2 = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.8, 64), ringMat);
  r2.rotation.x = -Math.PI / 2;
  r2.position.y = -0.43;
  scene.add(r2);
}

export function createParticles(scene) {
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
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({
    size: 0.03, vertexColors: true, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const p = new THREE.Points(g, m);
  scene.add(p);
  return p;
}

/* ─── PROCEDURAL SPORTS CAR (always works) ─── */
export function createCar(scene) {
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xe72526, roughness: 0.15, metalness: 0.85,
    clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.5,
  });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x88ccff, roughness: 0, metalness: 0, transparent: true, opacity: 0.2, envMapIntensity: 0.8,
  });
  const chromeMat = new THREE.MeshPhysicalMaterial({ color: 0xcccccc, roughness: 0.05, metalness: 1, envMapIntensity: 2 });
  const lightMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, emissive: 0xaaccff, emissiveIntensity: 0.5, roughness: 0, metalness: 0,
  });
  const tailMat = new THREE.MeshPhysicalMaterial({
    color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0,
  });
  const tireMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, roughness: 0.95, metalness: 0 });

  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.9, 0);
  bodyShape.quadraticCurveTo(-1.0, 0.05, -1.05, 0.15);
  bodyShape.quadraticCurveTo(-1.1, 0.3, -1.08, 0.4);
  bodyShape.quadraticCurveTo(-1.0, 0.5, -0.7, 0.5);
  bodyShape.quadraticCurveTo(-0.4, 0.5, 0, 0.48);
  bodyShape.quadraticCurveTo(0.4, 0.5, 0.7, 0.5);
  bodyShape.quadraticCurveTo(1.0, 0.5, 1.08, 0.4);
  bodyShape.quadraticCurveTo(1.1, 0.3, 1.05, 0.15);
  bodyShape.quadraticCurveTo(1.0, 0.05, 0.9, 0);
  bodyShape.quadraticCurveTo(0.5, -0.02, 0, -0.02);
  bodyShape.quadraticCurveTo(-0.5, -0.02, -0.9, 0);

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    steps: 1, depth: 4.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.04, bevelSegments: 10,
  });
  bodyGeo.translate(0, -2.1, 0);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0.25, 0);
  body.castShadow = true;
  car.add(body);

  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-0.65, 0);
  cabinShape.quadraticCurveTo(-0.7, 0.15, -0.72, 0.3);
  cabinShape.quadraticCurveTo(-0.65, 0.42, -0.3, 0.44);
  cabinShape.quadraticCurveTo(0, 0.45, 0.3, 0.44);
  cabinShape.quadraticCurveTo(0.65, 0.42, 0.72, 0.3);
  cabinShape.quadraticCurveTo(0.7, 0.15, 0.65, 0);
  cabinShape.closePath();
  const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
    depth: 1.8, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.02, bevelSegments: 8,
  });
  cabinGeo.translate(0, -0.9, 0);
  cabinGeo.rotateX(Math.PI / 2);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 0.6, -0.05);
  car.add(cabin);

  const hoodShape = new THREE.Shape();
  hoodShape.moveTo(-0.65, 0);
  hoodShape.quadraticCurveTo(-0.72, 0.03, -0.75, 0.06);
  hoodShape.lineTo(0.75, 0.06);
  hoodShape.quadraticCurveTo(0.72, 0.03, 0.65, 0);
  hoodShape.closePath();
  const hoodGeo = new THREE.ExtrudeGeometry(hoodShape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.01, bevelSegments: 4 });
  hoodGeo.translate(0, -0.35, 0);
  hoodGeo.rotateX(Math.PI / 2);
  const hood = new THREE.Mesh(hoodGeo, bodyMat);
  hood.position.set(0, 0.52, 1.5);
  car.add(hood);

  const bShape = new THREE.Shape();
  bShape.moveTo(-0.85, 0);
  bShape.quadraticCurveTo(-0.95, 0.05, -0.98, 0.15);
  bShape.quadraticCurveTo(-1.0, 0.25, -0.95, 0.32);
  bShape.quadraticCurveTo(-0.4, 0.38, 0, 0.38);
  bShape.quadraticCurveTo(0.4, 0.38, 0.95, 0.32);
  bShape.quadraticCurveTo(1.0, 0.25, 0.98, 0.15);
  bShape.quadraticCurveTo(0.95, 0.05, 0.85, 0);
  bShape.lineTo(0.85, -0.05);
  bShape.quadraticCurveTo(0.4, -0.07, 0, -0.07);
  bShape.quadraticCurveTo(-0.4, -0.07, -0.85, -0.05);
  const bGeo = new THREE.ExtrudeGeometry(bShape, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.02, bevelSegments: 6 });
  bGeo.translate(0, -0.125, 0);
  bGeo.rotateX(Math.PI / 2);
  const bumper = new THREE.Mesh(bGeo, darkMat);
  bumper.position.set(0, 0.12, 2.45);
  car.add(bumper);

  const rearBumper = bumper.clone();
  rearBumper.position.set(0, 0.12, -2.45);
  rearBumper.rotation.y = Math.PI;
  car.add(rearBumper);

  const fenderMat = new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: 0.8, metalness: 0.1 });
  const fGeo = new THREE.BoxGeometry(0.4, 0.15, 0.8);
  [-1.2, 1.2].forEach((x) => {
    const ff = new THREE.Mesh(fGeo, fenderMat);
    ff.position.set(x, 0.45, 1.5);
    car.add(ff);
    const fr = new THREE.Mesh(fGeo, fenderMat);
    fr.position.set(x, 0.45, -1.5);
    car.add(fr);
  });

  [-0.45, 0.45].forEach((x) => {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), lightMat);
    hl.position.set(x, 0.35, 2.22);
    car.add(hl);
    const hlBorder = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), chromeMat);
    hlBorder.position.copy(hl.position);
    car.add(hlBorder);
  });

  const drlMat = new THREE.MeshPhysicalMaterial({
    color: 0x88ccff, emissive: 0x4488ff, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0,
  });
  const drl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.02), drlMat);
  drl.position.set(0, 0.28, 2.25);
  car.add(drl);

  [-0.5, 0.5].forEach((x) => {
    const tl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), tailMat);
    tl.position.set(x, 0.38, -2.22);
    car.add(tl);
  });

  [-0.2, 0.2].forEach((x) => {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.12, 12), chromeMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(x, 0.1, -2.5);
    car.add(tip);
  });

  const spoilerMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.6 });
  const spWing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.25), spoilerMat);
  spWing.position.set(0, 0.85, -1.95);
  car.add(spWing);
  [-0.45, 0.45].forEach((x) => {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.02), spoilerMat);
    st.position.set(x, 0.74, -1.95);
    car.add(st);
  });

  const grilleMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, roughness: 0.8, metalness: 0.3 });
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), grilleMat);
  grille.position.set(0, 0.22, 2.48);
  car.add(grille);
  for (let i = 0; i < 6; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.004, 0.004), chromeMat);
    slat.position.set(0, 0.15 + i * 0.022, 2.49);
    car.add(slat);
  }

  [-1.15, 1.15].forEach((x) => {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 2.6), darkMat);
    skirt.position.set(x, 0.2, 0);
    car.add(skirt);
  });

  const wheelPositions = [
    [-1.02, 0.15, 1.3], [1.02, 0.15, 1.3],
    [-1.02, 0.15, -1.3], [1.02, 0.15, -1.3],
  ];
  const wheels = [];

  wheelPositions.forEach((pos, idx) => {
    const wg = new THREE.Group();

    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.11, 16, 20), tireMat);
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    wg.add(tire);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.17, 20),
      new THREE.MeshPhysicalMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.7 })
    );
    barrel.rotation.x = Math.PI / 2;
    wg.add(barrel);

    const rimOuter = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 10, 20), chromeMat);
    rimOuter.rotation.y = Math.PI / 2;
    wg.add(rimOuter);

    const spokeMat = new THREE.MeshPhysicalMaterial({ color: 0xbbbbbb, roughness: 0.1, metalness: 0.95, envMapIntensity: 2 });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.02), spokeMat);
      spoke.position.set(Math.sin(angle) * 0.09, Math.cos(angle) * 0.09, 0);
      wg.add(spoke);
    }

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 10, 10),
      new THREE.MeshPhysicalMaterial({ color: 0xe72526, roughness: 0.2, metalness: 0.8 })
    );
    cap.position.set(0, 0, 0.03);
    wg.add(cap);

    if (idx < 2) {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.01, 20),
        new THREE.MeshPhysicalMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.8 })
      );
      disc.position.set(0, 0, -0.07);
      disc.rotation.x = Math.PI / 2;
      wg.add(disc);

      const caliper = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.035, 0.025),
        new THREE.MeshPhysicalMaterial({ color: 0xe72526, roughness: 0.3, metalness: 0.4 })
      );
      caliper.position.set(0.04, 0, -0.07);
      wg.add(caliper);
    }

    wg.position.set(pos[0], pos[1], pos[2]);
    car.add(wg);
    wheels.push(wg);
  });

  [-0.75, 0.75].forEach((x) => {
    const mg = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.06), bodyMat);
    arm.position.set(0, 0.02, 0);
    mg.add(arm);
    const mh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), bodyMat);
    mh.position.set(0, 0.02, 0.06);
    mg.add(mh);
    mg.position.set(x * 0.95, 0.58, 0.55);
    mg.rotation.y = x > 0 ? 0.3 : -0.3;
    car.add(mg);
  });

  car.position.y = 0;
  scene.add(car);
  return { group: car, wheels };
}

/* ─── FERRARI 458 ITALIA (real GLTF model) ─── */
const FERRARI_URL = '/models/ferrari.glb';
const FERRARI_AO_URL = '/models/ferrari_ao.png';
const DRACO_URL = '/draco/';

export async function tryLoadFerrari(scene, onStatus) {
  try {
    if (onStatus) onStatus('Loading Ferrari 458...');

    const [GLTFLoaderMod, DRACOLoaderMod] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
    ]);

    const GLTF = GLTFLoaderMod.GLTFLoader || GLTFLoaderMod.default;
    const Drac = DRACOLoaderMod.DRACOLoader || DRACOLoaderMod.default;

    const draco = new Drac();
    draco.setDecoderPath(DRACO_URL);

    const loader = new GLTF();
    loader.setDRACOLoader(draco);

    const gltf = await new Promise((resolve, reject) => {
      loader.load(FERRARI_URL, resolve, (xhr) => {
        const total = xhr.total || 1;
        const pct = Math.round((xhr.loaded / total) * 100);
        if (onStatus && pct % 25 === 0) onStatus(`Ferrari 458... ${pct}%`);
      }, reject);
    });

    const carModel = gltf.scene.children[0] || gltf.scene;
    const names = [];
    carModel.traverse(c => { if (c.name) names.push(c.name); });
    console.log(`Ferrari loaded ✓ parts:`, names.join(', '));

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xe72526, metalness: 1.0, roughness: 0.5,
      clearcoat: 1.0, clearcoatRoughness: 0.03,
    });
    const detailsMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc, metalness: 1.0, roughness: 0.5,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0.25, roughness: 0, transmission: 1.0,
    });

    const setMat = (name, mat) => {
      const obj = carModel.getObjectByName(name);
      if (obj) obj.material = mat;
    };

    setMat('body', bodyMat);
    ['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl'].forEach(n => setMat(n, detailsMat));
    setMat('trim', detailsMat);
    setMat('glass', glassMat);

    const wheels = [];
    ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].forEach((n) => {
      const w = carModel.getObjectByName(n);
      if (w) wheels.push(w);
    });

    try {
      const tex = await new Promise((res, rej) => {
        new THREE.TextureLoader().load(FERRARI_AO_URL, res, undefined, rej);
      });
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
        new THREE.MeshBasicMaterial({
          map: tex, blending: THREE.MultiplyBlending,
          toneMapped: false, transparent: true, premultipliedAlpha: true,
        })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.renderOrder = 2;
      carModel.add(shadow);
    } catch (e) { console.warn('Shadow not loaded:', e); }

    carModel.position.set(0, -0.05, 0);
    carModel.scale.set(0.85, 0.85, 0.85);
    carModel.rotation.y = -0.5;
    carModel.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(carModel);

    if (onStatus) onStatus('✓ Ferrari 458 ready');
    setTimeout(() => { if (onStatus) onStatus(''); }, 1500);
    return { model: carModel, wheels };
  } catch (e) {
    console.warn('Ferrari model failed:', e);
    if (onStatus) onStatus('');
    return null;
  }
}
