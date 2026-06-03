/**
 * HUD — lap timer, speed bar, ghost delta indicator.
 */
export class HUD {
  constructor() {
    this.timerEl    = document.getElementById('timer-display');
    this.speedBar   = document.getElementById('speed-bar');
    this.speedVal   = document.getElementById('speed-value');
    this.ghostEl    = document.getElementById('ghost-delta');
    this._startMs   = null;
    this._running   = false;
    this._lapMs     = 0;
  }

  start() {
    this._startMs = performance.now();
    this._running = true;
    this._lapMs   = 0;
    if (this.ghostEl) this.ghostEl.textContent = '';
  }

  /** Stop the lap timer and return elapsed milliseconds. */
  stopLap() {
    if (!this._running) return this._lapMs;
    this._lapMs   = performance.now() - this._startMs;
    this._running = false;
    return this._lapMs;
  }

  /** Display end-of-lap result. isNewBest=bool, deltaMs=number|null */
  showLapResult(lapMs, isNewBest, deltaMs) {
    if (!this.ghostEl) return;
    if (isNewBest) {
      this.ghostEl.textContent = '🏆 NEW BEST!';
      this.ghostEl.className   = 'ghost-delta best';
    } else if (deltaMs !== null) {
      const sign = deltaMs >= 0 ? '+' : '−';
      const abs  = Math.abs(deltaMs);
      const s    = Math.floor(abs / 1000);
      const ms   = Math.floor(abs % 1000);
      this.ghostEl.textContent = `${sign}${s}.${String(ms).padStart(3,'0')}s`;
      this.ghostEl.className   = `ghost-delta ${deltaMs >= 0 ? 'behind' : 'ahead'}`;
    }
  }

  /**
   * Show real-time ghost delta every frame.
   * delta: seconds (positive = behind ghost, negative = ahead of ghost).
   */
  showGhostDelta(delta) {
    if (!this.ghostEl || delta === null) return;
    const sign = delta >= 0 ? '+' : '−';
    const abs  = Math.abs(delta);
    const s    = Math.floor(abs);
    const ms   = Math.floor((abs - s) * 1000);
    const str  = `${sign}${s}.${String(ms).padStart(3,'0')}s`;
    this.ghostEl.textContent = str;
    this.ghostEl.className   = `ghost-delta ${delta >= 0 ? 'behind' : 'ahead'}`;
  }

  /** speed in game units/s, maxSpeed for bar percentage. */
  update(speed, maxSpeed) {
    if (this._running) {
      const ms = performance.now() - this._startMs;
      this.timerEl.textContent = this._fmt(ms);
    }
    const pct = Math.min(Math.abs(speed) / maxSpeed, 1) * 100;
    this.speedBar.style.width = `${pct}%`;
    const kmh = Math.round(Math.abs(speed) * 3.6);
    this.speedVal.textContent = `${kmh} km/h`;
  }

  _fmt(ms) {
    const m   = Math.floor(ms / 60000);
    const s   = Math.floor((ms % 60000) / 1000);
    const mil = Math.floor(ms % 1000);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(mil).padStart(3,'0')}`;
  }
}
