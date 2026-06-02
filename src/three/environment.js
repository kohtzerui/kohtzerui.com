import * as THREE from 'three';

/**
 * Singapore night scene environment.
 * Circuit bounds: x ∈ [-988, 988], z ∈ [-560, 530]
 * Centre ≈ (-50, 0, -50)
 */
export function createEnvironment(scene) {

  // ── Ground ────────────────────────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(4000, 4000);
  groundGeo.rotateX(-Math.PI / 2);
  scene.add(new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: 0x080812, roughness: 1, metalness: 0 }),
  ));

  // ── CBD Skyline (south of circuit, z > 650) ───────────────────
  const towers = [
    { x: -200, z: 750, w: 30, h: 140, d: 30 },
    { x:  -50, z: 780, w: 20, h:  95, d: 20 },
    { x:  100, z: 760, w: 40, h: 180, d: 30 },
    { x:  250, z: 790, w: 22, h: 110, d: 22 },
    { x:  400, z: 750, w: 32, h: 150, d: 26 },
    { x:  550, z: 780, w: 18, h:  85, d: 18 },
    { x:  700, z: 760, w: 24, h: 120, d: 24 },
    { x: -400, z: 780, w: 20, h:  88, d: 20 },
    { x:  850, z: 770, w: 18, h:  75, d: 18 },

    // East (x > 1100)
    { x: 1150, z: -60, w: 20, h: 100, d: 20 },
    { x: 1180, z:-120, w: 26, h: 130, d: 26 },
    { x: 1130, z:  50, w: 16, h:  65, d: 16 },

    // West (x < -1100)
    { x:-1150, z: -60, w: 18, h:  72, d: 18 },
    { x:-1180, z:  20, w: 22, h:  95, d: 22 },
    { x:-1130, z:-100, w: 14, h:  55, d: 14 },

    // North (z < -700)
    { x: -100, z:-780, w: 20, h:  68, d: 20 },
    { x:  150, z:-800, w: 28, h:  90, d: 28 },
    { x:  400, z:-770, w: 18, h:  60, d: 18 },
  ];

  towers.forEach(b => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      new THREE.MeshStandardMaterial({
        color: 0x0c0c18, roughness: 0.85, metalness: 0.25,
        emissive: 0x060610, emissiveIntensity: 1,
      }),
    );
    mesh.position.set(b.x, b.h / 2, b.z);
    scene.add(mesh);

    if (Math.random() > 0.3) {
      const wl = new THREE.PointLight(0xffaa55, 0.4, 80);
      wl.position.set(b.x, b.h * 0.6, b.z + b.d / 2 + 1);
      scene.add(wl);
    }
  });

  // ── City glow ─────────────────────────────────────────────────
  const glow1 = new THREE.PointLight(0xff6622, 0.8, 800);
  glow1.position.set(100, -5, 850);
  scene.add(glow1);

  const glow2 = new THREE.PointLight(0x112244, 0.5, 600);
  glow2.position.set(-350, 20, 800);
  scene.add(glow2);

  const glow3 = new THREE.PointLight(0x441122, 0.3, 500);
  glow3.position.set(500, 15, 780);
  scene.add(glow3);

  // ── Stars ─────────────────────────────────────────────────────
  const starCount = 2500;
  const starPos   = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3]     = (Math.random() - 0.5) * 4000;
    starPos[i * 3 + 1] = Math.random() * 400 + 100;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 4000;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.6, transparent: true, opacity: 0.55,
  })));

  // ── Marina Bay water ──────────────────────────────────────────
  const waterGeo = new THREE.PlaneGeometry(2000, 500);
  waterGeo.rotateX(-Math.PI / 2);
  const wm = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
    color: 0x000a1a, roughness: 0.08, metalness: 0.9,
  }));
  wm.position.set(100, -0.5, 850);
  scene.add(wm);
}
