// main.js — boots the game, runs the loop, owns the camera and the screens
// (menu, flying, paused, crashed, sortie complete). It wires the modules
// together and nothing else: physics lives in physics.js, the world in
// terrain.js, the missions in missions.js, the instruments in hud.js.

import { GAME_TITLE, GAME_SUBTITLE, MISSIONS, WORLD, DEFAULT_SEED } from './config.js';
import { clamp, degToRad } from './rng.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { FlightState } from './physics.js';
import { Terrain } from './terrain.js';
import { AircraftView } from './aircraft.js';
import { Mission } from './missions.js';
import { Hud } from './hud.js';
import { Particles } from './particles.js';
import { parseShot, autopilotControls, missionDef } from './scenes.js';

const PLANE_SCREEN_X = 0.42; // the aeroplane sits 42% across the screen

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.view = new AircraftView();
    this.hud = new Hud();
    this.particles = new Particles();
    this.state = 'menu'; // menu | flying | paused | crashed | complete | failed
    this.missionIndex = 0;
    this.mission = new Mission(MISSIONS[0]);
    this.plane = new FlightState();
    this.terrain = null;
    this.seed = DEFAULT_SEED;
    this.time = 0;
    this.stateTime = 0; // seconds spent in the current screen
    this.best = { score: 0, mission: '' };
    this.shot = parseShot();
    this.autopilot = false;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._buildMenu();
    this._buildOverlays();
    this._startWorld(this.shot ? this.shot.seed : DEFAULT_SEED);
    if (this.shot) this._applyShot(this.shot);
    this._last = performance.now();
    // A handle for automated play-tests (dev tooling only): the game never
    // reads this itself, and it carries no secrets.
    window.__kestrel = this;
    requestAnimationFrame((t) => this._frame(t));
  }

  // --- setup ---------------------------------------------------------------
  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
    // Pixels per metre: the world reads at any window size.
    this.scale = clamp(w / 1150, 0.55, 1.25);
    this.horizonY = Math.round(h * 0.6);
  }

  _startWorld(seed) {
    this.seed = seed;
    const runwayCentres = MISSIONS[2].runways.map((r) => r.x);
    this.terrain = new Terrain(seed, runwayCentres);
    this.terrain.villageXs = MISSIONS[1].dropZones.map((z) => z.x);
    this.plane.runwayCentres = runwayCentres;
  }

  _applyShot(shot) {
    // A staged moment: the mission, the aeroplane's place in it, and the
    // autopilot on, so the screenshot shows the game flying, not parked.
    this.missionIndex = shot.mission;
    this.mission = new Mission(missionDef(shot.mission));
    const def = this.mission.def;
    this.plane.reset(def.startX, def.startAltitude, def.startHeading);
    this.plane.x = shot.x;
    this.plane.altitude = shot.altitude;
    this.plane.speed = shot.speed;
    this.plane.heading = shot.heading;
    this.plane.throttle = shot.throttle;
    this.plane.fuel = shot.fuel;
    if (shot.name === 'rings') this.mission.ringIndex = 2;
    if (shot.name === 'landing') this.mission.landingsDone = 0;
    this.autopilot = true;
    this.state = shot.name === 'menu' ? 'menu' : 'flying';
    this.stateTime = 0;
    const overlay = document.getElementById('menu');
    if (overlay && shot.name !== 'menu') overlay.classList.add('hidden');
  }

  _buildMenu() {
    const menu = document.getElementById('menu');
    menu.querySelector('.title').textContent = GAME_TITLE;
    menu.querySelector('.subtitle').textContent = GAME_SUBTITLE;
    const list = menu.querySelector('.missions');
    MISSIONS.forEach((m, i) => {
      const card = document.createElement('button');
      card.className = 'mission-card';
      card.innerHTML =
        `<span class="mission-name">${i + 1}. ${m.name}</span>` +
        `<span class="mission-tag">${m.tagline}</span>` +
        `<span class="mission-brief">${m.briefing}</span>`;
      card.addEventListener('click', () => {
        this.audio.ensure();
        this.audio.uiClick();
        this.startMission(i);
      });
      list.appendChild(card);
    });
    menu.querySelector('.howto').innerHTML =
      'Fly with <b>↑ ↓</b> pitch, <b>← →</b> bank and turn, <b>W / S</b> throttle, ' +
      '<b>Space</b> or <b>click</b> to drop a parcel, <b>P</b> pause, <b>R</b> restart, <b>M</b> mute. ' +
      'You can also steer by dragging the mouse. Land slow and level — the Kestrel forgives a lot, but not the sea.';
  }

  _buildOverlays() {
    const over = document.getElementById('over');
    over.querySelector('.again').addEventListener('click', () => this.startMission(this.missionIndex));
    over.querySelector('.tomenu').addEventListener('click', () => this.toMenu());
    document.getElementById('mute').addEventListener('click', () => this.toggleMute());
    document.getElementById('pause').addEventListener('click', () => this.togglePause());
    document.getElementById('restart').addEventListener('click', () => this.startMission(this.missionIndex));
  }

  // --- screens ---------------------------------------------------------------
  startMission(index) {
    this.audio.ensure();
    this.missionIndex = index;
    this.mission = new Mission(missionDef(index));
    const def = this.mission.def;
    this.plane.reset(def.startX, def.startAltitude, def.startHeading);
    this.particles.clear();
    this.autopilot = false;
    this.state = 'flying';
    this.stateTime = 0;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('over').classList.add('hidden');
    this.mission.announce(`${def.name} — ${def.tagline}`, 0, 4);
  }

  toMenu() {
    this.state = 'menu';
    this.stateTime = 0;
    this.autopilot = false;
    document.getElementById('over').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
    const def = missionDef(this.missionIndex);
    this.plane.reset(def.startX, def.startAltitude, def.startHeading);
  }

  togglePause() {
    if (this.state === 'flying') {
      this.state = 'paused';
    } else if (this.state === 'paused') {
      this.state = 'flying';
    }
  }

  toggleMute() {
    this.audio.ensure();
    this.audio.setMuted(!this.audio.muted);
    document.getElementById('mute').textContent = this.audio.muted ? '🔇 Sound off' : '🔊 Sound on';
  }

  _showOver(title, lines) {
    const over = document.getElementById('over');
    over.querySelector('.over-title').textContent = title;
    over.querySelector('.over-lines').innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
    over.classList.remove('hidden');
  }

  // --- loop ------------------------------------------------------------------
  _frame(now) {
    const dt = clamp((now - this._last) / 1000, 0, 0.05);
    this._last = now;
    this.time += dt;
    this.stateTime += dt;
    this._update(dt);
    this._draw();
    this.input.endFrame();
    requestAnimationFrame((t) => this._frame(t));
  }

  _readControls() {
    const i = this.input;
    const ctl = {
      pitchUp: i.held('pitchUp'),
      pitchDown: i.held('pitchDown'),
      bankLeft: i.held('bankLeft'),
      bankRight: i.held('bankRight'),
      throttleUp: i.held('throttleUp'),
      throttleDown: i.held('throttleDown'),
    };
    // Mouse steering: drag above or below the aeroplane to pitch, left or
    // right of it to bank. A plain click drops a parcel in Parcel Drop.
    if (i.mouse.down && i.mouse.inside) {
      const px = this.w * PLANE_SCREEN_X;
      const py = this._planeScreenY();
      if (i.mouse.y < py - 26) ctl.pitchUp = true;
      if (i.mouse.y > py + 26) ctl.pitchDown = true;
      if (i.mouse.x < px - 70) ctl.bankLeft = true;
      if (i.mouse.x > px + 70) ctl.bankRight = true;
    }
    return ctl;
  }

  _update(dt) {
    const i = this.input;
    if (i.tapped('mute')) this.toggleMute();
    if (i.tapped('restart') && (this.state === 'flying' || this.state === 'paused')) {
      this.startMission(this.missionIndex);
      return;
    }
    if (i.tapped('pause')) this.togglePause();
    if (this.state === 'menu') {
      if (i.tapped('mission1')) this.startMission(0);
      if (i.tapped('mission2')) this.startMission(1);
      if (i.tapped('mission3')) this.startMission(2);
      if (i.tapped('confirm')) this.startMission(this.missionIndex);
      // The menu keeps a demo flight drifting behind the cards.
      this._demoFlight(dt);
      return;
    }
    if (this.state === 'paused') return;
    if (this.state === 'crashed' || this.state === 'complete' || this.state === 'failed') {
      this.particles.update(dt);
      if (i.tapped('confirm') && this.stateTime > 0.8) this.startMission(this.missionIndex);
      return;
    }

    // Flying.
    if (i.tapped('drop') || (i.mouse.clicked && !this._overHudButton(i.mouse))) {
      if (this.mission.dropParcel(this.plane)) this.audio.drop();
    }
    const ctl = this.autopilot
      ? autopilotControls(this.plane, this.mission, dt)
      : this._readControls();
    const events = this.plane.step(dt, ctl, (x) => this.terrain.groundHeight(x));
    this.view.update(dt, this.plane.throttle);
    this.audio.updateEngine(this.plane.throttle, this.plane.speed, true);
    this.particles.update(dt);
    if (this.plane.throttle > 0.2 && !this.plane.grounded) {
      this.particles.exhaust(
        this.w * PLANE_SCREEN_X,
        this._planeScreenY(),
        this.plane.heading < 180,
        this.plane.throttle,
      );
    }
    const missionEvents = this.mission.update(dt, this.plane, this.time, this.terrain);
    this._handleEvents([...events, ...missionEvents]);
    if (this.plane.fuel <= 0 && this.mission.timeLeft > 0 && !this.mission.failed) {
      // Out of fuel is not the end: glide to a runway or the sea decides.
    }
  }

  _overHudButton(mouse) {
    // The corner buttons are DOM; a click on them must not drop a parcel.
    return mouse.y < 130 && mouse.x > this.w - 300;
  }

  _demoFlight(dt) {
    // A slow sightseeing pass behind the menu, so the title screen is alive.
    const ctl = autopilotControls(this.plane, this.mission, dt);
    this.plane.step(dt, ctl, (x) => this.terrain.groundHeight(x));
    if (this.plane.x > WORLD.worldLength - 600) {
      this.plane.reset(320, 200, 90);
    }
    this.view.update(dt, 0.4);
  }

  _handleEvents(events) {
    for (const e of events) {
      if (e === 'stall') this.audio.alarm();
      if (e === 'ring') {
        this.audio.ring();
        const s = this._toScreen(this.mission.def.rings[this.mission.ringIndex - 1].x, this.mission.def.rings[this.mission.ringIndex - 1].y);
        this.particles.ringBurst(s.x, s.y);
      }
      if (e === 'fuel') this.audio.fuel();
      if (e === 'drop-hit') this.audio.ring();
      if (e === 'drop-miss') this.audio.thud();
      if (e === 'hard-landing' || e === 'scrape') {
        this.audio.thud();
        this.particles.smoke(this.w * PLANE_SCREEN_X, this._planeScreenY(), e === 'hard-landing');
      }
      if (e === 'landed-runway' || e === 'landed-field') {
        this.audio.thud();
        this.particles.dust(this.w * PLANE_SCREEN_X, this._planeScreenY() + 8);
        this.mission.announce(
          e === 'landed-runway' ? 'Down on the strip — mind the next one' : 'Down in a field — the Kestrel will forgive you once',
          this.time,
          2.5,
        );
      }
      if (e === 'landed') this.audio.fanfare();
      if (e === 'mission-complete') {
        this.audio.fanfare();
        this.particles.confetti(this.w * PLANE_SCREEN_X, this._planeScreenY() - 40);
        this._finishSortie(true);
      }
      if (e === 'time-up') {
        this._finishSortie(false, 'Out of time.');
      }
      if (e === 'crash') this._crash();
    }
  }

  _crash() {
    if (this.state !== 'flying') return;
    this.audio.crash();
    this.audio.updateEngine(0, 0, false);
    const inSea = this.terrain.isSea(this.plane.x);
    if (inSea) this.particles.splash(this.w * PLANE_SCREEN_X, this._planeScreenY());
    else this.particles.smoke(this.w * PLANE_SCREEN_X, this._planeScreenY(), true);
    this.state = 'crashed';
    this.stateTime = 0;
    const best = this.mission.score > this.best.score;
    if (best) this.best = { score: this.mission.score, mission: this.mission.name };
    setTimeout(() => {
      if (this.state !== 'crashed') return;
      this._showOver('The Kestrel is down.', [
        inSea
          ? 'She ditched in the sea. The courier swam for it; the parcels did not.'
          : 'She came down hard on the isles. The courier walked away; the Kestrel will need a new wing.',
        `Score this sortie: <b>${this.mission.score.toLocaleString()}</b> — ${this.mission.progressText}`,
        `Best so far: <b>${this.best.score.toLocaleString()}</b> (${this.best.mission || '—'})`,
        'Press <b>Enter</b> or <b>Fly again</b> to try the sortie once more.',
      ]);
    }, 900);
  }

  _finishSortie(won, why = '') {
    if (this.state !== 'flying') return;
    this.state = won ? 'complete' : 'failed';
    this.stateTime = 0;
    const best = this.mission.score > this.best.score;
    if (best) this.best = { score: this.mission.score, mission: this.mission.name };
    const lines = [
      won
        ? `Sortie complete — ${this.mission.progressText}, with ${Math.round(this.mission.timeLeft)}s to spare.`
        : `${why} ${this.mission.progressText}.`,
      `Score this sortie: <b>${this.mission.score.toLocaleString()}</b>`,
      `Best so far: <b>${this.best.score.toLocaleString()}</b> (${this.best.mission || '—'})`,
      'Press <b>Enter</b> or <b>Fly again</b> for another sortie.',
    ];
    setTimeout(() => {
      if (this.state !== 'complete' && this.state !== 'failed') return;
      this._showOver(won ? 'Sortie complete!' : 'Sortie over.', lines);
    }, 900);
  }

  // --- drawing -----------------------------------------------------------------
  _planeScreenY() {
    return this.horizonY - this.plane.altitude * this.scale;
  }

  _toScreen(wx, wy) {
    return {
      x: (wx - this.plane.x) * this.scale + this.w * PLANE_SCREEN_X,
      y: this.horizonY - wy * this.scale,
      scale: this.scale,
    };
  }

  _draw() {
    const ctx = this.ctx;
    const { w, h } = this;
    this.terrain.drawSky(ctx, w, h, this.time);
    this.terrain.drawClouds(ctx, w, h, this.plane.x, this.scale, this.time);
    this.terrain.drawMountains(ctx, w, this.horizonY, this.plane.x, this.scale);
    this.terrain.drawGround(ctx, w, h, this.plane.x, this.scale, this.horizonY, this.time);
    this.terrain.drawBirds(ctx, w, this.plane.x, this.scale, this.horizonY, this.time);
    this.mission.draw(ctx, (x, y) => this._toScreen(x, y), this.time);
    this.particles.draw(ctx);
    const px = w * PLANE_SCREEN_X;
    const py = this._planeScreenY();
    const facingEast = this.plane.heading < 180;
    this.view.draw(ctx, px, py, this.plane.pitch, this.plane.bank, facingEast, this.scale * 1.9, this.plane.throttle, this.plane.altitude);
    if (this.state !== 'menu') {
      this.hud.draw(ctx, w, h, {
        plane: this.plane,
        mission: this.mission,
        time: this.time,
        paused: this.state === 'paused',
      });
    }
    // A quiet credit line, part of the game, not a watermark on the art.
    ctx.fillStyle = 'rgba(10, 25, 40, 0.55)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Kestrel Run — an original game', 12, h - 12);
    void degToRad;
  }
}

new Game();
