import * as THREE from 'three';
import { TRACK_WIDTH, TRACK_SEGS, buildSpline } from '../game/circuit.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Builds the closed circuit track: ribbon, glowing edges, barrier walls,
 * lamps, pit zones, and start/finish stripe.
 */
export function createTrack(scene) {
  // ── Curve ──────────────────────────────────────────────────────
  const curve = buildSpline();

  // ── Track ribbon ───────────────────────────────────────────────
  const N = TRACK_SEGS;
  const positions = [];
  const normals   = [];
  const uvs       = [];
  const indices   = [];

  const leftEdgePts  = [];
  const rightEdgePts = [];

  for (let i = 0; i <= N; i++) {
    const t    = i / N;
    const pt   = curve.getPoint(t);
    const tan  = curve.getTangent(t).normalize();
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();

    const L = pt.clone().addScaledVector(side, -TRACK_WIDTH / 2).setY(0.05);
    const R = pt.clone().addScaledVector(side,  TRACK_WIDTH / 2).setY(0.05);

    positions.push(L.x, L.y, L.z,  R.x, R.y, R.z);
    normals.push(0, 1, 0,  0, 1, 0);
    uvs.push(0, t * 10,  1, t * 10);

    leftEdgePts.push(L.clone().setY(0.08));
    rightEdgePts.push(R.clone().setY(0.08));


    if (i < N) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      indices.push(a, b, c,  b, d, c);
    }
  }

  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  ribbonGeo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));
  ribbonGeo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,       2));
  ribbonGeo.setIndex(indices);

  scene.add(new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({
    color: 0x1a1a28, roughness: 0.88, metalness: 0.08,
  })));

  // ── Glowing edge lines at ground level (bloom target) ──────────
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 2 });
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leftEdgePts),  edgeMat));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rightEdgePts), edgeMat));

  // ── Barrier walls (continuous mesh along both edges) ───────────
  const wallH = 0.6;
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2c, roughness: 0.7, metalness: 0.3,
    emissive: 0x0a0a18, emissiveIntensity: 0.4,
    transparent: true, opacity: 0.7,
  });

  function buildWallMesh(edgePts) {
    const wPos = [];
    const wNrm = [];
    const wIdx = [];
    for (let i = 0; i < edgePts.length; i++) {
      const p = edgePts[i];
      wPos.push(p.x, 0, p.z);      // bottom vertex
      wNrm.push(0, 0, 0);
      wPos.push(p.x, wallH, p.z);  // top vertex
      wNrm.push(0, 0, 0);
      if (i < edgePts.length - 1) {
        const b = i * 2;
        wIdx.push(b, b + 1, b + 2,  b + 1, b + 3, b + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(wNrm, 3));
    geo.setIndex(wIdx);
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, wallMat));
  }

  buildWallMesh(leftEdgePts);
  buildWallMesh(rightEdgePts);

  // ── Glowing wall-top lines (barrier visibility at night) ───────
  const wallTopMat = new THREE.LineBasicMaterial({
    color: 0x00ccaa, transparent: true, opacity: 0.5, linewidth: 1,
  });
  const leftTop  = leftEdgePts.map(p => p.clone().setY(wallH));
  const rightTop = rightEdgePts.map(p => p.clone().setY(wallH));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leftTop),  wallTopMat));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rightTop), wallTopMat));

  // ── Center dashes ──────────────────────────────────────────────
  const dashMat = new THREE.LineDashedMaterial({
    color: 0x334455, dashSize: 2, gapSize: 2, transparent: true, opacity: 0.35,
  });
  const dashPts = curve.getPoints(N).map(p => p.clone().setY(0.07));

  const dashLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(dashPts), dashMat);
  dashLine.computeLineDistances();
  scene.add(dashLine);

  // ── START line — white stripe with "START" text ────────────────
  (function placeStartLine() {
    const pos = curve.getPoint(0);
    const tan = curve.getTangent(0).normalize();

    // Road texture: white with bold orange "START" text
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const cx2 = cv.getContext('2d');
    cx2.fillStyle = '#ffffff';
    cx2.fillRect(0, 0, 512, 128);
    cx2.fillStyle = '#ff7b00';
    cx2.font = 'bold 96px monospace';
    cx2.textAlign = 'center';
    cx2.textBaseline = 'middle';
    cx2.fillText('START', 256, 64);
    const tex = new THREE.CanvasTexture(cv);

    const geo = new THREE.PlaneGeometry(TRACK_WIDTH, 4);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
    mesh.position.set(pos.x, 0.1, pos.z);
    mesh.rotation.y = Math.atan2(tan.x, tan.z);
    scene.add(mesh);

    // Orange glow overhead
    const light = new THREE.PointLight(0xff7b00, 6, 70);
    light.position.set(pos.x, 16, pos.z);
    scene.add(light);
  })();

  // ── FINISH gantry — 3D arch + checkered banner ─────────────────
  (function placeFinishGantry() {
    const pos  = curve.getPoint(0.99);
    const tan  = curve.getTangent(0.99).normalize();
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();

    const poleH   = 22;      // pole height
    const halfW   = TRACK_WIDTH / 2 + 2;  // half-span (slightly wider than track)
    const poleGeo = new THREE.CylinderGeometry(0.5, 0.5, poleH, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7, roughness: 0.3 });

    // Left and right poles
    [-1, 1].forEach(sign => {
      const base = pos.clone().addScaledVector(side, sign * halfW);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(base.x, poleH / 2, base.z);
      scene.add(pole);
    });

    // Horizontal crossbeam
    const beamGeo = new THREE.BoxGeometry(halfW * 2, 1, 1);
    const beam    = new THREE.Mesh(beamGeo, poleMat);
    beam.position.set(pos.x, poleH, pos.z);
    beam.rotation.y = Math.atan2(tan.x, tan.z);
    scene.add(beam);

    // Checkered banner hanging from beam
    const cols = 10, rows = 3;
    const bannerSize = 256;
    const cw2 = bannerSize / cols, ch2 = bannerSize / rows;
    const cv2 = document.createElement('canvas');
    cv2.width = cv2.height = bannerSize;
    const ctx2 = cv2.getContext('2d');
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx2.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
        ctx2.fillRect(c * cw2, r * ch2, cw2, ch2);
      }
    }
    const bannerTex = new THREE.CanvasTexture(cv2);
    const bannerH   = rows * 1.8;
    const bannerGeo = new THREE.PlaneGeometry(halfW * 2, bannerH);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide });
    const banner    = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(pos.x, poleH - bannerH / 2 - 0.6, pos.z);
    banner.rotation.y = Math.atan2(tan.x, tan.z);
    scene.add(banner);

    // Bright white spotlight on gantry
    const light = new THREE.PointLight(0xffffff, 10, 90);
    light.position.set(pos.x, poleH + 4, pos.z);
    scene.add(light);
  })();


  // ── Track-side lamp posts ──────────────────────────────────────
  const lampCount = 55;
  const postMat   = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.8 });
  const bulbMat   = new THREE.MeshBasicMaterial({ color: 0xffbb55 });

  for (let i = 0; i < lampCount; i++) {
    const t    = i / lampCount;
    const pt   = curve.getPoint(t);
    const tan  = curve.getTangent(t).normalize();
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
    const sign = i % 2 === 0 ? -1 : 1;
    const base = pt.clone().addScaledVector(side, sign * (TRACK_WIDTH / 2 + 6));

    const pl = new THREE.PointLight(0xffaa44, 1.6, 50);
    pl.position.set(base.x, 10, base.z);
    scene.add(pl);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 5), postMat);
    post.position.set(base.x, 4.5, base.z);
    scene.add(post);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), bulbMat);
    bulb.position.set(base.x, 9.3, base.z);
    scene.add(bulb);
  }

  addGravel(scene, curve);
  addKerbs(scene, curve);
  addOuterFence(scene, curve);
  addInfieldGround(scene, curve);   // floating island fill

  return { curve };
}

