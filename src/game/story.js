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
    this._narrateEnabled = true;   // false during player laps — zones still track, no audio/text

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

  /** Call every frame with current car world position (THREE.Vector3).
   *  @param {THREE.Vector3} carPos
   *  @param {boolean} checkFinish - set false during cinematic to prevent ghost crossing triggering contact screen
   */
  update(carPos, checkFinish = true) {
    if (this.contactOpen) return;

    // — Story narration zones —
    STORY_ZONES.forEach((zone, i) => {
      if (this.triggered.has(zone.id)) return;
      const dist = carPos.distanceTo(this.zonePositions[i]);
      if (dist < 18) {
        this.triggered.add(zone.id);
        if (this._narrateEnabled) {
          this.sectorDisplay.textContent = zone.sector;
          this._speak(zone.id, zone.text);
        }
      }
    });

    // — Finish line (line-crossing check) —
    if (checkFinish && !this.triggered.has('finish')) {
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

  // ── Voice-over playlist ───────────────────────────────────────────
  // Clips play back-to-back, chained via 'ended' events.
  // Triggered once by the beep zone; no further position zones needed.
  static get PLAYLIST() {
    return [
      { id: 'beep', sector: 'QUALIFICATION LAP',           text: '' },
      { id: 'set1', sector: 'SECTOR 1 — THE INTRODUCTION', text: "Welcome drivers. Qualification lap, type — Portfolio. Track — Singapore, Marina Bay. I'm Koh Tze Rui, your computer engineer from NUS, and I'll be your guide for today." },
      { id: 'set2', sector: 'SECTOR 2 — THE PHILOSOPHY',   text: "My professor told me a while back that HPC is the F1 of computing — chasing incremental improvements. Having the fastest car doesn't guarantee the win. It's about how you tune the engine and adapt to the track." },
      { id: 'set3', sector: 'SECTOR 3 — THE COMPETITION',  text: "My first HPC competition was the Single Board Cluster Competition — we placed 1st internationally. I love the addiction of seeing my benchmark score increase with every change, and the curiosity when it falls. That's when I realised I was addicted to system optimisation." },
      { id: 'set4', sector: 'SECTOR 4 — THE PROJECTS',     text: "Naturally, in my own time, I tried all forms of optimisation — kernel, hardware, software. This inspired physical projects: CUDA, Linux Kernel, FPGAs. The HPC full stack, all whilst taking courses to improve myself." },
      { id: 'set5', sector: 'FINAL STRAIGHT — THE INVITATION', text: "I hope you learned something about me during this lap. Are you ready to race?" },
    ];
  }

  _startPlaylist(startIndex = 0) {
    const clip = StorySystem.PLAYLIST[startIndex];
    if (!clip) return;

    this._stopSpeech();
    this.sectorDisplay.textContent = clip.sector;
    if (clip.text) this._showCard(clip.text);

    const audio = new Audio(`/audio/${clip.id}.m4a`);
    this._activeAudio = audio;

    // Chain next clip when this one ends.
    // beep→set1 is instant (index 0); all other transitions breathe for 50 ms.
    if (startIndex + 1 < StorySystem.PLAYLIST.length) {
      const gap = startIndex === 0 ? 0 : 50;
      audio.addEventListener('ended', () => {
        setTimeout(() => this._startPlaylist(startIndex + 1), gap);
      }, { once: true });
    }

    audio.play().catch(err => console.warn(`Audio ${clip.id} failed:`, err));
  }

  // ── Voice-over: .m4a files only, no TTS fallback ─────────────────
  _speak(id, text) {
    // Beep triggers the whole playlist
    if (id === 'beep') {
      this._startPlaylist(0);
      return;
    }
    // Individual clip (not used in normal flow, kept for manual calls)
    this._stopSpeech();
    if (text) this._showCard(text);
    const audio = new Audio(`/audio/${id}.m4a`);
    this._activeAudio = audio;
    audio.play().catch(err => console.warn(`Audio ${id} failed:`, err));
  }

  _showCard(text) {
    if (!this.voCard) return;
    clearTimeout(this._cardTimer);
    this.voCard.textContent = text;
    this.voCard.classList.remove('hidden');
    // Hide card after 6 s (longer to match real speech duration)
    this._cardTimer = setTimeout(() => {
      this.voCard.classList.add('hidden');
    }, 6000);
  }

  // TTS disabled — real audio files are used exclusively
  _tts() {}

  _stopSpeech() {
    if (this._activeAudio) {
      this._activeAudio.pause();
      this._activeAudio.currentTime = 0;
      this._activeAudio = null;
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

  /** Enable or disable voice-over narration (zone text + TTS/audio).
   *  Finish-line detection is unaffected and always active.
   */
  setNarration(enabled) {
    this._narrateEnabled = enabled;
    if (!enabled) {
      this._stopSpeech();
      if (this.voCard) this.voCard.classList.add('hidden');
    }
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
