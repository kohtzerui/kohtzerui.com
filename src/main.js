import * as THREE from 'three';
import { createScene }       from './three/scene.js';
import { createTrack }       from './three/track.js';
import { createCar }         from './three/car.js';
import { createEnvironment } from './three/environment.js';
import { Minimap }           from './three/minimap.js';
import { createExploreObjects, updateExploreObjects } from './three/objects.js';
import { StorySystem }       from './game/story.js';
import { HUD }               from './game/hud.js';
import { TRACK_WIDTH }       from './game/circuit.js';

// ─────────────────────────────────────────────────────────────────
// Scene init
// ─────────────────────────────────────────────────────────────────
const { scene, camera, renderer, composer } = createScene();
const { curve } = createTrack(scene);
createEnvironment(scene);
const car          = createCar(scene);
const minimap      = new Minimap('minimap-canvas');
const story        = new StorySystem(curve);
const hud          = new HUD();
const exploreObjs  = createExploreObjects(scene);

// ─────────────────────────────────────────────────────────────────
// Car spawn
// ─────────────────────────────────────────────────────────────────
const startPos = curve.getPoint(0);
const startTan = curve.getTangent(0).normalize();
car.position.copy(startPos);

// ─────────────────────────────────────────────────────────────────
// Physics
// ─────────────────────────────────────────────────────────────────
const _UP      = new THREE.Vector3(0, 1, 0);
const _FWD_REF = new THREE.Vector3(1, 0, 0);

const carState = {
  speed:   0,
  forward: startTan.clone(),
  lean:    0,
};

const PHY = {
  accel:       33,   // units/s² (1.5× previous)
  brake:       27,   // gentle brake (S / ↓)
  hardBrake:   42,   // firm brake (Space)
  friction:    8,    // passive drag
  maxSpeed:    64,   // units/s ≈ 230 km/h
  turnRate:   1.8,   // rad/s
  turnFric:    5,
};

let turnInput = 0;

// ─────────────────────────────────────────────────────────────────
// Track barrier — pre-sample 800 points for fast nearest lookup
// ─────────────────────────────────────────────────────────────────
const BARRIER_N  = 2000;
const _bPts      = [];
const _bTans     = [];
const _halfTrack = TRACK_WIDTH / 2;

for (let i = 0; i < BARRIER_N; i++) {
  const t = i / BARRIER_N;
  _bPts.push(curve.getPoint(t));
  _bTans.push(curve.getTangent(t).normalize());
}

const _sideVec = new THREE.Vector3();
const _offVec  = new THREE.Vector3();

function clampToTrack() {
  let minD2 = Infinity;
  let bestI = 0;
  const cx = car.position.x, cz = car.position.z;

  for (let i = 0; i < BARRIER_N; i++) {
    const dx = cx - _bPts[i].x;
    const dz = cz - _bPts[i].z;
    const d2 = dx * dx + dz * dz;
    if (d2 < minD2) { minD2 = d2; bestI = i; }
  }

  _sideVec.crossVectors(_bTans[bestI], _UP).normalize();
  _offVec.subVectors(car.position, _bPts[bestI]);
  const dist    = _offVec.dot(_sideVec);
  const absDist = Math.abs(dist);
  const KERB_W   = 4;
  const GRAVEL_W = 4;                        // same width as kerb
  const kerbEdge   = _halfTrack + KERB_W;    // 15 — outer edge of kerb
  const gravelEdge = _halfTrack + GRAVEL_W * 2; // 19 — outer edge of gravel = hard wall


  if (absDist > gravelEdge) {
    // Hard wall
    const excess = absDist - gravelEdge;
    car.position.addScaledVector(_sideVec, -Math.sign(dist) * excess);
    carState.speed *= 0.3;
  } else if (absDist > kerbEdge) {
    // Gravel — significant drag
    carState.speed *= 0.97;
  } else if (absDist > _halfTrack) {
    // Kerb — very slight drag
    carState.speed *= 0.997;
  }
}


// ─────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ─────────────────────────────────────────────────────────────────
// Camera
// ─────────────────────────────────────────────────────────────────
const camTarget = new THREE.Vector3();

function updateCamera(delta) {
  const back  = carState.forward.clone().negate().multiplyScalar(25);
  const ideal = car.position.clone().add(back).add(new THREE.Vector3(0, 12, 0));
  camera.position.lerp(ideal, Math.min(1, 5 * delta));
  camTarget.lerp(
    car.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
    Math.min(1, 8 * delta),
  );
  camera.lookAt(camTarget);
}

// ─────────────────────────────────────────────────────────────────
// Lap restart
// ─────────────────────────────────────────────────────────────────
window.addEventListener('lap-restart', () => {
  car.position.copy(startPos);
  carState.forward.copy(startTan);
  carState.speed = 0;
  carState.lean  = 0;
  turnInput = 0;
  if (gameMode === 'race') hud.start();
});

// ─────────────────────────────────────────────────────────────────
// Explore panel — E key toggles info for nearest HPC object
// ─────────────────────────────────────────────────────────────────
const explorePanel      = document.getElementById('explore-panel');
const explorePanelTitle = document.getElementById('explore-panel-title');
const explorePanelBody  = document.getElementById('explore-panel-body');
const explorePanelTags  = document.getElementById('explore-panel-tags');
const explorePanelTag   = document.getElementById('explore-panel-tag');
let   explorePanelOpen  = false;
let   currentNearObj    = null;