// ── Gravel/runoff — dark grey ribbon, straights only ──────────
// ── Outer Fence — chain-link style along the outer circuit boundary ──
/**
 * Builds a chain-link fence along the outer (right-side) edge of the track.
 * Posts every POST_STEP samples, three horizontal rails, semi-transparent panel.
 * Inner boundary is left completely open.
 */
function addOuterFence(scene, curve) {
  const SAMPLES     = 800;              // spline sample count
  const FENCE_OFFSET = TRACK_WIDTH / 2 + 9; // just outside gravel (gravel = +4)
  const FENCE_H     = 7;               // fence height in world units
  const POST_STEP   = 14;              // samples between posts (~every 15 units)

  // 1. Sample fence base positions along the outer edge
  const fencePts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t   = i / SAMPLES;
    const pt  = curve.getPoint(t);
    const tan = curve.getTangent(t).normalize();
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
    // Outer edge = +side direction (right of travel, anti-clockwise circuit)
    fencePts.push(pt.clone().addScaledVector(side, FENCE_OFFSET));
  }

  // 2. Fence posts — thin cylinders every POST_STEP samples
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x666677, metalness: 0.7, roughness: 0.4,
  });
  for (let i = 0; i < fencePts.length; i += POST_STEP) {
    const p    = fencePts[i];
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, FENCE_H, 5),
      postMat
    );
    post.position.set(p.x, FENCE_H / 2, p.z);
    scene.add(post);
  }

  // 3. Horizontal rails — top, 2/3, and 1/3 height
  const railMat = new THREE.LineBasicMaterial({ color: 0x888899 });
  [FENCE_H, FENCE_H * 0.65, FENCE_H * 0.3].forEach(y => {
    const pts = fencePts.map(p => new THREE.Vector3(p.x, y, p.z));
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      railMat
    ));
  });

  // 4. Chain-link canvas texture (diamond/crosshatch pattern)
  const cv  = document.createElement('canvas');
  cv.width  = 64; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(180,190,210,0.55)';
  ctx.lineWidth   = 1.5;
  const cell = 8;
  // Diagonal grid
  for (let x = -64; x < 128; x += cell) {
    ctx.beginPath(); ctx.moveTo(x, 0);      ctx.lineTo(x + 64, 64);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 64, 0); ctx.lineTo(x,      64);  ctx.stroke();
  }
  const chainTex = new THREE.CanvasTexture(cv);
  chainTex.wrapS = chainTex.wrapT = THREE.RepeatWrapping;
  chainTex.repeat.set(1, 0.5);

  // 5. Semi-transparent mesh panels between adjacent fence points
  const panelMat = new THREE.MeshBasicMaterial({
    map         : chainTex,
    transparent : true,
    opacity     : 0.55,
    side        : THREE.DoubleSide,
    depthWrite  : false,
  });

  const verts = [];
  const idx   = [];
  const uvs   = [];
  const bottom = 0.4;   // slightly above ground

  for (let i = 0; i < fencePts.length - 1; i++) {
    const a = fencePts[i];
    const b = fencePts[i + 1];
    const vi = i * 4;
    // Quad: two bottom + two top verts
    verts.push(
      a.x, bottom,   a.z,
      a.x, FENCE_H,  a.z,
      b.x, bottom,   b.z,
      b.x, FENCE_H,  b.z,
    );
    uvs.push(0, 0,  0, 1,  1, 0,  1, 1);
    idx.push(vi, vi+1, vi+2,  vi+1, vi+3, vi+2);
  }
  // Close the loop
  const a = fencePts[fencePts.length - 1], b = fencePts[0];
  const vi = (fencePts.length - 1) * 4;
  verts.push(a.x, bottom, a.z, a.x, FENCE_H, a.z, b.x, bottom, b.z, b.x, FENCE_H, b.z);
  uvs.push(0, 0,  0, 1,  1, 0,  1, 1);
  idx.push(vi, vi+1, vi+2,  vi+1, vi+3, vi+2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,   2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, panelMat));
}

