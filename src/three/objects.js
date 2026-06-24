import * as THREE from 'three';
import { CIRCUIT_POINTS } from '../game/circuit.js';

/**
 * Floor decals — flat PNG planes placed on the circuit infield ground.
 * Rendered with MeshBasicMaterial (unlit) so they stay vivid at night.
 *
 * Each entry: { src: '/file.png', x, z, width, height, rotY }
 * rotY rotates the decal around the Y axis so it faces the right direction.
 */

/**
 * ExploreObjects — temporarily disabled, rethinking display approach.
 */

const GLOW_RADIUS = 80;   // start glowing at this distance
const PANEL_RADIUS = 45;   // panel slides in at this distance

// ── HPC_OBJECTS temporarily disabled — rethinking display approach ──
// export const HPC_OBJECTS = [
//   {
//     id:    'systems',
//     label: '// SYSTEMS',
//     title: 'Linux & Systems Programming',
//     body:  'Low-level systems work: kernel modules, device drivers, memory allocators. The penguin runs everything that matters in HPC — from the OS scheduler to MPI runtimes.',
//     tags:  ['Linux', 'C', 'Kernel', 'MPI', 'POSIX'],
//     position: new THREE.Vector3(-445, 0, -445),
//   },
//   {
//     id:    'fpga',
//     label: '// HARDWARE',
//     title: 'FPGA & Hardware Accelerators',
//     body:  'Custom silicon for custom problems. FPGAs let you implement hardware-optimised datapaths — matrix engines, network offload, custom FFTs — at a fraction of ASIC cost.',
//     tags:  ['FPGA', 'Verilog', 'HLS', 'OpenCL', 'PCIe'],
//     position: new THREE.Vector3(-395, 0,  390),
//   },
//   {
//     id:    'gpu',
//     label: '// GPU CLUSTER',
//     title: 'GPU Clusters & AI Inference',
//     body:  'Parallel computing at scale. From CUDA kernels to distributed training across nodes, GPU clusters are the backbone of modern HPC workloads and AI inference pipelines.',
//     tags:  ['CUDA', 'NCCL', 'PyTorch', 'Triton', 'InfiniBand'],
//     position: new THREE.Vector3( 190, 0,   -4),
//   },
// ];
export const HPC_OBJECTS = [];   // disabled — re-enable above when ready

/** Build all 3D objects and return the group + list of interactables. */
export function createExploreObjects(scene) {
  // Objects disabled — return empty list so explore mode still works
  return [];
}

/** Update glow intensity based on car proximity. Returns nearest object within PANEL_RADIUS or null. */
export function updateExploreObjects(interactables, carPos) {
  let nearest = null;
  let nearestDist = Infinity;

  interactables.forEach(obj => {
    const dist = carPos.distanceTo(obj.position);

    // Glow: ramp from 0 at GLOW_RADIUS to 3 at PANEL_RADIUS
    const t = Math.max(0, 1 - dist / GLOW_RADIUS);
    obj.light.intensity = t * 4;

    // Pulse the emissive of all meshes in the group
    obj.group.traverse(child => {
      if (child.isMesh && child.material.emissiveIntensity !== undefined) {
        child.material.emissiveIntensity = t * 0.6;
      }
    });

    if (dist < PANEL_RADIUS && dist < nearestDist) {
      nearest = obj;
      nearestDist = dist;
    }
  });

  return nearest;
}

// ── Portfolio Stations ─────────────────────────────────────────────
/**
 * A "station" = 3 vertical screen panels on stands in a fan arrangement
 * + large ground text painted below them (like F1 zone markings).
 *
 * One test station placed in the infield for visual prototyping.
 * Replace placeholder content + position with real data when approved.
 */
