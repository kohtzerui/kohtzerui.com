/**
 * CarAudio — V6 Turbo Hybrid F1 engine synthesiser (Web Audio API).
 *
 * Physics basis: a 4-stroke V6 fires at  RPM/60 × 3  cylinders.
 *   Idle  ~3 000 RPM  →  150 Hz fundamental
 *   Cruise ~9 000 RPM  →  450 Hz fundamental  ← kept comfortable for sustained listening
 *
 * Signal chain:
 *
 *   ┌─ OSC1 sawtooth (fundamental 200–750 Hz) ─┐
 *   ├─ OSC2 sawtooth (3rd harmonic, "scream")  ─┤→ mix → WaveShaper ──→ BandPass ──→ HighPass ──→ Presence EQ ─┐
 *   └─ OSC3 square   (sub thump 0.5× fund.)   ─┘                                                               ├→ MasterGain → out
 *                                                                                                               │
 *   Turbo OSC (sine 2000–5500 Hz) → narrow BandPass → TurboGain ─────────────────────────────────────────────┘
 *
 *   Tyre squeal : looped noise → BandPass 1800 Hz
 *   Wind rush   : looped noise → HighPass 3500 Hz
 *   Exhaust pop : looped noise → dual BandPass (300 Hz body + 2 kHz crack) → fast ADSR on decel
 */
export class CarAudio {
  constructor() {
    this._ctx          = null;

    this._engOsc1      = null;   // fundamental
    this._engOsc2      = null;   // 3rd harmonic scream
    this._engOsc3      = null;   // sub thump
    this._turboOsc     = null;   // turbo whine

    this._engGain      = null;
    this._turboGain    = null;
    this._squealGain   = null;
    this._windGain     = null;
    this._crackleGain  = null;

    this._engBP        = null;   // swept bandpass
    this._turboFilter  = null;

    this._prevSpeed    = 0;
    this._crackleTimer = 0;      // frame cooldown between pops
    this._started      = false;
    this._beepBuffer   = null;   // decoded audio for the start-light beep
  }

  // ── Public API ─────────────────────────────────────────────────

  /** Must be called on a user gesture (button click) to unlock AudioContext. */
  start() {
    if (this._started) return;
    this._started = true;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._buildEngine();
    this._buildSqueal();
    this._buildWind();
    this._buildCrackle();
    this._loadBeep();   // pre-fetch and decode the beep audio
  }

