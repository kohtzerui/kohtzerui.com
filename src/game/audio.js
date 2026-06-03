/**
 * CarAudio — procedural car sound engine via Web Audio API.
 *
 * Sounds synthesised entirely in-browser (no audio files needed):
 *
 *   Engine   — two detuned sawtooth oscillators fed through a WaveShaper
 *               (soft distortion) and a sweepable low-pass filter.
 *               Pitch and volume track speed; filter opens at high revs.
 *
 *   Tyre squeal — looped white-noise buffer through a tight bandpass filter
 *               (~1800 Hz). Volume = |turnInput| × speed² so it only
 *               screams when cornering hard and fast.
 *
 *   Wind       — high-frequency noise that rises with speed.
 *
 * Usage:
 *   const audio = new CarAudio();
 *   audio.start();                               // call on first user gesture
 *   audio.update(speed, maxSpeed, turnInput);    // call every frame
 *   audio.stop();                                // fade everything out
 */
export class CarAudio {
  constructor() {
    this._ctx           = null;

    // Engine
    this._engOsc1       = null;  // fundamental
    this._engOsc2       = null;  // octave
    this._engOsc3       = null;  // sub-bass thump
    this._engFilter     = null;
    this._engGain       = null;

    // Tyre squeal
    this._squealGain    = null;

    // Wind
    this._windGain      = null;

    this._started       = false;
  }

  // ── Public API ──────────────────────────────────────────────────

  /** Call once on any user-gesture (e.g. start-button click). */
  start() {
    if (this._started) return;
    this._started = true;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._buildEngine();
    this._buildSqueal();
    this._buildWind();
  }

  /**
   * Call every animation frame.
   * @param {number} speed      - current car speed (signed, units/s)
   * @param {number} maxSpeed   - physics max speed constant
   * @param {number} turnInput  - steering input smoothed, range -1..+1
   */
  update(speed, maxSpeed, turnInput) {
    if (!this._ctx) return;
    if (this._ctx.state === 'suspended') this._ctx.resume();

    const t         = this._ctx.currentTime;
    const speedNorm = Math.min(Math.abs(speed) / maxSpeed, 1);   // 0..1
    const moving    = speedNorm > 0.015;

    // ── Engine pitch (Hz): 55 Hz idle → 230 Hz flat-out ───────────
    const freq1 = 55  + speedNorm * 175;
    const freq2 = 110 + speedNorm * 350;   // octave + small detune
    const freq3 = 28  + speedNorm * 55;    // sub thump

    this._engOsc1.frequency.setTargetAtTime(freq1,      t, 0.06);
    this._engOsc2.frequency.setTargetAtTime(freq2 + 3,  t, 0.06);  // slight detune
    this._engOsc3.frequency.setTargetAtTime(freq3,      t, 0.08);

    // ── Engine volume ──────────────────────────────────────────────
    // Idle hum when stationary, louder as speed builds
    const engVol = moving ? 0.08 + speedNorm * 0.28 : 0.05;
    this._engGain.gain.setTargetAtTime(engVol, t, 0.12);

    // ── Filter sweep: closed at idle, opens with revs ─────────────
    const filterFreq = 300 + speedNorm * 1800;
    this._engFilter.frequency.setTargetAtTime(filterFreq, t, 0.1);
    this._engFilter.Q.setTargetAtTime(1.5 + speedNorm * 2, t, 0.1);

    // ── Tyre squeal ────────────────────────────────────────────────
    // Only screams when cornering hard AND moving fast
    const squealAmt = Math.abs(turnInput) * speedNorm * speedNorm;
    const squealVol = squealAmt * 0.18;
    this._squealGain.gain.setTargetAtTime(squealVol, t, 0.07);

    // ── Wind ───────────────────────────────────────────────────────
    const windVol = speedNorm * speedNorm * 0.06;
    this._windGain.gain.setTargetAtTime(windVol, t, 0.15);
  }

  /** Fade everything out (e.g. when contact screen opens). */
  stop() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    this._engGain.gain.setTargetAtTime(0,    t, 0.4);
    this._squealGain.gain.setTargetAtTime(0, t, 0.2);
    this._windGain.gain.setTargetAtTime(0,   t, 0.4);
  }

  // ── Internal builders ───────────────────────────────────────────

  _buildEngine() {
    const ctx = this._ctx;

    // Three oscillators for a richer engine timbre
    this._engOsc1 = ctx.createOscillator();
    this._engOsc1.type = 'sawtooth';
    this._engOsc1.frequency.value = 55;

    this._engOsc2 = ctx.createOscillator();
    this._engOsc2.type = 'sawtooth';
    this._engOsc2.frequency.value = 113;  // octave + small detune

    this._engOsc3 = ctx.createOscillator();
    this._engOsc3.type = 'square';
    this._engOsc3.frequency.value = 28;   // sub-bass thump

    // Soft distortion (gives harmonics / growl)
    const shaper = ctx.createWaveShaper();
    shaper.curve   = _makeDistortionCurve(60);
    shaper.oversample = '4x';

    // Master filter
    this._engFilter = ctx.createBiquadFilter();
    this._engFilter.type = 'lowpass';
    this._engFilter.frequency.value = 300;
    this._engFilter.Q.value = 1.5;

    // Gain
    this._engGain = ctx.createGain();
    this._engGain.gain.value = 0;

    // Wire: oscs → shaper → filter → gain → out
    this._engOsc1.connect(shaper);
    this._engOsc2.connect(shaper);
    this._engOsc3.connect(shaper);
    shaper.connect(this._engFilter);
    this._engFilter.connect(this._engGain);
    this._engGain.connect(ctx.destination);

    this._engOsc1.start();
    this._engOsc2.start();
    this._engOsc3.start();
  }

  _buildSqueal() {
    const ctx = this._ctx;

    // Looped white-noise buffer (2 seconds)
    const sr     = ctx.sampleRate;
    const buf    = ctx.createBuffer(1, sr * 2, sr);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    src.loop     = true;

    // Tight bandpass around tyre-squeal register
    const bp     = ctx.createBiquadFilter();
    bp.type      = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value   = 18;

    this._squealGain = ctx.createGain();
    this._squealGain.gain.value = 0;

    src.connect(bp);
    bp.connect(this._squealGain);
    this._squealGain.connect(ctx.destination);
    src.start();
  }

  _buildWind() {
    const ctx = this._ctx;

    const sr   = ctx.sampleRate;
    const buf  = ctx.createBuffer(1, sr * 3, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    src.buffer = buf;
    src.loop   = true;

    // High-shelf — let only high frequencies through as "wind rush"
    const hp   = ctx.createBiquadFilter();
    hp.type    = 'highpass';
    hp.frequency.value = 4000;
    hp.Q.value = 0.5;

    this._windGain = ctx.createGain();
    this._windGain.gain.value = 0;

    src.connect(hp);
    hp.connect(this._windGain);
    this._windGain.connect(ctx.destination);
    src.start();
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Soft-clip distortion curve — gives the engine its harmonic growl. */
function _makeDistortionCurve(amount) {
  const n     = 512;
  const curve = new Float32Array(n);
  const k     = amount;
  for (let i = 0; i < n; i++) {
    const x   = (i * 2) / n - 1;
    curve[i]  = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}