// ── Portfolio Station Definitions ──────────────────────────────────────
// Single source of truth for both 3D placement and minimap markers.
// Change pos here to move a station; the minimap dot follows automatically.
export const STATION_CONFIGS = [
  {
    pos:   new THREE.Vector3(-600, 0, -245),
    label: 'T1 BRAKE',
    org:   'HEAVY BRAKING ZONE',
    desc:  'BRAKE IN A STRAIGHT LINE.\nROLL OFF BEFORE TURN-IN.\nA CLEAN EXIT BEATS A HERO ENTRY.',
    panels: () => [
      makeAboutCanvas('// SECTOR 1', 'BRAKE POINT', 'TURN 1', 'TRACK TIP'),
      makeAboutCanvas('// TECHNIQUE', 'TRAIL BRAKE', 'LIGHT INPUTS', 'CONTROL'),
      makeAboutCanvas('// TARGET', 'CLEAN EXIT', 'FULL THROTTLE EARLY', 'TIME ATTACK'),
    ],
  },
  {
    pos:   new THREE.Vector3(-630, 0, -295),
    label: 'APEX',
    org:   'CORNER PHASE',
    desc:  'LOOK THROUGH THE CORNER.\nCLIP THE INSIDE KERB LIGHTLY.\nUNWIND STEERING ON EXIT.',
    panels: () => [
      makeAboutCanvas('// CORNER', 'APEX', 'MID-CORNER', 'LINE'),
      makeAboutCanvas('// RHYTHM', 'SMOOTH HANDS', 'NO PANIC', 'GRIP'),
      makeAboutCanvas('// EXIT', 'OPEN WHEEL', 'BUILD SPEED', 'FLOW'),
    ],
  },
  {
    pos:   new THREE.Vector3(-300, 0, -20),
    label: 'SPLIT 1',
    org:   'REFERENCE DELTA',
    desc:  'COMPARE AGAINST THE GHOST.\nSMALLER STEERING ANGLES SAVE SPEED.\nKEEP THE CAR SETTLED.',
    panels: () => [
      makeAboutCanvas('// TIMING', 'SPLIT 1', 'CHASE THE GHOST', 'DELTA'),
      makeAboutCanvas('// RACECRAFT', 'MINIMIZE SLIDE', 'SAVE SPEED', 'FOCUS'),
      makeAboutCanvas('// GOAL', 'GREEN DELTA', 'BEAT THE LAP', 'PUSH'),
    ],
  },
  {
    pos:   new THREE.Vector3(-225, 0, -15),
    label: 'KERB',
    org:   'TRACK LIMITS',
    desc:  'KERBS ARE FAST ONLY WHEN STRAIGHT.\nRUNOFF COSTS ACCELERATION.\nWALLS KILL MOMENTUM.',
    panels: () => [
      makeAboutCanvas('// LIMITS', 'KERBS', 'USE CAREFULLY', 'SURFACE'),
      makeAboutCanvas('// WARNING', 'RUNOFF DRAG', 'LOW GRIP', 'PENALTY'),
      makeAboutCanvas('// RESET', 'STAY ON LINE', 'KEEP MOMENTUM', 'CONTROL'),
    ],
  },
  {
    pos:   new THREE.Vector3(165, 0, 70),
    label: 'FINAL',
    org:   'LAST SECTOR',
    desc:  'SET UP THE STRAIGHT.\nPRIORITIZE EXIT SPEED.\nEVERY KM/H COUNTS TO THE LINE.',
    panels: () => [
      makeAboutCanvas('// SECTOR 3', 'FINAL PUSH', 'LAST CHANCE', 'COMMIT'),
      makeAboutCanvas('// EXIT', 'THROTTLE EARLY', 'OPEN STEERING', 'SPEED'),
      makeAboutCanvas('// LINE', 'DON\'T LIFT', 'FINISH STRONG', 'TIME'),
    ],
  },
  {
    pos:   new THREE.Vector3(195, 0, 100),
    label: 'GARAGE',
    org:   'POST-RUN REVIEW',
    desc:  'CHECK YOUR DELTA.\nTRY A DIFFERENT BRAKE MARKER.\nRUN IT BACK CLEANER.',
    panels: () => [
      makeAboutCanvas('// GARAGE', 'ANALYZE', 'FIND TENTHS', 'REVIEW'),
      makeAboutCanvas('// SETUP', 'SMOOTHER LINE', 'LESS SCRUB', 'ADJUST'),
      makeAboutCanvas('// NEXT RUN', 'ONE MORE LAP', 'ONE MORE TENTH', 'RETRY'),
    ],
  },
];
// ── Auto-orient helper ──────────────────────────────────────────────
// Rotates `group` so panels run PARALLEL to the track and their screen
// face points inward toward the road (visible to a passing driver).
//
// Uses nearest-SEGMENT projection so orientation is accurate even when
// the station sits beside a curve (nearest vertex gives the apex
// tangent which is perpendicular to the road, not parallel).
function faceTrack(stationPos, group) {
  const n = CIRCUIT_POINTS.length;

  // 1. Find the closest point on any segment
  let bestSegIdx = 0, bestT = 0, bestDist = Infinity;

  for (let i = 0; i < n; i++) {
    const a = CIRCUIT_POINTS[i];
    const b = CIRCUIT_POINTS[(i + 1) % n];
    const abx = b.x - a.x, abz = b.z - a.z;
    const apx = stationPos.x - a.x, apz = stationPos.z - a.z;
    const len2 = abx * abx + abz * abz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / len2)) : 0;
    const cx = a.x + t * abx, cz = a.z + t * abz;
    const dx = stationPos.x - cx, dz = stationPos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDist) { bestDist = d2; bestSegIdx = i; bestT = t; }
  }

  // 2. Tangent = direction of that segment
  const a = CIRCUIT_POINTS[bestSegIdx];
  const b = CIRCUIT_POINTS[(bestSegIdx + 1) % n];
  const tx = b.x - a.x, tz = b.z - a.z;
  const tLen = Math.sqrt(tx * tx + tz * tz);
  const tnx = tx / tLen, tnz = tz / tLen;

  // 3. Nearest point on that segment (to determine inward direction)
  const closestX = a.x + bestT * (b.x - a.x);
  const closestZ = a.z + bestT * (b.z - a.z);

  // 4. Two perpendiculars (90° rotations of tangent)
  const perpAx = -tnz, perpAz =  tnx;   // CCW
  const perpBx =  tnz, perpBz = -tnx;   // CW

  // 5. Pick the one that points from station toward road
  const dx = closestX - stationPos.x, dz = closestZ - stationPos.z;
  const dot = perpAx * dx + perpAz * dz;
  const nx = dot >= 0 ? perpAx : perpBx;
  const nz = dot >= 0 ? perpAz : perpBz;

  // 6. Rotate group so local +X → inward normal (panels parallel to road)
  group.rotation.y = Math.atan2(-nz, nx);
}

