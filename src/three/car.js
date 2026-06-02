import * as THREE from 'three';

/**
 * Builds the F1 car entirely from Three.js primitives.
 * The car's visual forward direction is +X.
 * Returns the root THREE.Group added to the scene.
 */
export function createCar(scene) {
  const car = new THREE.Group();

  // ── Materials ──────────────────────────────────────────────────
  const cyan = new THREE.MeshStandardMaterial({
    color: 0x00ccaa, metalness: 0.6, roughness: 0.3,
    emissive: 0x00ffcc, emissiveIntensity: 0.18,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x15152a, metalness: 0.5, roughness: 0.5,
    emissive: 0x111122, emissiveIntensity: 0.1,
  });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.9 });
  const rimMat  = new THREE.MeshStandardMaterial({ color: 0x4a4a5a, metalness: 0.85, roughness: 0.2 });

  function box(w, h, d, mat, px, py, pz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    car.add(m);
    return m;
  }

  // ── Chassis / body ─────────────────────────────────────────────
  box(3.6, 0.30, 1.05, cyan,    0.10, 0.34,  0);       // main body
  box(2.0, 0.22, 0.32, cyan,    0.10, 0.28,  0.55);    // left sidepod
  box(2.0, 0.22, 0.32, cyan,    0.10, 0.28, -0.55);    // right sidepod
  box(1.0, 0.38, 0.82, darkMat, 0.20, 0.68,  0);       // cockpit

  // Nose cone (tapered cylinder, rotated)
  const noseGeo = new THREE.CylinderGeometry(0.07, 0.42, 1.45, 7);
  noseGeo.rotateZ(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, cyan);
  nose.position.set(2.48, 0.27, 0);
  car.add(nose);

  // ── Wings ──────────────────────────────────────────────────────
  box(0.1, 0.06, 1.75, cyan, 3.10, 0.17, 0);           // Front wing main
  [-0.87, 0.87].forEach(z => box(0.42, 0.18, 0.06, cyan, 3.0, 0.23, z));

  box(0.1, 0.06, 1.55, cyan, -1.75, 0.88, 0);          // Rear wing
  [-0.77, 0.77].forEach(z => box(0.14, 0.48, 0.06, cyan, -1.75, 0.64, z));

  // ── Wheels ─────────────────────────────────────────────────────
  const wheels = [
    { x:  1.65, z:  0.77, r: 0.37, w: 0.27 },
    { x:  1.65, z: -0.77, r: 0.37, w: 0.27 },
    { x: -1.45, z:  0.86, r: 0.41, w: 0.31 },
    { x: -1.45, z: -0.86, r: 0.41, w: 0.31 },
  ];

  wheels.forEach(w => {
    const tyreGeo = new THREE.CylinderGeometry(w.r, w.r, w.w, 18);
    tyreGeo.rotateX(Math.PI / 2);
    const tyre = new THREE.Mesh(tyreGeo, tyreMat);
    tyre.position.set(w.x, w.r, w.z);
    car.add(tyre);

    const rimGeo = new THREE.CylinderGeometry(w.r * 0.58, w.r * 0.58, w.w + 0.02, 14);
    rimGeo.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(w.x, w.r, w.z);
    car.add(rim);
  });

  // ── Underglow (bloom target) — wider range for visibility ─────
  const underglow = new THREE.PointLight(0x00ffcc, 4, 14);
  underglow.position.set(0, 0.05, 0);
  car.add(underglow);

  // ── Rear glow ──────────────────────────────────────────────────
  const rearGlow = new THREE.PointLight(0xff2200, 1.5, 8);
  rearGlow.position.set(-2.2, 0.4, 0);
  car.add(rearGlow);

  // ── Headlights ─────────────────────────────────────────────────
  const hl = new THREE.SpotLight(0xaaffee, 5, 45, Math.PI / 6.5, 0.5);
  hl.position.set(3.3, 0.45, 0);
  hl.target.position.set(15, 0, 0);
  car.add(hl);
  car.add(hl.target);

  scene.add(car);
  return car;
}