document.addEventListener('keydown', e => {
  if (e.code !== 'KeyE' || gameMode !== 'explore') return;
  if (explorePanelOpen) {
    explorePanel.classList.add('hidden');
    explorePanelOpen = false;
  } else if (currentNearObj) {
    explorePanelTag.textContent   = currentNearObj.label;
    explorePanelTitle.textContent = currentNearObj.title;
    explorePanelBody.textContent  = currentNearObj.body;
    explorePanelTags.innerHTML = currentNearObj.tags
      .map(t => `<span class="tag">${t}</span>`).join('');
    explorePanel.classList.remove('hidden');
    explorePanelOpen = true;
  }
});

// ─────────────────────────────────────────────────────────────────
// Start screen
// ─────────────────────────────────────────────────────────────────
let gameStarted = false;
let gameMode    = 'race'; // 'race' | 'explore'

const startScreen    = document.getElementById('start-screen');
const startRaceBtn   = document.getElementById('start-race-btn');
const startExploreBtn= document.getElementById('start-explore-btn');
const rLights        = Array.from(document.querySelectorAll('.r-light'));

// Orbit centre ≈ centroid of the 37 waypoints
const orbitCenter = new THREE.Vector3(-50, 0, -50);

function launchGame(mode) {
  gameMode = mode;
  startRaceBtn.disabled = startExploreBtn.disabled = true;

  if (mode === 'explore') {
    // Explore: skip race lights, go straight in — same top speed as race
    startScreen.style.opacity = '0';
    setTimeout(() => {
      startScreen.style.display = 'none';
      gameStarted = true;
      if (mode === 'race') hud.start();
    }, 600);
    return;
  }

  // Race: full F1 light sequence
  startRaceBtn.textContent = 'LIGHTS ON…';
  let lit = 0;
  const litInterval = setInterval(() => {
    if (lit < rLights.length) {
      rLights[lit++].classList.add('on');
    } else {
      clearInterval(litInterval);
      setTimeout(() => {
        rLights.forEach(l => l.classList.remove('on'));
        setTimeout(() => {
          startScreen.style.opacity = '0';
          setTimeout(() => {
            startScreen.style.display = 'none';
            gameStarted = true;
            hud.start();
          }, 900);
        }, 350);
      }, 750);
    }
  }, 420);
}

startRaceBtn.addEventListener('click',    () => launchGame('race'));
startExploreBtn.addEventListener('click', () => launchGame('explore'));

// ─────────────────────────────────────────────────────────────────
// Game loop
// ─────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  if (!gameStarted) {
    const t = clock.getElapsedTime() * 0.03;
    camera.position.set(
      orbitCenter.x + Math.cos(t) * 900,
      200,
      orbitCenter.z + Math.sin(t) * 900,
    );
    camera.lookAt(orbitCenter);
    composer.render();
    return;
  }

  if (!story.isBlocking()) {
    const w     = keys['KeyW'] || keys['ArrowUp'];
    const s     = keys['KeyS'] || keys['ArrowDown'];
    const a     = keys['KeyA'] || keys['ArrowLeft'];
    const d     = keys['KeyD'] || keys['ArrowRight'];
    const brake = keys['Space'] || keys['KeyB'];  // hard brake

    // ── Throttle / brake ─────────────────────────────────────────
    if (brake) {
      // Hard brake — car decelerates rapidly regardless of direction
      const sign  = Math.sign(carState.speed);
      const decay = PHY.hardBrake * delta;
      carState.speed = Math.abs(carState.speed) > decay
        ? carState.speed - sign * decay
        : 0;
    } else if (w) {
      carState.speed = Math.min(carState.speed + PHY.accel * delta, PHY.maxSpeed);
    } else if (s) {
      carState.speed = Math.max(carState.speed - PHY.brake * delta, -PHY.maxSpeed * 0.25);
    } else {
      // Passive friction
      const sign  = Math.sign(carState.speed);
      const decay = PHY.friction * delta;
      carState.speed = Math.abs(carState.speed) > decay
        ? carState.speed - sign * decay
        : 0;
    }

    // ── Steering ─────────────────────────────────────────────────
    const speedFactor = Math.min(Math.abs(carState.speed) / PHY.maxSpeed, 1);
    const targetTurn  = a ? 1 : d ? -1 : 0;
    turnInput += (targetTurn - turnInput) * Math.min(1, PHY.turnFric * delta);

    if (Math.abs(carState.speed) > 0.6) {
      const angle = turnInput * PHY.turnRate * speedFactor * delta;
      carState.forward.applyAxisAngle(_UP, angle).normalize();
    }

    // ── Move ─────────────────────────────────────────────────────
    car.position.addScaledVector(carState.forward, carState.speed * delta);
    car.position.y = 0;

    // ── Barrier collision (race mode only) ───────────────────────
    if (gameMode === 'race') clampToTrack();

    // ── Orient car ───────────────────────────────────────────────
    car.quaternion.setFromUnitVectors(_FWD_REF, carState.forward);
    carState.lean += (-turnInput * 0.05 * speedFactor - carState.lean) * Math.min(1, 8 * delta);
    car.rotateZ(carState.lean);

    updateCamera(delta);
    hud.update(carState.speed, PHY.maxSpeed);
    minimap.draw(car.position);

    if (gameMode === 'race') {
      story.update(car.position);
    } else {
      // Explore mode: update object glow + track nearest
      currentNearObj = updateExploreObjects(exploreObjs, car.position);
      // Show a hint when close to an object but panel not open
      if (currentNearObj && !explorePanelOpen) {
        explorePanelTag.textContent = currentNearObj.label + ' — [ E ] to inspect';
        explorePanel.classList.remove('hidden');
      } else if (!currentNearObj && !explorePanelOpen) {
        explorePanel.classList.add('hidden');
      }
    }
  }

  composer.render();
}

animate();