export function createPortfolioStations(scene) {
  // ── Sizes (world units) ───────────────────────────────────────
  const PANEL_W = 11;
  const PANEL_H = 5;
  const POST_H = 1;
  const FAN_Z = 13;   // north-south spread between panels

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.85, roughness: 0.3 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x06060f, metalness: 0.3, roughness: 0.9 });

  STATION_CONFIGS.forEach(s => {
    const group = new THREE.Group();
    const panels = typeof s.panels === 'function' ? s.panels() : s.panels;
    group.position.copy(s.pos);
    faceTrack(s.pos, group);   // auto-orient panels toward nearest track point

    const py = POST_H + PANEL_H / 2 + 1;   // panel centre height

    // All panels face due east (toward the track/driver to the east).
    // Spread north-south so the driver sees them in sequence while passing.
    const fanDefs = [
      { z: -FAN_Z, ry: Math.PI / 2 },   // north panel
      { z: 0, ry: Math.PI / 2 },   // centre panel
      { z: +FAN_Z, ry: Math.PI / 2 },   // south panel
    ];

    fanDefs.forEach((fd, i) => {
      const pz = fd.z;

      // Backing board (thin box, aligned with each panel's rotation)
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, PANEL_H + 1, PANEL_W + 1),
        backMat
      );
      back.position.set(-0.3, py, pz);
      back.rotation.y = fd.ry - Math.PI / 2;
      group.add(back);

      // Screen face
      const panelCanvas = panels[i] || makeAboutCanvas('// TRACKSIDE', s.label || 'RACE', '', 'SIGNAGE');
      const tex = new THREE.CanvasTexture(panelCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      // Back-reference so async image loads can trigger needsUpdate
      if (panelCanvas) panelCanvas._tex = tex;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(PANEL_W, PANEL_H),
        new THREE.MeshStandardMaterial({
          map: tex,
          side: THREE.DoubleSide,
          roughness: 0.85,
          metalness: 0.0,
        })
      );
      face.position.set(0, py, pz);
      face.rotation.y = fd.ry;
      group.add(face);

      // Screen glow (subtle — keeps the panel readable without glaring)
      const glow = new THREE.PointLight(0x8899ff, 0.08, 20);
      glow.position.set(3, py, pz);
      group.add(glow);
    });

    // ── Ground label ──────────────────────────────────────────────
    // Flat decal on the ground in front of the panels facing the road.
    // rotation.z = PI/2 makes the text run along the track so it reads
    // naturally as the driver drives past.
    const glCv = makeGroundLabelCanvas(s.label, s.org || '', s.desc || '');
    const glTex = new THREE.CanvasTexture(glCv);
    glTex.colorSpace = THREE.SRGBColorSpace;
    const groundLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 18),
      new THREE.MeshBasicMaterial({ map: glTex, transparent: true, depthWrite: false })
    );
    groundLabel.rotation.x = -Math.PI / 2;
    groundLabel.rotation.z = Math.PI / 2;
    groundLabel.position.set(9, 0.18, 0);   // close to panels, no gap
    group.add(groundLabel);

    scene.add(group);
  });
}

