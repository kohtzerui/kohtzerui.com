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
    // Finish line is a line perpendicular to the track tangent
    this.finishTangent  = curve.getTangent(FINISH_T).normalize();
    this._finishSide    = null;   // sign of last frame's dot product
    this._finishArmed   = false;  // only armed once car leaves the start area

    // DOM refs
    this.contactScreen = document.getElementById('contact-screen');
    this.contactClose  = document.getElementById('contact-close');
    this.sectorDisplay = document.getElementById('sector-display');

    this.triggered   = new Set();
    this.contactOpen = false;

    // Voiceover subtitle card
    this.voCard = document.getElementById('voiceover-card');
    this._cardTimer = null;

    // Active audio
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

    // — Finish line (line-crossing check) —
    if (!this.triggered.has('finish')) {
      // Arm the finish after the car has passed the first story zone
      if (!this._finishArmed && this.triggered.has(STORY_ZONES[0].id)) {
        this._finishArmed = true;
        this._finishSide  = null;  // reset side so first frame doesn't false-trigger
      }

      if (this._finishArmed) {
        // Project car position onto the finish tangent
        const dx   = carPos.x - this.finishPosition.x;
        const dz   = carPos.z - this.finishPosition.z;
        const side = dx * this.finishTangent.x + dz * this.finishTangent.z;

        // Also check car is laterally within the track (not on the other straight)
        const latX = dz * this.finishTangent.x - dx * this.finishTangent.z; // perp dist
        const withinTrack = Math.abs(latX) < FINISH_RADIUS;

        if (withinTrack && this._finishSide !== null && Math.sign(side) !== Math.sign(this._finishSide)) {
          this.triggered.add('finish');
          this._stopSpeech();
          window.dispatchEvent(new CustomEvent('lap-complete'));
          this.showContact();
        }
        this._finishSide = side;
      }
    }
  }

  // ── Voice-over: prefer .mp3 file, fall back to Web Speech API ────
  _speak(id, text) {
    this._stopSpeech();
    this._showCard(text);
    const audioPath = `/audio/${id}.mp3`;
    const audio = new Audio(audioPath);
    audio.addEventListener('canplaythrough', () => {
      this._activeAudio = audio;
      audio.play().catch(() => this._tts(text));
    }, { once: true });
    audio.addEventListener('error', () => this._tts(text), { once: true });
    audio.load();
  }

  _showCard(text) {
    if (!this.voCard) return;
    clearTimeout(this._cardTimer);
    this.voCard.textContent = text;
    this.voCard.classList.remove('hidden');
    // Hold for 4 seconds then fade out
    this._cardTimer = setTimeout(() => {
      this.voCard.classList.add('hidden');
    }, 4000);
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
    this.reset();
    window.dispatchEvent(new CustomEvent('lap-restart'));
  }

  /** Reset all triggered zones (call at start of each new lap). */
  reset() {
    this.triggered.clear();
    this._stopSpeech();
    this._finishArmed = false;
    this._finishSide  = null;
    if (this.voCard) this.voCard.classList.add('hidden');
  }

  /** Returns true if a full-screen overlay is blocking gameplay. */
  isBlocking() {
    return this.contactOpen;
  }
}
