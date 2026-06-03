import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Initialises Three.js scene, PerspectiveCamera, WebGLRenderer,
 * and the UnrealBloom post-processing chain.
 */
export function createScene() {
  // --- Scene ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);        // black void
  scene.fog = new THREE.FogExp2(0x000000, 0.00055);   // fades to black beyond ~600 u

  // --- Camera ---
  const camera = new THREE.PerspectiveCamera(
    62,
    window.innerWidth / window.innerHeight,
    0.1,
    4000,
  );

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled   = false;
  document.getElementById('app').prepend(renderer.domElement);

  // --- Post-processing ---
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55,  // stronger — glows pop against dark background
    0.45,  // radius
    0.5,   // threshold — lower so more elements bloom
  );
  composer.addPass(bloom);

  // --- Lighting (void / night-race style) ---
  // Moderate ambient — enough to see the track surface
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));

  // Hemisphere — dark sky above, pure black below (no green bleed)
  scene.add(new THREE.HemisphereLight(0x111122, 0x000000, 0.8));

  // Directional fill light — softer than daylight
  const sun = new THREE.DirectionalLight(0xd0d8ff, 1.2);
  sun.position.set(-80, 200, -60);
  scene.add(sun);

  // --- Resize ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, composer };
}