// ── Canvas helpers ─────────────────────────────────────────────────

// Ground label decal — title, org tag, and description block.
// Inspired by portfolio reference: large name + smaller ALL-CAPS description.
function makeGroundLabelCanvas(label, org, desc) {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  ctx.clearRect(0, 0, W, H);

  // Dark backing pill
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  const pad = 20;
  ctx.beginPath();
  ctx.roundRect(pad, pad, W - pad * 2, H - pad * 2, 20);
  ctx.fill();

  // Cyan top rule
  ctx.fillStyle = '#00ffcc';
  ctx.fillRect(pad + 12, pad + 10, W - (pad + 12) * 2, 3);

  // ── Large title ────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 160px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, pad + 24, pad + 22);

  // ── Org / event tag ────────────────────────────────────────────
  if (org) {
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.fillText(org, pad + 28, pad + 186);
  }

  // Divider under org
  ctx.fillStyle = 'rgba(0,255,204,0.25)';
  ctx.fillRect(pad + 28, pad + 234, W - (pad + 28) * 2, 2);

  // ── Description lines ──────────────────────────────────────────
  if (desc) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '30px Arial, sans-serif';
    const lines = desc.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, pad + 28, pad + 248 + i * 44);
    });
  }

  // Cyan bottom rule
  ctx.fillStyle = '#00ffcc';
  ctx.fillRect(pad + 12, H - pad - 14, W - (pad + 12) * 2, 3);

  return cv;
}

// Load an image onto a billboard panel.
// Returns the canvas immediately (with a dark placeholder) so Three.js
// can create the texture; once the image loads it redraws and triggers
// texture.needsUpdate so it appears without a scene reload.
export function makeImageCanvas(src) {
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Dark placeholder
  ctx.fillStyle = '#06060f';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#00ffcc';
  ctx.fillRect(0, 0, W, 4);   // thin top accent
  ctx.fillStyle = 'rgba(0,255,204,0.15)';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('LOADING…', 20, H / 2 + 7);

  const img = new Image();
  img.onload = () => {
    // Contain-fit: show the full image with dark letterbox bars (no cropping)
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);
    const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    ctx.fillRect(0, 0, W, H);
    if (cv._tex) cv._tex.needsUpdate = true;
  };
  img.onerror = () => {
    ctx.fillStyle = '#06060f'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff4444'; ctx.font = '14px monospace';
    ctx.fillText('Image not found:', 16, H / 2 - 10);
    ctx.fillStyle = '#888'; ctx.font = '11px monospace';
    ctx.fillText(src, 16, H / 2 + 12);
    if (cv._tex) cv._tex.needsUpdate = true;
  };
  img.src = src;
  return cv;
}

function panelBase() {
  // 512×256 matches the panel's ~2.2:1 world aspect ratio (11×5 units)
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#06060f';
  ctx.fillRect(0, 0, W, H);
  // Cyan top accent bar
  ctx.fillStyle = '#00ffcc';
  ctx.fillRect(0, 0, W, 6);
  // Subtle border
  ctx.strokeStyle = 'rgba(0,255,204,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  return { cv, ctx, W, H };
}