// ── Infield Ground — floating island inside the track ────────────
/**
 * Fills everything INSIDE the outer fence with green ground.
 * Uses the outer fence boundary as the Shape polygon (reversed winding
 * so THREE.Shape fills the interior, not the exterior).
 * The track asphalt ribbon (y=0.05) renders on top, so only the
 * non-track areas (infield + shoulder) show green.
 */
function addInfieldGround(scene, curve) {
  const N           = 250;
  const FENCE_OFFSET = TRACK_WIDTH / 2 + 10;  // fence is at +9, grass extends +1 beyond

  // Sample outer fence boundary positions
  const pts2D = [];
  for (let i = 0; i < N; i++) {
    const t    = i / N;
    const pt   = curve.getPoint(t);
    const tan  = curve.getTangent(t).normalize();
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
    // Outer boundary = right side of travel (positive side)
    const outer = pt.clone().addScaledVector(side, FENCE_OFFSET);
    pts2D.push(new THREE.Vector2(outer.x, -outer.z));  // negate z: rotateX(-PI/2) maps shape_y → -world_z
  }

  const shape = new THREE.Shape(pts2D);
  const geo   = new THREE.ShapeGeometry(shape, 2);
  geo.rotateX(-Math.PI / 2);   // XY plane → XZ plane (flat on ground)

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x33dd44, roughness: 1, metalness: 0,
  }));
  mesh.position.y = 0.03;
  scene.add(mesh);
}

