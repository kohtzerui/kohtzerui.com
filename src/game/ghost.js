/**
 * ghost.js — Intro lap ghost system.
 *
 * The ghost is a pre-recorded lap by the portfolio owner (Koh Tze Rui).
 * It is loaded from /ghost_lap.json which is recorded once using the
 * dev recording tool and checked into the project.
 *
 * Flow:
 *   Lap 1  → Ghost plays (the developer's intro lap)
 *   Visitor drives Lap 2+ and tries to beat the ghost
 *
 * Recording workflow (dev only):
 *   1. Open the game with ?record=1 in the URL
 *   2. Drive a lap — positions are recorded
 *   3. At the finish line a download link appears for ghost_lap.json
 *   4. Save to public/ghost_lap.json and commit
 *
 * GhostRecorder — dev-only: records a lap and lets you download the JSON
 * GhostPlayer   — always active: loads /ghost_lap.json and replays it
 */

import * as THREE from 'three';

const FWD_REF = new THREE.Vector3(1, 0, 0);

// ─────────────────────────────────────────────────────────────────
// Ghost mesh — same silhouette as player, translucent blue
// ─────────────────────────────────────────────────────────────────
function buildGhostMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0088ff, emissive: 0x0044cc, emissiveIntensity: 1.2,
    transparent: true, opacity: 0.6, depthWrite: false,
  });


  function box(w, h, d, px, py, pz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz); g.add(m);
  }

  // Body
  box(3.6, 0.30, 1.05,  0.10, 0.34,  0);
  box(2.0, 0.22, 0.32,  0.10, 0.28,  0.55);
  box(2.0, 0.22, 0.32,  0.10, 0.28, -0.55);
  box(1.0, 0.38, 0.82,  0.20, 0.68,  0);
  // Wings
  box(0.1, 0.06, 1.75,  3.10, 0.17,  0);
  box(0.1, 0.06, 1.55, -1.75, 0.88,  0);
  // Nose
  const noseGeo = new THREE.CylinderGeometry(0.07, 0.42, 1.45, 7);
  noseGeo.rotateZ(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, mat);
  nose.position.set(2.48, 0.27, 0);
  g.add(nose);
  // Wheels
  [
    { x:  1.65, z:  0.77, r: 0.37, w: 0.27 },
    { x:  1.65, z: -0.77, r: 0.37, w: 0.27 },
    { x: -1.45, z:  0.86, r: 0.41, w: 0.31 },
    { x: -1.45, z: -0.86, r: 0.41, w: 0.31 },
  ].forEach(wh => {
    const geo = new THREE.CylinderGeometry(wh.r, wh.r, wh.w, 12);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(wh.x, wh.r, wh.z);
    g.add(mesh);
  });
  return g;
}

// ─────────────────────────────────────────────────────────────────
// GhostRecorder  (DEV ONLY — ?record=1 in URL)
// ─────────────────────────────────────────────────────────────────
export class GhostRecorder {
  constructor() {
    this.frames     = [];
    this._lastT     = -99;
    this._recording = false;
    this.active     = new URLSearchParams(window.location.search).has('record');
  }

  start() {
    if (!this.active) return;
    this.frames     = [];
    this._lastT     = -99;
    this._recording = true;
    console.log('[GhostRecorder] Recording started — drive a full lap then cross the finish line');
  }

  /**
   * Call every game frame (no-op if not in record mode).
   * @param {THREE.Vector3} pos
   * @param {THREE.Vector3} fwd  normalised forward vector
   * @param {number}        t    elapsed seconds since lap start
   * @param {number}        tp   track progress 0-1
   */
  record(pos, fwd, t, tp) {
    if (!this._recording) return;
    if (t - this._lastT < 0.05) return;   // ~20 fps
    this._lastT = t;
    this.frames.push({ t, tp, x: pos.x, z: pos.z, fx: fwd.x, fz: fwd.z });
  }

