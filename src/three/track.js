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

    const L = pt.clone().addScaledVector(side, -TRACK_WIDTH / 2);
    const R = pt.clone().addScaledVector(side,  TRACK_WIDTH / 2);

    positions.push(L.x, L.y, L.z,  R.x, R.y, R.z);
    normals.push(0, 1, 0,  0, 1, 0);
    uvs.push(0, t * 10,  1, t * 10);

    leftEdgePts.push(L.clone().setY(0.06));
    rightEdgePts.push(R.clone().setY(0.06));

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
  const dashPts = curve.getPoints(N).map(p => p.clone().setY(0.02));
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
    mesh.position.set(pos.x, 0.025, pos.z);
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

  return { curve };
}
