import * as THREE from 'three';

/**
 * Daytime environment — ground plane + marina water.
 * Circuit bounds: x ∈ [-988, 988], z ∈ [-560, 530]
 */
export function createEnvironment(scene) {

  // ── Ground (grass/tarmac apron) ───────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(6000, 6000);
  groundGeo.rotateX(-Math.PI / 2);
  scene.add(new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 1, metalness: 0 }),
  ));

  // ── Marina Bay water ──────────────────────────────────────────
  const waterGeo = new THREE.PlaneGeometry(2000, 500);
  waterGeo.rotateX(-Math.PI / 2);
  const wm = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
    color: 0x1a6688, roughness: 0.1, metalness: 0.6,
  }));
  wm.position.set(100, -0.5, 850);
  scene.add(wm);
}
