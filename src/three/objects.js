import * as THREE from 'three';

/**
 * ExploreObjects — 3D interactable HPC domain objects placed outside the
 * circuit. Only reachable in EXPLORE mode (no barriers).
 *
 * Each object glows when the car is within GLOW_RADIUS, and the info
 * panel slides in. Press E to open/close the full detail panel.
 *
 * Objects are placed well outside the circuit boundary:
 *   Circuit X range ≈ -850 → +720  /  Z range ≈ -570 → +250
 */

const GLOW_RADIUS   = 80;   // start glowing at this distance
const PANEL_RADIUS  = 45;   // panel slides in at this distance

export const HPC_OBJECTS = [
  {
    id:    'systems',
    label: '// SYSTEMS',
    title: 'Linux & Systems Programming',
    body:  'Low-level systems work: kernel modules, device drivers, memory allocators. The penguin runs everything that matters in HPC — from the OS scheduler to MPI runtimes.',
    tags:  ['Linux', 'C', 'Kernel', 'MPI', 'POSIX'],
    position: new THREE.Vector3(-445, 0, -445),
  },
  {
    id:    'fpga',
    label: '// HARDWARE',
    title: 'FPGA & Hardware Accelerators',
    body:  'Custom silicon for custom problems. FPGAs let you implement hardware-optimised datapaths — matrix engines, network offload, custom FFTs — at a fraction of ASIC cost.',
    tags:  ['FPGA', 'Verilog', 'HLS', 'OpenCL', 'PCIe'],
    position: new THREE.Vector3(-395, 0,  390),
  },
  {
    id:    'gpu',
    label: '// GPU CLUSTER',
    title: 'GPU Clusters & AI Inference',
    body:  'Parallel computing at scale. From CUDA kernels to distributed training across nodes, GPU clusters are the backbone of modern HPC workloads and AI inference pipelines.',
    tags:  ['CUDA', 'NCCL', 'PyTorch', 'Triton', 'InfiniBand'],
    position: new THREE.Vector3( 190, 0,   -4),
  },
];

/** Build all 3D objects and return the group + list of interactables. */
export function createExploreObjects(scene) {
  const interactables = [];

  HPC_OBJECTS.forEach(obj => {
    const group = new THREE.Group();
    group.position.copy(obj.position);

    let mesh;
    if (obj.id === 'systems') {
      mesh = buildPC(group);
    } else if (obj.id === 'fpga') {
      mesh = buildFPGA(group);
    } else if (obj.id === 'gpu') {
      mesh = buildGPUCluster(group);
    }

    // Floating label above object
    addLabel(group, obj.label);

    // Point light that glows on proximity (starts dim)
    const light = new THREE.PointLight(0x00ffcc, 0, 120);
    light.position.set(0, 25, 0);
    group.add(light);

    scene.add(group);
    interactables.push({ ...obj, group, light });
  });

  return interactables;
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
