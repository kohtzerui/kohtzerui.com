import { STORY_ZONES, PIT_STOPS, FINISH_T, FINISH_RADIUS } from './circuit.js';

/**
 * StorySystem — manages subtitle display, pit stop cards, and the
 * finish / contact screen.  All story triggers are proximity-based
 * (3D world-space distance from the car to each zone's position on
 * the curve), so the narrative flows continuously while driving.
 */
export class StorySystem {
  constructor(curve) {
    this.curve = curve;

    // Pre-compute 3D positions for each zone
    this.zonePositions   = STORY_ZONES.map(z => curve.getPoint(z.t));
    this.pitPositions    = PIT_STOPS.map(p => curve.getPoint(p.t));
    this.finishPosition  = curve.getPoint(FINISH_T);

    // DOM refs
    this.subtitleWrap  = document.getElementById('story-subtitle');
    this.subtitleText  = document.getElementById('subtitle-text');
    this.pitCard       = document.getElementById('pit-card');
    this.pitCardHeader = document.getElementById('pit-card-header');
    this.pitCardBody   = document.getElementById('pit-card-body');
    this.pitCardClose  = document.getElementById('pit-card-close');
    this.contactScreen = document.getElementById('contact-screen');
    this.contactClose  = document.getElementById('contact-close');
    this.sectorDisplay = document.getElementById('sector-display');

    this.triggered   = new Set();
    this.cardOpen    = false;
    this.contactOpen = false;
    this._subtitleTimer = null;

    // Event bindings
    this.pitCardClose.addEventListener('click', () => this.closePitCard());
    this.contactClose.addEventListener('click', () => this.closeContact());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (this.cardOpen)    this.closePitCard();
        if (this.contactOpen) this.closeContact();
      }
    });
  }

  /** Call every frame with current car world position (THREE.Vector3). */
  update(carPos) {
    if (this.cardOpen || this.contactOpen) return;

    // — Story subtitle zones —
    STORY_ZONES.forEach((zone, i) => {
      if (this.triggered.has(zone.id)) return;
      const dist = carPos.distanceTo(this.zonePositions[i]);
      if (dist < 18) {
        this.triggered.add(zone.id);
        this.showSubtitle(zone.text);
        this.sectorDisplay.textContent = zone.sector;
      }
    });

    // — Pit stop zones —
    PIT_STOPS.forEach((pit, i) => {
      if (this.triggered.has(pit.id)) return;
      const dist = carPos.distanceTo(this.pitPositions[i]);
      if (dist < pit.triggerRadius) {
        this.triggered.add(pit.id);
        this.openPitCard(pit);
      }
    });

    // — Finish line (only after both pit stops have been visited) —
    if (!this.triggered.has('finish')) {
      const pitsDone = PIT_STOPS.every(p => this.triggered.has(p.id));
      if (pitsDone) {
        const dist = carPos.distanceTo(this.finishPosition);
        if (dist < FINISH_RADIUS) {
          this.triggered.add('finish');
          this.showContact();
        }
      }
    }
  }

  showSubtitle(text) {
    if (this._subtitleTimer) clearTimeout(this._subtitleTimer);
    this.subtitleText.innerHTML = text.replace(/\n/g, '<br>');
    this.subtitleWrap.classList.add('visible');
    this._subtitleTimer = setTimeout(() => {
      this.subtitleWrap.classList.remove('visible');
    }, 5500);
  }

  openPitCard(pit) {
    this.cardOpen = true;
    this.pitCardHeader.textContent = `${pit.title}  —  ${pit.chapter}`;
    this.pitCardBody.innerHTML = pit.content + `
      <div class="tech-tags">
        ${pit.tags.map(t => `<span class="tag">${t}</span>`).join('')}
      </div>`;
    this.pitCard.classList.remove('hidden');
  }

  closePitCard() {
    this.cardOpen = false;
    this.pitCard.classList.add('hidden');
  }

  showContact() {
    this.contactOpen = true;
    this.contactScreen.classList.remove('hidden');
  }

  closeContact() {
    this.contactOpen = false;
    this.contactScreen.classList.add('hidden');
    // Reset all triggers for another lap
    this.triggered.clear();
    // Notify main.js to reset car position
    window.dispatchEvent(new CustomEvent('lap-restart'));
  }

  /** Returns true if a card overlay is blocking gameplay. */
  isBlocking() {
    return this.cardOpen || this.contactOpen;
  }
}
