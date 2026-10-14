// Procedural sound for the village (off until the Sound toggle is switched on).
// Weather beds (rain, wind, thunder) plus positional one-shots: children, dogs, cats, cows and the temple.
import * as THREE from 'three';

const rr = (a, b) => a + Math.random() * (b - a);

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.volume = 0.8;
    this._v = new THREE.Vector3();
    this._r = new THREE.Vector3();
  }

  noiseBuffer(seconds, brown = false) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; } else d[i] = white;
    }
    return buf;
  }

  init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 5;
    this.master.connect(comp).connect(this.ctx.destination);
    this.whiteNoise = this.noiseBuffer(2);
    this.brownNoise = this.noiseBuffer(4, true);

    const rain = this.ctx.createBufferSource();
    rain.buffer = this.whiteNoise;
    rain.loop = true;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    this.rainGain = this.ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(hp).connect(lp).connect(this.rainGain).connect(this.master);
    rain.start();

    const wind = this.ctx.createBufferSource();
    wind.buffer = this.brownNoise;
    wind.loop = true;
    this.windFilter = this.ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 400;
    this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    wind.start();
    return true;
  }

  toggle() {
    if (!this.ctx && !this.init()) return false;
    this.enabled = !this.enabled;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.2);
    return this.enabled;
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx && this.enabled) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  update(rain, wind, storm) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(rain * 0.18, t, 0.3);
    this.windGain.gain.setTargetAtTime(0.03 + wind * 0.4, t, 0.3);
    this.windFilter.frequency.setTargetAtTime(250 + wind * 700 + storm * 300, t, 0.3);
  }

  thunder(delay) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.brownNoise;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t0);
    lp.frequency.exponentialRampToValueAtTime(70, t0 + 3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(1.6, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.6);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + 4);
  }

  /* ---------- positional one-shots ---------- */

  // kind: 'child' | 'bark' | 'meow' | 'moo' | 'bell' | 'conch' | 'drum'; pos is a world-space Vector3.
  emit(kind, pos, camera, opts = {}) {
    if (!this.ctx || !this.enabled || !this[kind]) return;
    const d = camera.position.distanceTo(pos);
    const gain = Math.min(1.3, 1.7 / (1 + Math.pow(d / 9, 1.4))) * (opts.gain ?? 1);
    if (gain < 0.03) return;
    this._v.copy(pos).sub(camera.position).normalize();
    this._r.setFromMatrixColumn(camera.matrixWorld, 0);
    const pan = THREE.MathUtils.clamp(this._v.dot(this._r) * 1.2, -1, 1);
    const out = this.ctx.createGain();
    out.gain.value = gain;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p).connect(this.master);
    } else out.connect(this.master);
    this[kind](out, this.ctx.currentTime + (opts.delay ?? 0));
  }

  // one oscillator through a filter chain with piecewise frequency and amplitude curves
  osc(dest, t0, type, fpts, epts, filters = []) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    fpts.forEach(([t, f], i) => (i ? o.frequency.exponentialRampToValueAtTime(f, t0 + t) : o.frequency.setValueAtTime(f, t0 + t)));
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    epts.forEach(([t, v]) => g.gain.linearRampToValueAtTime(Math.max(v, 0.0001), t0 + t));
    let n = o;
    for (const f of filters) {
      const b = c.createBiquadFilter();
      b.type = f.type;
      b.frequency.value = f.f;
      b.Q.value = f.q ?? 1;
      n.connect(b);
      n = b;
    }
    n.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + epts[epts.length - 1][0] + 0.05);
    return o;
  }

  hit(dest, t0, dur, hz, q, level) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.whiteNoise;
    const b = c.createBiquadFilter();
    b.type = 'bandpass';
    b.frequency.value = hz;
    b.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(level, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(b).connect(g).connect(dest);
    s.start(t0);
    s.stop(t0 + dur + 0.02);
  }

  meow(out, t0) {
    const k = rr(0.9, 1.15);
    const f = [[0, 520 * k], [0.14, 880 * k], [0.4, 700 * k], [0.62, 430 * k]];
    const e = [[0, 0], [0.06, 0.5], [0.4, 0.35], [0.64, 0]];
    this.osc(out, t0, 'sawtooth', f, e, [{ type: 'bandpass', f: 1200, q: 2.5 }]);
    this.osc(out, t0, 'sawtooth', f, e.map(([t, v]) => [t, v * 0.6]), [{ type: 'bandpass', f: 2600, q: 3 }]);
  }

  bark(out, t0) {
    const k = rr(0.85, 1.2);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * rr(0.26, 0.34);
      this.osc(out, t, 'sawtooth', [[0, 420 * k], [0.12, 170 * k]], [[0, 0], [0.01, 0.7], [0.14, 0]], [{ type: 'bandpass', f: 800, q: 1.4 }]);
      this.hit(out, t, 0.09, 1600, 1, 0.35);
    }
  }

  moo(out, t0) {
    const k = rr(0.9, 1.15);
    const o = this.osc(out, t0, 'sawtooth', [[0, 98 * k], [0.45, 128 * k], [1.2, 112 * k], [1.7, 82 * k]], [[0, 0], [0.3, 0.55], [1.2, 0.5], [1.7, 0]], [{ type: 'lowpass', f: 520, q: 3 }]);
    const lfo = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = 4;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t0);
    lfo.stop(t0 + 1.8);
  }

  // children: a giggle, a happy shout, or a call to a friend
  child(out, t0) {
    const pick = Math.random();
    const k = rr(0.9, 1.25);
    const formants = [{ type: 'bandpass', f: 1150, q: 2 }];
    const high = [{ type: 'bandpass', f: 2900, q: 3 }];
    if (pick < 0.5) {
      const n = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const t = t0 + i * 0.13;
        const f0 = rr(520, 700) * k * (1 - i * 0.03);
        const a = 0.8 * (1 - i * 0.1);
        this.osc(out, t, 'sawtooth', [[0, f0], [0.09, f0 * 0.8]], [[0, 0], [0.015, a], [0.1, 0]], formants);
        this.osc(out, t, 'sawtooth', [[0, f0], [0.09, f0 * 0.8]], [[0, 0], [0.015, a * 0.5], [0.1, 0]], high);
      }
    } else if (pick < 0.8) {
      const f = [[0, 420 * k], [0.3, 880 * k], [0.4, 760 * k]];
      const e = [[0, 0], [0.05, 0.8], [0.3, 0.72], [0.42, 0]];
      this.osc(out, t0, 'sawtooth', f, e, formants);
      this.osc(out, t0, 'sawtooth', f, e.map(([t, v]) => [t, v * 0.5]), high);
    } else {
      for (let i = 0; i < 2; i++) {
        const t = t0 + i * 0.22;
        const f0 = (i ? 560 : 680) * k;
        this.osc(out, t, 'sawtooth', [[0, f0], [0.18, f0 * 0.85]], [[0, 0], [0.02, 0.8], [0.18, 0]], formants);
        this.osc(out, t, 'sawtooth', [[0, f0], [0.18, f0 * 0.85]], [[0, 0], [0.02, 0.4], [0.18, 0]], high);
      }
    }
  }

  // temple bell: inharmonic partials with long decays, struck one to three times
  bell(out, t0) {
    const strikes = 1 + Math.floor(Math.random() * 3);
    const base = rr(540, 640);
    const partials = [[1, 1, 3.6], [2.0, 0.6, 2.8], [2.76, 0.5, 2.2], [4.07, 0.25, 1.5], [5.4, 0.15, 1.0]];
    for (let s = 0; s < strikes; s++) {
      const t = t0 + s * 1.25;
      for (const [r, a, d] of partials) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = base * r;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(a * 0.5, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + d + 0.05);
      }
      this.hit(out, t, 0.03, 3200, 2, 0.3);
    }
  }

  // conch shell: a slow, swelling horn note
  conch(out, t0) {
    const f = [[0, 200], [0.5, 235], [3, 240], [3.6, 215]];
    const e = [[0, 0], [0.5, 0.55], [3, 0.5], [3.6, 0]];
    const o = this.osc(out, t0, 'sawtooth', f, e, [{ type: 'lowpass', f: 1100, q: 1 }]);
    this.osc(out, t0, 'sawtooth', f.map(([t, v]) => [t, v * 1.005]), e.map(([t, v]) => [t, v * 0.6]), [{ type: 'bandpass', f: 650, q: 0.9 }]);
    const lfo = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    lfo.frequency.value = 5;
    depth.gain.value = 2.5;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t0);
    lfo.stop(t0 + 3.7);
  }

  // temple drum: a short rhythmic phrase
  drum(out, t0) {
    const beats = [0, 0.25, 0.5, 0.625, 0.75, 1.0, 1.25, 1.375, 1.5, 1.75];
    beats.forEach((b, i) => {
      const t = t0 + b * 0.9;
      const accent = i % 5 === 0 ? 1 : 0.7;
      this.osc(out, t, 'sine', [[0, 160], [0.14, 55]], [[0, 0], [0.004, 0.8 * accent], [0.22, 0]]);
      this.hit(out, t, 0.04, 2500, 1.2, 0.35 * accent);
    });
  }
}
