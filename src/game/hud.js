/**
 * HUD — lap timer (count up), speed bar, speed readout.
 */
export class HUD {
  constructor() {
    this.timerEl  = document.getElementById('timer-display');
    this.speedBar = document.getElementById('speed-bar');
    this.speedVal = document.getElementById('speed-value');
    this._startMs = null;
    this._running = false;
  }

  start() {
    this._startMs = performance.now();
    this._running = true;
  }

  /** speed in game units/s, maxSpeed for bar percentage. */
  update(speed, maxSpeed) {
    // Timer
    if (this._running) {
      const ms = performance.now() - this._startMs;
      this.timerEl.textContent = this._fmt(ms);
    }

    // Speed bar
    const pct = Math.min(Math.abs(speed) / maxSpeed, 1) * 100;
    this.speedBar.style.width = `${pct}%`;

    // Speed in km/h (1 unit/s * scale factor ≈ 18 km/h feels right)
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
