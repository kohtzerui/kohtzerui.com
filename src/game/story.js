import { STORY_ZONES, FINISH_T, FINISH_RADIUS } from './circuit.js';

/**
 * StorySystem — voice-over narration + finish screen.
 *
 * Zones trigger Web Speech API (browser TTS) narration as the car passes.
 * When real .mp3 voice lines are ready, drop them into public/audio/<zoneId>.mp3
 * and the system will automatically prefer audio files over TTS.
 *
 * Pit stop cards have been removed — the narrative flows uninterrupted.
 */
export class StorySystem {
  constructor(curve) {
    this.curve = curve;

    // Pre-compute 3D positions for each zone
    this.zonePositions  = STORY_ZONES.map(z => curve.getPoint(z.t));
    this.finishPosition = curve.getPoint(FINISH_T);

    // DOM refs
    this.contactScreen = document.getElementById('contact-screen');
    this.contactClose  = document.getElementById('contact-close');
    this.sectorDisplay = document.getElementById('sector-display');

    this.triggered   = new Set();
    this.contactOpen = false;

    // Active audio (so we can stop previous clip on new zone)
    this._activeAudio  = null;
    this._activeSpeech = null;

    // Event bindings
    this.contactClose.addEventListener('click', () => this.closeContact());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.contactOpen) this.closeContact();
    });
  }

  /** Call every frame with current car world position (THREE.Vector3). */
  update(carPos) {
    if (this.contactOpen) return;

    // — Story narration zones —
    STORY_ZONES.forEach((zone, i) => {
      if (this.triggered.has(zone.id)) return;
      const dist = carPos.distanceTo(this.zonePositions[i]);
      if (dist < 18) {
        this.triggered.add(zone.id);
        this.sectorDisplay.textContent = zone.sector;
        this._speak(zone.id, zone.text);
      }
    });

    // — Finish line —
    if (!this.triggered.has('finish')) {
      const dist = carPos.distanceTo(this.finishPosition);
      if (dist < FINISH_RADIUS) {
        this.triggered.add('finish');
        this._stopSpeech();
        this.showContact();
      }
    }
  }

  // ── Voice-over: prefer .mp3 file, fall back to Web Speech API ────
  _speak(id, text) {
    this._stopSpeech();
    const audioPath = `/audio/${id}.mp3`;

    // Try loading the .mp3 file first
    const audio = new Audio(audioPath);
    audio.addEventListener('canplaythrough', () => {
      this._activeAudio = audio;
      audio.play().catch(() => this._tts(text)); // fallback if blocked
    }, { once: true });
    audio.addEventListener('error', () => {
      // File doesn't exist yet — use browser TTS
      this._tts(text);
    }, { once: true });
    audio.load();
  }

  _tts(text) {
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate  = 0.92;
    utt.pitch = 1.0;
    utt.lang  = 'en-GB';
    // Pick a pleasant voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
                   || voices.find(v => v.lang.startsWith('en'))
                   || null;
    if (preferred) utt.voice = preferred;
    this._activeSpeech = utt;
    window.speechSynthesis.speak(utt);
  }

  _stopSpeech() {
    if (this._activeAudio) {
      this._activeAudio.pause();
      this._activeAudio = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this._activeSpeech = null;
    }
  }

  showContact() {
    this.contactOpen = true;
    this.contactScreen.classList.remove('hidden');
  }

  closeContact() {
    this.contactOpen = false;
    this.contactScreen.classList.add('hidden');
    this.triggered.clear();
    window.dispatchEvent(new CustomEvent('lap-restart'));
  }

  /** Returns true if a full-screen overlay is blocking gameplay. */
  isBlocking() {
    return this.contactOpen;
  }
}