// ── Gravel/runoff — dark grey ribbon, straights only ──────────
function addGravel(scene, curve) {
  const cv  = document.createElement('canvas');
  cv.width  = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#4a4a4a';          // darker grey
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    const r = Math.random() * 2 + 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(30,30,30,${0.3 + Math.random() * 0.5})`;
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });

  const GRAVEL_W = 4;
  const GRAVEL_Y = 0.06;
  const SAMPLES  = 400;
  const SKIP      = 3;
  const THRESHOLD = 0.04;   // kerbs start at 0.03. Gravel overlaps up to 0.04, then stops at sharp hairpins to avoid folding.




  const pts  = [];
  const tans = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    pts.push(curve.getPoint(t));
    tans.push(curve.getTangent(t).normalize());
  }

  // Collect low-curvature segments
  const straightSegs = [];
  let inStr = false, sStart = 0;
  for (let i = SKIP; i < pts.length; i++) {
    const t1 = tans[i - SKIP], t2 = tans[i];
    const curv = Math.abs(t1.x * t2.z - t1.z * t2.x);
    if (curv <= THRESHOLD) {
      if (!inStr) { inStr = true; sStart = Math.max(0, i - SKIP); } // extend back slightly to connect
    } else {
      if (inStr) {
        if (i - sStart > 2) straightSegs.push({ start: sStart, end: i }); // extend forward slightly
        inStr = false;
      }
    }
  }
  if (inStr && pts.length - 1 - sStart > 2)
    straightSegs.push({ start: sStart, end: pts.length - 1 });


  // Build a separate mesh per straight segment, per side
  straightSegs.forEach(seg => {
    [-1, 1].forEach(sign => {
      const pos = [], uvArr = [], idx = [];
      let uvU = 0;
      for (let i = seg.start; i <= seg.end; i++) {
        const sideVec = new THREE.Vector3().crossVectors(tans[i], UP).normalize();
        const inner = pts[i].clone().addScaledVector(sideVec,  sign * TRACK_WIDTH / 2);
        const outer = pts[i].clone().addScaledVector(sideVec,  sign * (TRACK_WIDTH / 2 + GRAVEL_W));
        pos.push(inner.x, GRAVEL_Y, inner.z,  outer.x, GRAVEL_Y, outer.z);
        uvArr.push(uvU, 0,  uvU, 1);
        uvU += 0.4;
        if (i > seg.start) {
          const b = (i - seg.start) * 2, a = b - 2;
          idx.push(a, a+1, b,  a+1, b+1, b);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,   3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvArr, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      scene.add(new THREE.Mesh(geo, mat));
    });
  });
}

// ── Kerbs — red/white rumble strips at corner apices ──────────
function addKerbs(scene, curve) {
  // Red/white striped texture
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 32;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#cc1100' : '#ffffff';
    ctx.fillRect(i * 32, 0, 32, 32);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const kerbMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });

  const KERB_W = 4;     // world units wide
  const KERB_Y = 0.12;  // above track ribbon

  // Sample at low density — 400 pts is plenty to detect corners
  const SAMPLES = 400;
  const pts  = [];
  const tans = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    pts.push(curve.getPoint(t));
    tans.push(curve.getTangent(t).normalize());
  }

  // Compare tangents SKIP steps apart to amplify curvature signal
  const SKIP      = 3;
  const THRESHOLD = 0.03;
  const segments  = [];
  let inCorner = false, cSide = 1, cStart = 0;

  for (let i = SKIP; i < pts.length; i++) {
    const t1 = tans[i - SKIP], t2 = tans[i];
    const cross = t1.x * t2.z - t1.z * t2.x;
    const curv  = Math.abs(cross);
    const side  = cross > 0 ? -1 : 1;

    if (curv > THRESHOLD) {
      if (!inCorner || side !== cSide) {
        if (inCorner && i - cStart > 2)
          segments.push({ start: cStart, end: i - 1, side: cSide });
        inCorner = true; cSide = side; cStart = i;
      }
    } else {
      if (inCorner && i - cStart > 2)
        segments.push({ start: cStart, end: i - 1, side: cSide });
      inCorner = false;
    }
  }

  console.log(`[kerbs] detected ${segments.length} corner segments`);

  segments.forEach(seg => {
    const pos = [], uvArr = [], idx = [];
    let uvV = 0;

    for (let i = seg.start; i <= seg.end; i++) {
      const pt   = pts[i];
      const tan  = tans[i];
      const sideVec = new THREE.Vector3().crossVectors(tan, UP).normalize();

      const inner = pt.clone().addScaledVector(sideVec,  seg.side * TRACK_WIDTH / 2);
      const outer = pt.clone().addScaledVector(sideVec,  seg.side * (TRACK_WIDTH / 2 + KERB_W));

      pos.push(inner.x, KERB_Y, inner.z,  outer.x, KERB_Y, outer.z);
      // U steps along track (drives stripe frequency), V spans kerb width
      uvArr.push(uvV, 0,  uvV, 1);
      uvV += 0.35;


      if (i > seg.start) {
        const b = (i - seg.start) * 2;
        const a = b - 2;
        idx.push(a, a + 1, b,  a + 1, b + 1, b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,   3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvArr, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, kerbMat));
  });
}