function makeAboutCanvas(label, title, year, subtitle) {
  const { cv, ctx } = panelBase();
  // Label
  ctx.fillStyle = '#00ffcc';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(label, 22, 38);
  // Title — big and bold
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.fillText(title, 22, 126);
  // Subtitle
  ctx.fillStyle = '#aaaacc';
  ctx.font = '24px monospace';
  ctx.fillText(subtitle, 22, 162);
  // Year
  ctx.fillStyle = '#00ffcc';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(year, 22, 205);
  // Divider
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(22, 218, 468, 2);
  return cv;
}

function makeDescCanvas(desc, tags) {
  const { cv, ctx } = panelBase();
  // Label
  ctx.fillStyle = '#00ffcc';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('// WHAT I DID', 22, 38);
  // Body text — larger, fewer lines
  ctx.fillStyle = '#e0e0ee';
  ctx.font = '26px Arial, sans-serif';
  desc.split('\n').forEach((line, i) => ctx.fillText(line, 22, 78 + i * 36));
  // Tag pills
  let tx = 22, ty = 205;
  ctx.font = 'bold 20px monospace';
  tags.forEach(tag => {
    const tw = ctx.measureText(tag).width + 20;
    if (tx + tw > 492) { tx = 22; ty += 34; }
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, ty, tw, 30);
    ctx.fillStyle = '#00ffcc';
    ctx.fillText(tag, tx + 10, ty + 21);
    tx += tw + 8;
  });
  return cv;
}

function makeResultCanvas(big, label, cta) {
  const { cv, ctx } = panelBase();
  // Label
  ctx.fillStyle = '#00ffcc';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('// RESULT', 22, 38);
  // Big result number
  ctx.fillStyle = '#00ffcc';
  ctx.font = 'bold 120px Arial, sans-serif';
  ctx.fillText(big, 22, 162);
  // Sub-label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(label, 22, 200);
  // CTA button
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 216, 180, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(cta, 38, 238);
  return cv;
}

function makeGroundCanvas(title, sub) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256);

  // Main title
  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  ctx.font = 'bold 108px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 512, 118);

  // Subtitle
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.font = '22px monospace';
  ctx.fillText(sub, 512, 172);
  return cv;
}

// ── Floor Decals (commented out — testing billboards/gantries instead) ──
// export const FLOOR_DECALS = [
//   { src: '/decal-test.png', x: 0, z: -120, width: 200, height: 200, rotY: 0 },
// ];
// export function createFloorDecals(scene) { /* disabled */ }

// ── Trackside Billboards ──────────────────────────────────────────────

/**
 * A large vertical billboard panel alongside the track,
 * like an F1 trackside advertising board on the barriers.
 *
 * Placed on the main straight (x≈680, east side of the straight).
 * The panel faces west so it's readable as the car drives north.
 *
 *   [post]
 *   ┌──────────────────────────┐
 *   │      BANNER PANEL        │  ← textured PNG
 *   └──────────────────────────┘
 */
export function createBillboards(scene) {
  const loader = new THREE.TextureLoader();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.8, roughness: 0.3 });

  // Main straight billboard — east side, facing the cars
  const billboards = [
    { src: '/banner-test.png', x: 690, z: -220, rotY: Math.PI / 2, w: 75, h: 28 },
  ];

  billboards.forEach(b => {
    const group = new THREE.Group();
    group.position.set(b.x, 0, b.z);
    group.rotation.y = b.rotY;

    // Support posts (two thin vertical pillars)
    [-b.w * 0.4, b.w * 0.4].forEach(xOff => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(2.5, b.h + 8, 2.5), steelMat);
      post.position.set(xOff, (b.h + 8) / 2, -1);
      group.add(post);
    });

    // Back panel (dark backing board)
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 4, b.h + 4, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x0a0a14, metalness: 0.4, roughness: 0.8 })
    );
    back.position.set(0, b.h / 2 + 6, -1.5);
    group.add(back);

    // Banner face — textured PNG, tilted ~35° toward camera
    loader.load(b.src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(b.w, b.h),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      face.position.set(0, b.h / 2 + 6, -0.7);
      face.rotation.x = -Math.PI / 5;   // tilt top back so camera reads face
      group.add(face);
    });

    // Subtle cyan underglow light
    const light = new THREE.PointLight(0x00ffcc, 1.2, 180);
    light.position.set(0, b.h + 10, 5);
    group.add(light);

    scene.add(group);
  });
}