  /**
   * Stop recording and offer the JSON file for download.
   * Call this when the lap is complete.
   */
  finish(lapMs) {
    if (!this._recording) return;
    this._recording = false;

    const data = JSON.stringify({ lapMs, frames: this.frames });
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'ghost_lap.json';
    a.textContent = '⬇ Download ghost_lap.json';
    a.style.cssText = `
      position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
      background:#00ffcc; color:#000; padding:12px 24px; border-radius:6px;
      font-family:monospace; font-size:13px; font-weight:bold; z-index:9999;
      text-decoration:none; box-shadow:0 0 20px #00ffcc88;
    `;
    document.body.appendChild(a);
    console.log(`[GhostRecorder] Lap recorded! ${this.frames.length} frames, ${(lapMs/1000).toFixed(3)}s. Click the download link.`);
  }
}

// ─────────────────────────────────────────────────────────────────
// GhostPlayer
// ─────────────────────────────────────────────────────────────────
export class GhostPlayer {
  constructor(scene) {
    this.scene    = scene;
    this.mesh     = null;
    this.frames   = [];
    this.lapMs    = null;
    this._playing = false;
    this._frameI  = 0;
  }

  /** Returns true if ghost data was loaded successfully. */
  async load() {
    try {
      const res = await fetch('/ghost_lap.json');
      if (!res.ok) {
        console.log('[GhostPlayer] No ghost_lap.json found — ghost disabled. Add ?record=1 to record your intro lap.');
        return false;
      }
      const d = await res.json();
      if (!d?.frames?.length) return false;
      this.frames = d.frames;
      this.lapMs  = d.lapMs;

      if (!this.mesh) {
        this.mesh = buildGhostMesh();
        this.scene.add(this.mesh);
      }
      this.mesh.visible = false;
      console.log(`[GhostPlayer] Loaded ghost — ${this.frames.length} frames, ${(this.lapMs/1000).toFixed(2)}s`);
      return true;
    } catch (e) {
      console.log('[GhostPlayer] Could not load ghost_lap.json:', e.message);
      return false;
    }
  }

  hasGhost() {
    return this.frames.length > 0;
  }

  /** Begin ghost playback at the start of the visitor's lap. */
  start() {
    if (!this.frames.length) return;
    this._playing = true;
    this._frameI  = 0;
    if (this.mesh) {
      this.mesh.visible = true;
      const f = this.frames[0];
      this.mesh.position.set(f.x, 0, f.z);
    }
  }

  /** Hide the ghost. */
  stop() {
    this._playing = false;
    if (this.mesh) this.mesh.visible = false;
  }

  /**
   * Advance ghost position each frame.
   * @param {number} lapElapsed  Seconds since visitor's lap started
   * @param {number} playerTp    Player's track progress 0-1
   * @returns {number|null}      Delta in seconds (+ = visitor behind ghost)
   */
  update(lapElapsed, playerTp) {
    if (!this._playing || !this.frames.length || !this.mesh) return null;

    // Advance frame pointer by elapsed time
    let i = this._frameI;
    while (i < this.frames.length - 2 && this.frames[i + 1].t <= lapElapsed) i++;
    this._frameI = i;

    const f0 = this.frames[i];
    const f1 = this.frames[Math.min(i + 1, this.frames.length - 1)];

    const alpha = (f1.t > f0.t) ? Math.min(1, (lapElapsed - f0.t) / (f1.t - f0.t)) : 0;
    const gx  = f0.x  + (f1.x  - f0.x)  * alpha;
    const gz  = f0.z  + (f1.z  - f0.z)  * alpha;
    const gfx = f0.fx + (f1.fx - f0.fx) * alpha;
    const gfz = f0.fz + (f1.fz - f0.fz) * alpha;

    this.mesh.position.set(gx, 0, gz);
    const fwdVec = new THREE.Vector3(gfx, 0, gfz);
    if (fwdVec.lengthSq() > 0.001) {
      this.mesh.quaternion.setFromUnitVectors(FWD_REF, fwdVec.normalize());
    }

    // Real-time delta: at the visitor's current track progress,
    // find what time the ghost was at that same position
    if (playerTp == null) return null;
    let lo = 0, hi = this.frames.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      this.frames[mid].tp <= playerTp ? (lo = mid) : (hi = mid);
    }
    return lapElapsed - this.frames[lo].t; // + = visitor behind ghost
  }

  getGhostLapMs() { return this.lapMs; }
}
