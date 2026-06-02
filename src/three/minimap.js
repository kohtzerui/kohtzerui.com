import * as THREE from 'three';
import { buildSpline, TRACK_SEGS } from '../game/circuit.js';

/**
 * 2D canvas minimap — top-down view of the Singapore GP circuit.
 *
 * Draws from the actual CatmullRomCurve3 spline (300 samples),
 * not just the sparse control points, so the shape is accurate.
 * Sector colours match the F1 broadcast convention:
 *   Sector 1 = red (T1-T7),  Sector 2 = blue (T8-T13),  Sector 3 = yellow (T14-T19)
 */
export class Minimap {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.W      = this.canvas.width;   // 280
    this.H      = this.canvas.height;  // 175
    this.pad    = 14;

    // ── Build sampled points from the spline ────────────────────
    const SAMPLES = 300;
    const curve   = buildSpline();
    this._pts     = [];
    for (let i = 0; i < SAMPLES; i++) {
      this._pts.push(curve.getPoint(i / SAMPLES));
    }

    // ── Bounding box of sampled points ──────────────────────────
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    this._pts.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    });

    // Scale uniformly to fit the canvas, preserving aspect ratio
    const scaleX = (this.W - this.pad * 2) / (maxX - minX);
    const scaleZ = (this.H - this.pad * 2) / (maxZ - minZ);
    this._scale  = Math.min(scaleX, scaleZ);

    const trackW = (maxX - minX) * this._scale;
    const trackH = (maxZ - minZ) * this._scale;
    this._offX   = this.pad + (this.W - this.pad * 2 - trackW) / 2;
    this._offZ   = this.pad + (this.H - this.pad * 2 - trackH) / 2;
    this._minX   = minX;
    this._minZ   = minZ;

    // ── Pre-draw static track into an offscreen canvas ──────────
    this._trackCanvas = document.createElement('canvas');
    this._trackCanvas.width  = this.W;
    this._trackCanvas.height = this.H;
    this._preDrawTrack();
  }

  /** Convert world (x, z) → minimap pixel */
  _toMap(x, z) {
    return {
      mx: (x - this._minX) * this._scale + this._offX,
      mz: (z - this._minZ) * this._scale + this._offZ,
    };
  }

  /** Draw the circuit outline once into the offscreen canvas */
  _preDrawTrack() {
    const ctx  = this._trackCanvas.getContext('2d');
    const n    = this._pts.length;

    // Thin shadow/glow backdrop
    ctx.save();
    ctx.lineWidth   = 5;
    ctx.strokeStyle = 'rgba(0,255,204,0.12)';
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    this._pts.forEach((p, i) => {
      const { mx, mz } = this._toMap(p.x, p.z);
      i === 0 ? ctx.moveTo(mx, mz) : ctx.lineTo(mx, mz);
    });
    const first = this._toMap(this._pts[0].x, this._pts[0].z);
    ctx.lineTo(first.mx, first.mz);
    ctx.stroke();
    ctx.restore();

    // Sector colour segments (sector boundaries at t ≈ 0.38, 0.66)
    const sectors = [
      { start: 0,    end: Math.floor(n * 0.38), color: 'rgba(255,60,60,0.75)'  },  // S1 red
      { start: Math.floor(n * 0.38), end: Math.floor(n * 0.66), color: 'rgba(100,180,255,0.75)' }, // S2 blue
      { start: Math.floor(n * 0.66), end: n - 1, color: 'rgba(255,220,50,0.75)' }, // S3 yellow
    ];

    sectors.forEach(({ start, end, color }) => {
      ctx.save();
      ctx.lineWidth   = 2;
      ctx.strokeStyle = color;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      for (let i = start; i <= end; i++) {
        const p = this._pts[i];
        const { mx, mz } = this._toMap(p.x, p.z);
        i === start ? ctx.moveTo(mx, mz) : ctx.lineTo(mx, mz);
      }
      // Join last sector back to start
      if (end === n - 1) {
        const { mx, mz } = this._toMap(this._pts[0].x, this._pts[0].z);
        ctx.lineTo(mx, mz);
      }
      ctx.stroke();
      ctx.restore();
    });

    // Start/Finish tick mark
    const sf  = this._toMap(this._pts[0].x, this._pts[0].z);
    const sf2 = this._toMap(this._pts[1].x, this._pts[1].z);
    const ang = Math.atan2(sf2.mz - sf.mz, sf2.mx - sf.mx) + Math.PI / 2;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(sf.mx + Math.cos(ang) * 5, sf.mz + Math.sin(ang) * 5);
    ctx.lineTo(sf.mx - Math.cos(ang) * 5, sf.mz - Math.sin(ang) * 5);
    ctx.stroke();
    ctx.restore();
  }

  draw(carPos) {
    const { ctx, W, H } = this;

    // Clear and composite pre-drawn track
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this._trackCanvas, 0, 0);

    // ── Car dot ──────────────────────────────────────────────────
    const { mx, mz } = this._toMap(carPos.x, carPos.z);

    // Outer glow
    const grad = ctx.createRadialGradient(mx, mz, 0, mx, mz, 9);
    grad.addColorStop(0, 'rgba(0,255,204,0.9)');
    grad.addColorStop(1, 'rgba(0,255,204,0)');
    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(mx, mz, 9, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright dot
    ctx.beginPath();
    ctx.fillStyle = '#00ffcc';
    ctx.arc(mx, mz, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // White centre pinpoint
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(mx, mz, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