// ── Overhead Gantry Banner ────────────────────────────────────────────

/**
 * An overhead arch/gantry spanning the full track width,
 * like the Heineken/timing gantries over F1 circuits.
 *
 *   ┌──────── BANNER ─────────┐
 *   │  (textured PNG panel)   │
 *   └─────────────────────────┘
 *   |                         |   ← vertical pillars
 *   ●                         ●   ← base plates
 *
 * Positioned over the main straight so it's dramatic during the lap.
 */
export function createGantry(scene) {
  const loader = new THREE.TextureLoader();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.9, roughness: 0.2 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.6, roughness: 0.5 });

  // Gantry over the main straight — high enough for the car to pass under
  const span = 68;   // track width + shoulders
  const height = 38;   // pillar height
  const bannerH = 14;   // banner panel height
  const bannerW = span - 6;

  const group = new THREE.Group();
  group.position.set(610, 0, -320);  // over the main straight
  // Rotate so the arch spans east-west across the straight (straight goes north-south)
  group.rotation.y = 0;

  // Left pillar
  const lPillar = new THREE.Mesh(new THREE.BoxGeometry(5, height, 5), steelMat);
  lPillar.position.set(-span / 2, height / 2, 0);
  group.add(lPillar);

  // Right pillar
  const rPillar = new THREE.Mesh(new THREE.BoxGeometry(5, height, 5), steelMat);
  rPillar.position.set(span / 2, height / 2, 0);
  group.add(rPillar);

  // Horizontal top beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 5, 5, 5), steelMat);
  beam.position.set(0, height, 0);
  group.add(beam);

  // Base plates
  [-span / 2, span / 2].forEach(x => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(12, 1.5, 12), plateMat);
    plate.position.set(x, 0.75, 0);
    group.add(plate);
  });

  // Banner backing (dark panel hanging from beam)
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(bannerW, bannerH, 1),
    new THREE.MeshStandardMaterial({ color: 0x070712, metalness: 0.3, roughness: 0.9 })
  );
  backing.position.set(0, height - bannerH / 2 - 3, -3);
  group.add(backing);

  // Banner face — textured PNG, tilted ~35° downward toward approaching car
  loader.load('/banner-test.png', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(bannerW, bannerH),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    face.position.set(0, height - bannerH / 2 - 3, -2.4);
    face.rotation.x = -Math.PI / 5;   // tilt so camera sees face instead of edge
    group.add(face);
  });

  // Accent lights on the beam (two small spotlights pointing down)
  [-span * 0.3, 0, span * 0.3].forEach(x => {
    const l = new THREE.PointLight(0x00ffcc, 0.6, 120);
    l.position.set(x, height - 5, -6);
    group.add(l);
  });

  scene.add(group);
}

// ── 3D Object builders ────────────────────────────────────────────

function buildPC(group) {
  const mat = (color) => new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(color), emissiveIntensity: 0,
    metalness: 0.3, roughness: 0.7,
  });

  // Monitor base
  const base = new THREE.Mesh(new THREE.BoxGeometry(18, 1.5, 8), mat(0x222233));
  base.position.set(0, 1, 0);
  group.add(base);

  // Monitor stand
  const stand = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), mat(0x333344));
  stand.position.set(0, 6, 0);
  group.add(stand);

  // Monitor screen surround
  const surround = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 1.5), mat(0x111122));
  surround.position.set(0, 16, 0);
  group.add(surround);

  // Screen (glowing cyan)
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x001a1a });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(19, 11), screenMat);
  screen.position.set(0, 16, 1);
  group.add(screen);

  // Tux penguin on screen (simplified as coloured planes)
  addTux(group, new THREE.Vector3(0, 16, 1.1));

  // Tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(7, 20, 9), mat(0x1a1a2e));
  tower.position.set(-16, 10, 0);
  group.add(tower);

  // Tower LED strip
  const led = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.8, 0.2), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
  led.position.set(-16, 18, 4.6);
  group.add(led);

  return surround;
}

