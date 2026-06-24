import * as THREE from 'three';
import { createScene }       from './three/scene.js';
import { createTrack }       from './three/track.js';
import { createCar }         from './three/car.js';
import { createEnvironment } from './three/environment.js';
import { Minimap }           from './three/minimap.js';
import { createExploreObjects, updateExploreObjects, createPortfolioStations } from './three/objects.js';
import { StorySystem }       from './game/story.js';
import { HUD }               from './game/hud.js';
import { GhostRecorder, GhostPlayer } from './game/ghost.js';
import { CarAudio }          from './game/audio.js';
import { TRACK_WIDTH }       from './game/circuit.js';


// ─────────────────────────────────────────────────────────────────
// Scene init
// ─────────────────────────────────────────────────────────────────
const { scene, camera, renderer, composer } = createScene();
const { curve } = createTrack(scene);
createEnvironment(scene);
// Heavy decorative scenery is added after the first playable render.
// createBillboards(scene);  // disabled - too visually noisy
// createGantry(scene);      // disabled - too visually noisy
const car          = createCar(scene);
const minimap      = new Minimap('minimap-canvas');
const story        = new StorySystem(curve);
const hud          = new HUD();
const audio        = new CarAudio();
const exploreObjs  = createExploreObjects(scene);
const ghostRec     = new GhostRecorder();  // dev-only recorder (?record=1)
const ghostPlay    = new GhostPlayer(scene);
const ghostLoadPromise = ghostPlay.load();  // async - required for the cinematic ghost lap
let sceneryLoaded = false;
function scheduleSceneryLoad() {
  if (sceneryLoaded) return;
  const load = () => {
    if (sceneryLoaded) return;
    sceneryLoaded = true;
    createPortfolioStations(scene);
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(load, { timeout: 3500 });
  } else {
    setTimeout(load, 1200);
  }
}



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

let currentSurface = 'track';
const SURFACE_TUNING = {
  track:  { accel: 1.0, max: 1.0, friction: 1.0 },
  kerb:   { accel: 0.82, max: 0.92, friction: 1.35 },
  runoff: { accel: 0.38, max: 0.48, friction: 3.0 },
  wall:   { accel: 0.25, max: 0.28, friction: 4.0 },
};

function getSurfaceTuning() {
  return SURFACE_TUNING[currentSurface] || SURFACE_TUNING.track;
}
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

// Track progress exposed from clampToTrack (0-1 around circuit)
let carTrackProgress = 0;

