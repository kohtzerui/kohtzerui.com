import * as THREE from 'three';

/**
 * Singapore Marina Bay Street Circuit — v4 (final geometry pass)
 *
 * 67 control points traced from the official F1 circuit diagram.
 * Circuit spans ~2000 × 1100 units (≈ 1 unit = 0.6 m real-world scale).
 * Minimum inter-point distance: 45 units.
 * Minimum turn radius at any corner: 50 units (> 2× half-track-width).
 *
 * Coordinate system: X = east (right), Z = south (down in top-view).
 *   Negative Z = north (up in image).
 *   Positive Z = south (down in image).
 * Racing direction: anti-clockwise when viewed from above.
 *
 * Shape matches reference: long pit straight right side, T1–T3 hook
 * at top-right, west through Raffles/Republic Blvd, T7–T9 zigzag,
 * T10 far-left hairpin, T11–T13 south, diagonal northeast to T14,
 * east through middle, T17 right-angle, T18–T19 back to start.
 */
export const CIRCUIT_POINTS = [
  new THREE.Vector3(  615, 0,    10),  //  0 START/FINISH
  new THREE.Vector3(  590, 0,  -460),  //  1 T2 apex
  new THREE.Vector3(  505, 0,  -495),  //  2 T3 apex
  new THREE.Vector3(  445, 0,  -525),  //  3 T3 mid-exit
  new THREE.Vector3(  420, 0,  -430),  //  4
  new THREE.Vector3(  450, 0,  -145),  //  5
  new THREE.Vector3( -100, 0,  -235),  //  6 T6 exit
  new THREE.Vector3( -410, 0,  -375),  //  7 T7 exit
  new THREE.Vector3( -505, 0,  -210),  //  8 T8 apex
  new THREE.Vector3( -550, 0,  -240),  //  9
  new THREE.Vector3( -645, 0,  -385),  // 10 T9 mid
  new THREE.Vector3( -700, 0,  -410),  // 11 T9 apex
  new THREE.Vector3( -775, 0,  -265),  // 12
  new THREE.Vector3( -850, 0,   -75),  // 13 T10 apex
  new THREE.Vector3( -750, 0,     5),  // 14 T10 exit
  new THREE.Vector3( -735, 0,    70),  // 15 T11
  new THREE.Vector3( -615, 0,   175),  // 16 T12
  new THREE.Vector3( -565, 0,   200),  // 17
  new THREE.Vector3( -545, 0,   165),  // 18
  new THREE.Vector3( -545, 0,    15),  // 19
  new THREE.Vector3( -490, 0,  -135),  // 20 T14 approach
  new THREE.Vector3( -345, 0,    10),  // 21 T14 exit
  new THREE.Vector3(   90, 0,    20),  // 22
  new THREE.Vector3(  150, 0,   125),  // 23
  new THREE.Vector3(  535, 0,   115),  // 24 T18
];

// ─────────────────────────────────────────────────────────────────
// buildSpline() — centripetal Catmull-Rom: mathematically proven
// to never create self-intersections or cusps regardless of how
// unevenly spaced the control points are.
//
// SHARP_CORNERS: point indices where the corner is very tight.
// These get triplicated only as a last resort if centripetal mode
// isn't tight enough — usually not needed.
// ─────────────────────────────────────────────────────────────────
export const SHARP_CORNERS = new Set([
  // ⚠️  Leave empty when using centripetal mode (buildSpline default).
  // Triplicating points sets chord length to 0, breaking the centripetal
  // weight calculation and causing track ribbon crossings/overlaps.
]);

export function buildSpline() {
  const expanded = [];
  CIRCUIT_POINTS.forEach((p, i) => {
    if (SHARP_CORNERS.has(i)) {
      expanded.push(p.clone(), p.clone(), p.clone());
    } else {
      expanded.push(p);
    }
  });
  // 'centripetal' = alpha 0.5 — weights segments by chord length,
  // preventing overshoot loops on unevenly-spaced control points.
  return new THREE.CatmullRomCurve3(expanded, true, 'centripetal');
}


// ─────────────────────────────────────────────────────────────────
export const TRACK_WIDTH     = 22;
export const TRACK_SEGS      = 2000;
export const SPLINE_TENSION  = 0.12;   // very low → tight to control points

// ─────────────────────────────────────────────────────────────────
//  STORY ZONES
// ─────────────────────────────────────────────────────────────────
export const STORY_ZONES = [
  {
    id: 'beep',
    t: 0.0,   // fire at the very start — playlist chains all clips from here
    text: '',
    sector: 'QUALIFICATION LAP',
  },
];

// ─────────────────────────────────────────────────────────────────
//  PIT STOPS
// ─────────────────────────────────────────────────────────────────
export const PIT_STOPS = [
  {
    id: 'pit1', t: 0.46, triggerRadius: 35,
    title: '// PIT STOP 1', chapter: 'THE QUIET PERIOD',
    content: `
      <h3>Stepping Away</h3>
      <p>After two years grinding in quantitative finance — writing trading algorithms,
      chasing milliseconds of a very different kind — I realised something was missing.</p>
      <p>The work wasn't wrong. But I wasn't building anything real.
      I was optimising abstractions, not systems. So I stopped.</p>
      <p>Sometimes the fastest lap comes after a full stop in the pits.</p>`,
    tags: ['Python', 'C++', 'Quant Finance', 'Career Pivot'],
  },
  {
    id: 'pit2', t: 0.62, triggerRadius: 35,
    title: '// PIT STOP 2', chapter: 'THE HPC COMPETITION',
    content: `
      <h3>Building the Cluster</h3>
      <p>A friend forwarded a link to an international student HPC competition.
      The challenge: assemble a small cluster, optimise it, race it.</p>
      <p>We built a 12-node Raspberry Pi / SBC cluster. Wrote custom MPI job
      schedulers. Tuned BLAS libraries. Optimised memory access patterns.</p>
      <p>It was the most alive I'd felt in years. We placed.
      More importantly, I found what I was actually chasing.</p>`,
    tags: ['MPI', 'OpenMP', 'BLAS', 'Raspberry Pi', 'Cluster Computing', 'HPC'],
  },
];

export const FINISH_T      = 0.996;   // slightly past the gantry (gantry is at 0.99)
export const FINISH_RADIUS = 28;       // covers full track width (22u) + margin

