// audio.js — every sound in the game is synthesised with the Web Audio API:
// a two-oscillator engine drone whose pitch follows the throttle, wind noise
// from a filtered noise buffer, and short blips for rings, drops and alarms.
// No audio files are loaded, so the game stays silent on the network.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOn = false;
    this._osc1 = null;
    this._osc2 = null;
    this._engineGain = null;
    this._windGain = null;
    this._windFilter = null;
    this._master = null;
  }

  // Browsers only let audio start after a user gesture; call from a click or key.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this._master = this.ctx.createGain();
    this._master.gain.value = this.muted ? 0 : 0.55;
    this._master.connect(this.ctx.destination);

    // Engine: a low sawtooth plus a detuned square, through a low-pass.
    this._osc1 = this.ctx.createOscillator();
    this._osc1.type = 'sawtooth';
    this._osc1.frequency.value = 62;
    this._osc2 = this.ctx.createOscillator();
    this._osc2.type = 'square';
    this._osc2.frequency.value = 93;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this._engineGain = this.ctx.createGain();
    this._engineGain.gain.value = 0;
    this._osc1.connect(engineFilter);
    this._osc2.connect(engineFilter);
    engineFilter.connect(this._engineGain);
    this._engineGain.connect(this._master);
    this._osc1.start();
    this._osc2.start();

    // Wind: looped white noise through a band-pass that opens with speed.
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    this._windFilter = this.ctx.createBiquadFilter();
    this._windFilter.type = 'bandpass';
    this._windFilter.frequency.value = 700;
    this._windFilter.Q.value = 0.6;
    this._windGain = this.ctx.createGain();
    this._windGain.gain.value = 0;
    noise.connect(this._windFilter);
    this._windFilter.connect(this._windGain);
    this._windGain.connect(this._master);
    noise.start();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this._master && this.ctx) {
      this._master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
  }

  // Called every frame while flying: throttle 0..1, speed in knots.
  updateEngine(throttle, speed, running) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = running ? 0.05 + throttle * 0.075 : 0;
    this._engineGain.gain.setTargetAtTime(target, t, 0.08);
    const rpm = 58 + throttle * 66 + speed * 0.08;
    this._osc1.frequency.setTargetAtTime(rpm, t, 0.1);
    this._osc2.frequency.setTargetAtTime(rpm * 1.494, t, 0.1);
    this._windGain.gain.setTargetAtTime(running ? Math.min(0.09, speed * 0.00042) : 0, t, 0.15);
    this._windFilter.frequency.setTargetAtTime(500 + speed * 4, t, 0.15);
  }

  _blip(freq, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this._master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  ring() {
    this._blip(880, 0.28, 'sine', 0.32);
    this._blip(1318, 0.34, 'sine', 0.22, 0.07);
  }

  fuel() {
    this._blip(523, 0.16, 'triangle', 0.25);
    this._blip(784, 0.22, 'triangle', 0.2, 0.08);
  }

  drop() {
    this._blip(392, 0.2, 'triangle', 0.28);
  }

  thud() {
    this._blip(110, 0.3, 'sine', 0.4);
    this._blip(65, 0.4, 'sine', 0.35, 0.02);
  }

  alarm() {
    this._blip(660, 0.14, 'square', 0.12);
    this._blip(660, 0.14, 'square', 0.12, 0.2);
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 0.7;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(gain);
    gain.connect(this._master);
    src.start(t);
    this._blip(55, 0.8, 'sine', 0.4);
  }

  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => this._blip(f, 0.32, 'triangle', 0.26, i * 0.11));
  }

  uiClick() {
    this._blip(740, 0.07, 'triangle', 0.16);
  }
}
