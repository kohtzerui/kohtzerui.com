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
  scene.background = new THREE.Color(0x020210);
  scene.fog = new THREE.FogExp2(0x020210, 0.0005);

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
    0.85,  // strength (was 1.1 — less aggressive)
    0.4,   // radius
    0.15,  // threshold
  );
  composer.addPass(bloom);

  // --- Lighting ---
  // Ambient — bright enough to see track surface
  scene.add(new THREE.AmbientLight(0x445566, 2.0));

  // Hemisphere — subtle sky/ground separation
  scene.add(new THREE.HemisphereLight(0x223355, 0x0a0a12, 0.6));

  // Directional "moonlight" — soft fill from above
  const moon = new THREE.DirectionalLight(0x8899bb, 0.4);
  moon.position.set(40, 80, -30);
  scene.add(moon);

  // --- Resize ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, composer };
}
