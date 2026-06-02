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
  scene.background = new THREE.Color(0x87ceeb);   // sky blue
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.0003);

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
    0.3,   // strength — subtle in daylight
    0.4,   // radius
    0.6,   // threshold — only very bright emissives bloom
  );
  composer.addPass(bloom);

  // --- Lighting (daytime) ---
  // Bright ambient — fills all shadows
  scene.add(new THREE.AmbientLight(0xffffff, 2.5));

  // Hemisphere — warm sky above, green-grey ground below
  scene.add(new THREE.HemisphereLight(0x87ceeb, 0x556644, 1.2));

  // Directional sunlight — strong, from upper-left
  const sun = new THREE.DirectionalLight(0xfffbe8, 2.0);
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
