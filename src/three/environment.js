import * as THREE from 'three';

/**
 * Daytime environment — ground plane + marina water.
 * Circuit bounds: x ∈ [-988, 988], z ∈ [-560, 530]
 */
export function createEnvironment(scene) {

  // ── Ground — near-black to blend into the void beyond the fence ──
  const groundGeo = new THREE.PlaneGeometry(6000, 6000);
  groundGeo.rotateX(-Math.PI / 2);
  scene.add(new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1, metalness: 0 }),
  ));
}