function addTux(group, offset) {
  // Simplified Tux: white belly, black body, orange beak/feet
  const body = new THREE.Mesh(new THREE.CircleGeometry(3, 16),
    new THREE.MeshBasicMaterial({ color: 0x111111 }));
  body.position.copy(offset);
  group.add(body);

  const belly = new THREE.Mesh(new THREE.CircleGeometry(1.8, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  belly.position.set(offset.x, offset.y - 0.3, offset.z + 0.01);
  group.add(belly);

  const beak = new THREE.Mesh(new THREE.CircleGeometry(0.5, 6),
    new THREE.MeshBasicMaterial({ color: 0xff8800 }));
  beak.position.set(offset.x, offset.y + 1.5, offset.z + 0.01);
  group.add(beak);
}

function buildFPGA(group) {
  const pcbMat = new THREE.MeshStandardMaterial({
    color: 0x006622, emissive: new THREE.Color(0x006622), emissiveIntensity: 0,
    metalness: 0.2, roughness: 0.8,
  });
  const chipMat = new THREE.MeshStandardMaterial({
    color: 0x111111, emissive: new THREE.Color(0x111111), emissiveIntensity: 0,
    metalness: 0.7, roughness: 0.3,
  });

  // PCB board — tilted up so it's visible
  const board = new THREE.Mesh(new THREE.BoxGeometry(28, 20, 1), pcbMat);
  board.rotation.x = -Math.PI / 6;
  board.position.set(0, 12, 0);
  group.add(board);

  // Legs/stand
  [-10, 10].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 1.5), chipMat);
    leg.position.set(x, 3, 0);
    group.add(leg);
  });

  // FPGA chip (large central chip)
  const mainChip = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 1.5), chipMat);
  mainChip.rotation.x = -Math.PI / 6;
  mainChip.position.set(0, 12, 0.8);
  group.add(mainChip);

  // Smaller support chips
  [[-8, 4], [8, 4], [-8, -4], [8, -4]].forEach(([ox, oz]) => {
    const chip = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 1.2), chipMat);
    chip.rotation.x = -Math.PI / 6;
    chip.position.set(ox, 12 + oz * 0.5, 0.7);
    group.add(chip);
  });

  // Gold trace lines
  const traceMat = new THREE.MeshBasicMaterial({ color: 0xddaa00 });
  for (let i = -3; i <= 3; i++) {
    const trace = new THREE.Mesh(new THREE.BoxGeometry(0.3, 14, 0.1), traceMat);
    trace.rotation.x = -Math.PI / 6;
    trace.position.set(i * 1.8, 12, 0.55);
    group.add(trace);
  }

  return board;
}

function buildGPUCluster(group) {
  const rackMat = new THREE.MeshStandardMaterial({
    color: 0x111118, emissive: new THREE.Color(0x111118), emissiveIntensity: 0,
    metalness: 0.8, roughness: 0.2,
  });
  const gpuMat = new THREE.MeshStandardMaterial({
    color: 0x76b900, emissive: new THREE.Color(0x76b900), emissiveIntensity: 0,
    metalness: 0.5, roughness: 0.5,
  });

  // Two server racks side by side
  [-14, 14].forEach(xOff => {
    // Rack chassis
    const rack = new THREE.Mesh(new THREE.BoxGeometry(12, 36, 10), rackMat);
    rack.position.set(xOff, 18, 0);
    group.add(rack);

    // GPU cards in the rack (4 per rack)
    for (let i = 0; i < 4; i++) {
      const card = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 1.5), gpuMat);
      card.position.set(xOff, 8 + i * 7, 5.5);
      group.add(card);

      // GPU fan circle
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 12),
        new THREE.MeshBasicMaterial({ color: 0x333333 }));
      fan.rotation.x = Math.PI / 2;
      fan.position.set(xOff - 2, 8 + i * 7, 6.3);
      group.add(fan);

      // Green power LED
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x00ff44 }));
      led.position.set(xOff + 4.5, 8 + i * 7, 6.3);
      group.add(led);
    }
  });

  // InfiniBand cables between racks (arcs)
  const cableMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  for (let i = 0; i < 4; i++) {
    const cable = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 0.4), cableMat);
    cable.position.set(0, 28 + i * 1.5, -4);
    group.add(cable);
  }

  return group.children[0];
}

function addLabel(group, text) {
  // Simple floating box as label placeholder (real text needs TextGeometry/CSS2D)
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#00ffcc';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(20, 5, 1);
  sprite.position.set(0, 42, 0);
  group.add(sprite);
}