  /**
   * Call every animation frame.
   * @param {number} speed      – current car speed, signed units/s
   * @param {number} maxSpeed   – physics constant (PHY.maxSpeed)
   * @param {number} turnInput  – steering input, -1..+1 (smoothed)
   */
  update(speed, maxSpeed, turnInput) {
    if (!this._ctx) return;
    if (this._ctx.state === 'suspended') this._ctx.resume();

    const t         = this._ctx.currentTime;
    const speedNorm = Math.min(Math.abs(speed) / maxSpeed, 1);   // 0..1
    const dSpeed    = speed - this._prevSpeed;                    // frame-to-frame delta
    this._prevSpeed = speed;

    // ── Firing frequency ─────────────────────────────────────────
    // RPM = 3 000 + 6 000 × speedNorm  →  3 000–9 000 RPM
    // firing freq = RPM / 60 × 3  →  150–450 Hz  (comfortable at sustained full throttle)
    const rpm  = 3000 + speedNorm * 6000;
    const fire = (rpm / 60) * 3;             // 150–450 Hz

    this._engOsc1.frequency.setTargetAtTime(fire,       t, 0.04);
    this._engOsc2.frequency.setTargetAtTime(fire * 1.5, t, 0.04);   // 2nd harmonic: 225–675 Hz (warm, not shrieky)
    this._engOsc3.frequency.setTargetAtTime(fire * 0.5, t, 0.06);   // sub: 75–225 Hz

    // ── Turbo spool ───────────────────────────────────────────────
    // Whine starts at 2 000 Hz (boost-off idle) and climbs to 5 500 Hz at full boost
    const turboFreq = 2000 + speedNorm * 3500;
    this._turboOsc.frequency.setTargetAtTime(turboFreq, t, 0.18);   // slow spool (turbo lag)
    this._turboFilter.frequency.setTargetAtTime(turboFreq, t, 0.18);

    // ── Engine volume ─────────────────────────────────────────────
    // Tiny idle hum → full scream at redline
    const engVol = 0.04 + speedNorm * 0.24;
    this._engGain.gain.setTargetAtTime(engVol, t, 0.05);

    // ── Bandpass sweep ────────────────────────────────────────────
    const bpFreq = Math.min(fire * 2, 1200);   // cap at 1200 Hz — prevents harshness
    this._engBP.frequency.setTargetAtTime(bpFreq, t, 0.07);
    this._engBP.Q.setTargetAtTime(0.5 + speedNorm * 0.8, t, 0.08);  // stays broad, not peaky

    // ── Turbo volume ──────────────────────────────────────────────
    // Inaudible below 25% speed, peaks at 100%
    const turboVol = Math.max(0, (speedNorm - 0.25) / 0.75) * 0.13;
    this._turboGain.gain.setTargetAtTime(turboVol, t, 0.2);

    // ── Tyre squeal ───────────────────────────────────────────────
    // Only active when cornering hard at speed
    const squealVol = Math.abs(turnInput) * speedNorm * speedNorm * 0.18;
    this._squealGain.gain.setTargetAtTime(squealVol, t, 0.07);

    // ── Wind rush ─────────────────────────────────────────────────
    const windVol = speedNorm * speedNorm * 0.05;
    this._windGain.gain.setTargetAtTime(windVol, t, 0.15);

    // ── Exhaust crackle on lift-off ───────────────────────────────
    // Fire a random pop when decelerating hard at speed (anti-lag effect)
    this._crackleTimer--;
    if (dSpeed < -0.28 && speedNorm > 0.35 && this._crackleTimer <= 0) {
      const vol = Math.min(1, -dSpeed / 2.5) * 0.3;
      this._crackleGain.gain.cancelScheduledValues(t);
      this._crackleGain.gain.setValueAtTime(vol, t);
      this._crackleGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + Math.random() * 0.05);
      this._crackleTimer = 4 + Math.floor(Math.random() * 9);  // 4–12 frame cooldown
    }
  }

  /** Fade everything out (finish line, overlay open). */
  stop() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    this._engGain.gain.setTargetAtTime(0,     t, 0.25);
    this._turboGain.gain.setTargetAtTime(0,   t, 0.55);   // turbo spools down slowly
    this._squealGain.gain.setTargetAtTime(0,  t, 0.12);
    this._windGain.gain.setTargetAtTime(0,    t, 0.25);
    this._crackleGain.gain.setTargetAtTime(0, t, 0.08);
  }

  /**
   * Play one F1 start-light beep using the real recorded audio file.
   * Falls back to a synthesised tone if the file hasn't loaded yet.
   */
  playLightBeep() {
    if (!this._ctx) return;
    const ctx = this._ctx;

    if (this._beepBuffer) {
      // Play the real recording
      const src = ctx.createBufferSource();
      src.buffer = this._beepBuffer;
      src.connect(ctx.destination);
      src.start(ctx.currentTime);
    } else {
      // Fallback: synthesised beep while file loads
      const t    = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.38, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 1320;
      o.connect(gain);
      gain.connect(ctx.destination);
      o.start(t); o.stop(t + 0.22);
    }
  }

  /** Pre-fetch and decode the beep audio file into a reusable AudioBuffer. */
  async _loadBeep() {
    try {
      const res  = await fetch('/start-beep.m4a');
      const data = await res.arrayBuffer();
      this._beepBuffer = await this._ctx.decodeAudioData(data);
    } catch (e) {
      console.warn('CarAudio: could not load start-beep.m4a, using synth fallback', e);
    }
  }

  /**
   * Play the lights-out GO sound (broadband burst + engine launch swell).
   * Triggered when all five lights go dark — signals the race start.
   */
  playLightsOut() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t   = ctx.currentTime;

    // ── Noise burst: crowd + tyre roar ───────────────────────────
    const noiseBuf = _noiseBuffer(ctx, 0.7);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    // Bandpass centred around ~700 Hz (crowd presence)
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.6;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    noiseSrc.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSrc.start(t);

    // ── Engine launch swell: sawtooth sweep 150 → 420 Hz ─────────
    const engOsc = ctx.createOscillator();
    engOsc.type = 'sawtooth';
    engOsc.frequency.setValueAtTime(150, t);
    engOsc.frequency.exponentialRampToValueAtTime(420, t + 0.55);

    const engShape = ctx.createWaveShaper();
    engShape.curve = _makeDistortionCurve(180);

    // HP to clean up the very bottom
    const engHP = ctx.createBiquadFilter();
    engHP.type = 'highpass';
    engHP.frequency.value = 90;

    const engGain = ctx.createGain();
    engGain.gain.setValueAtTime(0, t);
    engGain.gain.linearRampToValueAtTime(0.18, t + 0.04); // quick ramp-up
    engGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    engOsc.connect(engShape);
    engShape.connect(engHP);
    engHP.connect(engGain);
    engGain.connect(ctx.destination);
    engOsc.start(t);
    engOsc.stop(t + 0.75);
  }

  // ── Builders ────────────────────────────────────────────────────

  _buildEngine() {
    const ctx = this._ctx;

    // Three oscillators
    this._engOsc1 = ctx.createOscillator();
    this._engOsc1.type = 'sawtooth';
    this._engOsc1.frequency.value = 200;

    this._engOsc2 = ctx.createOscillator();
    this._engOsc2.type = 'sawtooth';
    this._engOsc2.frequency.value = 600;

    this._engOsc3 = ctx.createOscillator();
    this._engOsc3.type = 'square';
    this._engOsc3.frequency.value = 100;

    // Turbo whine (sine — clean, pure whine quality)
    this._turboOsc = ctx.createOscillator();
    this._turboOsc.type = 'sine';
    this._turboOsc.frequency.value = 2000;

    // Mix: blend the three engine oscs equally
    const oscMix = ctx.createGain();
    oscMix.gain.value = 1 / 3;

    // Heavy waveshaper distortion — generates the dense harmonic cloud
    // that gives F1 engines their metallic, complex texture
    const shaper = ctx.createWaveShaper();
    shaper.curve      = _makeDistortionCurve(320);
    shaper.oversample = '4x';

    // Swept bandpass — tracks firing frequency × 2, bringing out the scream
    this._engBP = ctx.createBiquadFilter();
    this._engBP.type = 'bandpass';
    this._engBP.frequency.value = 500;
    this._engBP.Q.value = 0.7;

    // Highpass at 80 Hz — removes muddy sub rumble (F1 cars sound "tight")
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;
    hp.Q.value = 0.5;

    // Presence peak at 800 Hz — gentle bite without harshness
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 800;
    presence.gain.value = 5;       // was 10 dB — halved
    presence.Q.value = 1.2;

    // High-shelf CUT above 1.5 kHz — tames sustained high-speed harshness
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 1500;
    shelf.gain.value = -8;         // roll off the top end

    // Dynamics compressor — soft-limits the output so full-throttle
    // cruise never gets strident; threshold set conservatively
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;    // dB
    comp.knee.value      =  10;
    comp.ratio.value     =   4;
    comp.attack.value    = 0.003;
    comp.release.value   = 0.25;

    // Turbo signal path
    this._turboFilter = ctx.createBiquadFilter();
    this._turboFilter.type = 'bandpass';
    this._turboFilter.frequency.value = 2000;
    this._turboFilter.Q.value = 8;

    this._turboGain = ctx.createGain();
    this._turboGain.gain.value = 0;

    this._engGain = ctx.createGain();
    this._engGain.gain.value = 0;

    // Engine path: oscs → mix → shaper → BP → HP → presence → shelf → comp → master
    this._engOsc1.connect(oscMix);
    this._engOsc2.connect(oscMix);
    this._engOsc3.connect(oscMix);
    oscMix.connect(shaper);
    shaper.connect(this._engBP);
    this._engBP.connect(hp);
    hp.connect(presence);
    presence.connect(shelf);
    shelf.connect(comp);
    comp.connect(this._engGain);

    // Turbo path (parallel, sums into master gain)
    this._turboOsc.connect(this._turboFilter);
    this._turboFilter.connect(this._turboGain);
    this._turboGain.connect(this._engGain);

    this._engGain.connect(ctx.destination);

    this._engOsc1.start();
    this._engOsc2.start();
    this._engOsc3.start();
    this._turboOsc.start();
  }

  _buildSqueal() {
    const ctx = this._ctx;
    const buf = _noiseBuffer(ctx, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 18;

    this._squealGain = ctx.createGain();
    this._squealGain.gain.value = 0;

    src.connect(bp); bp.connect(this._squealGain);
    this._squealGain.connect(ctx.destination);
    src.start();
  }

  _buildWind() {
    const ctx = this._ctx;
    const buf = _noiseBuffer(ctx, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    hp.Q.value = 0.5;

    this._windGain = ctx.createGain();
    this._windGain.gain.value = 0;

    src.connect(hp); hp.connect(this._windGain);
    this._windGain.connect(ctx.destination);
    src.start();
  }

  _buildCrackle() {
    const ctx = this._ctx;
    // Short noise burst for pops (0.15 s, looped)
    const buf = _noiseBuffer(ctx, 0.15);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;

    // Low body thump component
    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 280;
    bp1.Q.value = 3;

    // High crack component
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 2200;
    bp2.Q.value = 6;

    const mix = ctx.createGain();
    mix.gain.value = 0.5;

    this._crackleGain = ctx.createGain();
    this._crackleGain.gain.value = 0;

    src.connect(bp1); src.connect(bp2);
    bp1.connect(mix); bp2.connect(mix);
    mix.connect(this._crackleGain);
    this._crackleGain.connect(ctx.destination);
    src.start();
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Soft-clip asymmetric distortion.
 * Higher `amount` → denser harmonic spectrum (more "metallic").
 */
function _makeDistortionCurve(amount) {
  const n     = 512;
  const curve = new Float32Array(n);
  const k     = amount;
  for (let i = 0; i < n; i++) {
    const x  = (i * 2) / n - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/** White-noise buffer of `seconds` duration. */
function _noiseBuffer(ctx, seconds) {
  const len = Math.ceil(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