function clampToTrack(delta = 1 / 60) {
  let minD2 = Infinity;
  let bestI = 0;
  const cx = car.position.x, cz = car.position.z;

  for (let i = 0; i < BARRIER_N; i++) {
    const dx = cx - _bPts[i].x;
    const dz = cz - _bPts[i].z;
    const d2 = dx * dx + dz * dz;
    if (d2 < minD2) { minD2 = d2; bestI = i; }
  }

  carTrackProgress = bestI / BARRIER_N;

  _sideVec.crossVectors(_bTans[bestI], _UP).normalize();
  _offVec.subVectors(car.position, _bPts[bestI]);
  const dist    = _offVec.dot(_sideVec);
  const absDist = Math.abs(dist);
  const KERB_W   = 4;
  const RUNOFF_W = 4;
  const kerbEdge   = _halfTrack + KERB_W;
  const runoffEdge = _halfTrack + KERB_W + RUNOFF_W;

  if (absDist > runoffEdge) {
    const excess = absDist - runoffEdge;
    car.position.addScaledVector(_sideVec, -Math.sign(dist) * excess);
    carState.speed *= 0.22;
    return 'wall';
  }

  if (absDist > kerbEdge) {
    carState.speed *= Math.pow(0.18, delta);
    return 'runoff';
  }

  if (absDist > _halfTrack) {
    carState.speed *= Math.pow(0.78, delta);
    return 'kerb';
  }

  return 'track';
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

function updateCameraForGhost(delta) {
  if (!ghostPlay.mesh || !ghostPlay.mesh.visible) return;
  const gPos = ghostPlay.mesh.position;
  const gFwd = ghostPlay.getForward() || new THREE.Vector3(1, 0, 0);
  const back  = gFwd.clone().negate().multiplyScalar(25);
  const ideal = gPos.clone().add(back).add(new THREE.Vector3(0, 12, 0));
  camera.position.lerp(ideal, Math.min(1, 5 * delta));
  camTarget.lerp(gPos.clone().add(new THREE.Vector3(0, 1.5, 0)), Math.min(1, 8 * delta));
  camera.lookAt(camTarget);
}

// ─────────────────────────────────────────────────────────────────
// Game loop
// ─────────────────────────────────────────────────────────────────

let lapElapsed = 0;
let lapStartMs = 0;
let lapNumber  = 0;  // 0 = not started, 1+ = timed player laps

// When the finish line is crossed, finalise ghost recording and show result
window.addEventListener('lap-complete', () => {
  if (gameMode !== 'race') return;
  audio.stop();  // kill engine/squeal the moment we cross the line
  const lapMs = performance.now() - lapStartMs;
  // Offer ghost download if in record mode
  ghostRec.finish(lapMs);
  // Show lap time in HUD
  if (lapNumber >= 1) {
    const ghostMs = ghostPlay.getGhostLapMs();
    const delta   = ghostMs !== null ? lapMs - ghostMs : null;
    hud.showLapResult(lapMs, delta < 0, delta);
  }
});

window.addEventListener('lap-restart', () => {
  car.position.copy(startPos);
  carState.forward.copy(startTan);
  carState.speed = 0;
  carState.lean  = 0;
  turnInput      = 0;
  lapElapsed     = 0;
  lapStartMs     = performance.now();
  lapNumber++;
  audio.update(0, PHY.maxSpeed, 0);  // reset to silent idle so it ramps back up naturally

  console.log(`[lap-restart] lap=${lapNumber}, hasGhost=${ghostPlay.hasGhost()}, frames=${ghostPlay.frames.length}`);

  if (gameMode === 'race') {
    hud.start();
    ghostRec.start();

    if (lapNumber > 1 && ghostPlay.hasGhost()) {
      console.log('[lap-restart] Starting ghost playback');
      ghostPlay.start();
    } else {
      ghostPlay.stop();
    }
  }
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
let gamePhase   = 'idle'; // 'idle' | 'cinematic' | 'ready' | 'racing' | 'explore'
let ghostFinishHandled = false;

const startScreen     = document.getElementById('start-screen');
const startRaceBtn    = document.getElementById('start-race-btn');
const startExploreBtn = document.getElementById('start-explore-btn');
const loadingStatus   = document.getElementById('loading-status');
const rLights         = Array.from(document.querySelectorAll('.r-light'));

function setStartReady() {
  startRaceBtn.disabled = false;
  startExploreBtn.disabled = false;
  if (loadingStatus) {
    loadingStatus.textContent = ghostPlay.hasGhost()
      ? 'CIRCUIT READY - GHOST ONLINE'
      : 'CIRCUIT READY - SOLO MODE';
    loadingStatus.classList.add('ready');
  }
  scheduleSceneryLoad();
}

async function prepareStartScreen() {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await ghostLoadPromise.catch(() => false);
  setStartReady();
}
prepareStartScreen();

// Orbit centre ≈ centroid of the 37 waypoints
const orbitCenter = new THREE.Vector3(-50, 0, -50);

function launchGame(mode) {
  if (startRaceBtn.disabled || startExploreBtn.disabled) return;
  gameMode = mode;
  startRaceBtn.disabled = startExploreBtn.disabled = true;
  audio.start();  // must start AudioContext on a user gesture

  if (mode === 'explore') {
    startScreen.style.opacity = '0';
    setTimeout(() => {
      startScreen.style.display = 'none';
      gameStarted = true;
      gamePhase   = 'explore';
    }, 600);
    return;
  }

  // Race: full F1 light sequence
  startRaceBtn.textContent = 'LIGHTS ON...';
  if (loadingStatus) {
    loadingStatus.textContent = 'HOLD UP ARROW OR W FOR LAUNCH';
    loadingStatus.classList.add('ready');
  }
  let lit = 0;
  const litInterval = setInterval(() => {
    if (lit < rLights.length) {
      rLights[lit++].classList.add('on');
      audio.playLightBeep();           // beep for each red light
    } else {
      clearInterval(litInterval);
      setTimeout(() => {
        rLights.forEach(l => l.classList.remove('on'));
        audio.playLightsOut();         // GO! — burst + engine swell
        setTimeout(() => {
          startScreen.style.opacity = '0';
          setTimeout(() => {
            startScreen.style.display = 'none';
            gameStarted = true;
            ghostFinishHandled = false;
            startRacingLap();
          }, 900);
        }, 350);
      }, 750);
    }
  }, 1000);
}



startRaceBtn.addEventListener('click',    () => launchGame('race'));
startExploreBtn.addEventListener('click', () => launchGame('explore'));

// ─────────────────────────────────────────────────────────────────
// Cinematic → Ready screen → Racing
// ─────────────────────────────────────────────────────────────────
const readyScreen  = document.getElementById('ready-screen');
const readyLapTime = document.getElementById('ready-lap-time');
const readyBtn     = document.getElementById('ready-btn');

/** Show after the cinematic lap: ghost time + contact links. */
function showReadyScreen() {
  const ms = ghostPlay.getGhostLapMs();
  if (ms && readyLapTime) {
    const m   = Math.floor(ms / 60000);
    const s   = Math.floor((ms % 60000) / 1000);
    const mil = Math.floor(ms % 1000);
    readyLapTime.textContent = `GHOST LAP — ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(mil).padStart(3,'0')}`;
  }
  readyScreen.classList.remove('hidden');
}

function startRacingLap() {
  readyScreen.classList.add('hidden');
  gamePhase    = 'racing';
  lapNumber    = 1;
  lapElapsed   = 0;
  lapStartMs   = performance.now();
  car.visible  = true;
  car.position.copy(startPos);
  carState.forward.copy(startTan);
  carState.speed = 0;
  carState.lean  = 0;
  turnInput      = 0;
  story.reset();
  story.setNarration(false);   // voiceover only for the cinematic intro lap
  hud.start();
  ghostRec.start();
  ghostPlay.setOpacity(0.6);   // semi-transparent while racing
  ghostPlay.start();            // replay ghost from beginning
}

if (readyBtn) readyBtn.addEventListener('click', startRacingLap);

// ─────────────────────────────────────────────────────────────────
// Camera helpers
// ─────────────────────────────────────────────────────────────────

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  // ── Pre-game orbit ───────────────────────────────────────────────
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

  // ── Cinematic: ghost drives, camera follows ──────────────────────
  if (gamePhase === 'cinematic') {
    lapElapsed = (performance.now() - lapStartMs) / 1000;
    ghostPlay.update(lapElapsed, null);
    updateCameraForGhost(delta);
    if (ghostPlay.mesh?.position) story.update(ghostPlay.mesh.position, false); // cinematic: narration only, no finish trigger
    minimap.draw(ghostPlay.mesh?.position || startPos);

    // Detect ghost lap end → show ready screen
    if (!ghostFinishHandled && ghostPlay.isFinished()) {
      ghostFinishHandled = true;
      gamePhase = 'ready';
      showReadyScreen();
    }
    composer.render();
    return;
  }

  // ── Ready screen — just keep rendering, no input ─────────────────
  if (gamePhase === 'ready') {
    composer.render();
    return;
  }

  // ── Explore mode ─────────────────────────────────────────────────
  if (gamePhase === 'explore') {
    if (!story.isBlocking()) {
      const w = keys['KeyW'] || keys['ArrowUp'];
      const s = keys['KeyS'] || keys['ArrowDown'];
      const a = keys['KeyA'] || keys['ArrowLeft'];
      const d = keys['KeyD'] || keys['ArrowRight'];
      const brake = keys['Space'] || keys['KeyB'];
      const surface = getSurfaceTuning();
      if (brake) { const sign = Math.sign(carState.speed); const decay = PHY.hardBrake * delta; carState.speed = Math.abs(carState.speed) > decay ? carState.speed - sign * decay : 0; }
      else if (w) carState.speed = Math.min(carState.speed + PHY.accel * surface.accel * delta, PHY.maxSpeed * surface.max);
      else if (s) carState.speed = Math.max(carState.speed - PHY.brake * surface.accel * delta, -PHY.maxSpeed * 0.25 * surface.max);
      else { const sign = Math.sign(carState.speed); const decay = PHY.friction * surface.friction * delta; carState.speed = Math.abs(carState.speed) > decay ? carState.speed - sign * decay : 0; }
      const speedFactor = Math.min(Math.abs(carState.speed) / PHY.maxSpeed, 1);
      const targetTurn  = a ? 1 : d ? -1 : 0;
      turnInput += (targetTurn - turnInput) * Math.min(1, PHY.turnFric * delta);
      if (Math.abs(carState.speed) > 0.6) carState.forward.applyAxisAngle(_UP, turnInput * PHY.turnRate * speedFactor * delta).normalize();
      car.position.addScaledVector(carState.forward, carState.speed * delta);
      car.position.y = 0;
      currentSurface = clampToTrack(delta);
      car.quaternion.setFromUnitVectors(_FWD_REF, carState.forward);
      carState.lean += (-turnInput * 0.05 * speedFactor - carState.lean) * Math.min(1, 8 * delta);
      car.rotateZ(carState.lean);
      updateCamera(delta);
      hud.update(carState.speed, PHY.maxSpeed);
      audio.update(carState.speed, PHY.maxSpeed, turnInput);
      minimap.draw(car.position);
      currentNearObj = updateExploreObjects(exploreObjs, car.position);
      if (currentNearObj && !explorePanelOpen) {
        explorePanelTag.textContent = currentNearObj.label + ' — [ E ] to inspect';
        explorePanel.classList.remove('hidden');
      } else if (!currentNearObj && !explorePanelOpen) {
        explorePanel.classList.add('hidden');
      }
    } else {
      audio.stop();  // mute while explore panel is open
    }
    composer.render();
    return;
  }

  // ── Racing: player drives vs ghost ───────────────────────────────
  if (!story.isBlocking()) {
    const w     = keys['KeyW'] || keys['ArrowUp'];
    const s     = keys['KeyS'] || keys['ArrowDown'];
    const a     = keys['KeyA'] || keys['ArrowLeft'];
    const d     = keys['KeyD'] || keys['ArrowRight'];
    const brake = keys['Space'] || keys['KeyB'];
    const surface = getSurfaceTuning();

    if (brake) {
      const sign  = Math.sign(carState.speed);
      const decay = PHY.hardBrake * delta;
      carState.speed = Math.abs(carState.speed) > decay
        ? carState.speed - sign * decay
        : 0;
    } else if (w) {
      carState.speed = Math.min(carState.speed + PHY.accel * surface.accel * delta, PHY.maxSpeed * surface.max);
    } else if (s) {
      carState.speed = Math.max(carState.speed - PHY.brake * surface.accel * delta, -PHY.maxSpeed * 0.25 * surface.max);
    } else {
      // Passive friction
      const sign  = Math.sign(carState.speed);
      const decay = PHY.friction * surface.friction * delta;
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
    currentSurface = clampToTrack(delta);

    // ── Orient car ───────────────────────────────────────────────
    car.quaternion.setFromUnitVectors(_FWD_REF, carState.forward);
    carState.lean += (-turnInput * 0.05 * speedFactor - carState.lean) * Math.min(1, 8 * delta);
    car.rotateZ(carState.lean);

    // ── Ghost record / playback ───────────────────────────────
    if (gameMode === 'race') {
      lapElapsed = (performance.now() - lapStartMs) / 1000;
      ghostRec.record(car.position, carState.forward, lapElapsed, carTrackProgress);
      const delta = ghostPlay.update(lapElapsed, carTrackProgress);
      hud.showGhostDelta(delta);
    }

    updateCamera(delta);
    hud.update(carState.speed, PHY.maxSpeed);
    audio.update(carState.speed, PHY.maxSpeed, turnInput);
    minimap.draw(car.position);

    if (gameMode === 'race') {
      story.update(car.position);
    } else {
      currentNearObj = updateExploreObjects(exploreObjs, car.position);
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
