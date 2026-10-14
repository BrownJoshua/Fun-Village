// Sky, lighting, clouds, rain, lightning, fog and (optional) sound.
// All weather parameters ease toward their targets so presets blend smoothly.
import * as THREE from 'three';
import { mats, rng } from './builders.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const col = (h) => new THREE.Color(h);

export const PRESETS = {
  sunny: { cloud: 0.12, rain: 0, fog: 0, storm: 0, wind: 0.25 },
  cloudy: { cloud: 0.85, rain: 0, fog: 0.12, storm: 0, wind: 0.45 },
  rain: { cloud: 1, rain: 0.55, fog: 0.25, storm: 0, wind: 0.5 },
  storm: { cloud: 1, rain: 1, fog: 0.3, storm: 1, wind: 0.95 },
  mist: { cloud: 0.35, rain: 0, fog: 0.85, storm: 0, wind: 0.08 },
};
export const TIMES = { dawn: 6.3, noon: 12, dusk: 17.8, night: 22 };

const NIGHT_TOP = col(0x040716), NIGHT_HOR = col(0x141a40);
const DAY_TOP = col(0x3d8be0), DAY_HOR = col(0xc2e2f5);
const TW_TOP = col(0x5a5fa6), TW_HOR = col(0xff9a4a);

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const SKY_FRAG = `
  varying vec3 vDir;
  uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor;
  uniform float uGlow;
  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 c = h > 0. ? mix(uHorizon, uTop, pow(h, .5)) : mix(uHorizon, uBottom, pow(-h, .45));
    float s = max(dot(d, uSunDir), 0.);
    c += uSunColor * (pow(s, 6.) * .22 + pow(s, 60.) * .55) * uGlow;
    gl_FragColor = vec4(c, 1.);
    #include <colorspace_fragment>
  }`;

function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Weather {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.cur = { ...PRESETS.sunny };
    this.tgt = { ...PRESETS.sunny };
    this.time = 11.2;
    this.flow = false;
    this.flowSpeed = 0.35; // in-game hours per second
    this.wet = 0;
    this.flash = 0;
    this.nextStrike = 4;
    this.lamps = [];
    this.day = 1;
    this.sound = new Sound();

    this.buildSky();
    this.buildLights();
    this.buildClouds();
    this.buildRain();
    this.buildLightning();
    this.buildRainbow();

    scene.fog = new THREE.FogExp2(0xbfd8ea, 0.003);
  }

  /* ---------- construction ---------- */

  buildSky() {
    this.skyUniforms = {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uGlow: { value: 1 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false })
    );
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(18, 20, 12), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false, transparent: true }));
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,240,200,1)', 'rgba(255,200,120,.35)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    this.sunGlow.scale.setScalar(260);
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(13, 20, 12), new THREE.MeshBasicMaterial({ color: 0xe9eeff, fog: false, transparent: true }));
    this.moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(200,215,255,.9)', 'rgba(150,175,255,.22)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    this.moonGlow.scale.setScalar(170);
    for (const o of [this.sunMesh, this.sunGlow, this.moonMesh, this.moonGlow]) { o.renderOrder = -9; this.scene.add(o); }

    const r = rng(9);
    const n = 900, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      p.set([s * Math.cos(a) * 850, Math.abs(u) * 850 * 0.9 - 40, s * Math.sin(a) * 850], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
    this.stars.renderOrder = -9;
    this.scene.add(this.stars);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5b4a35, 0.6);
    this.sun = new THREE.DirectionalLight(0xfff1d8, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -19; c.right = 19; c.top = 19; c.bottom = -19; c.near = 1; c.far = 100;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.moon = new THREE.DirectionalLight(0x8ea8ff, 0);
    this.moon.castShadow = false;
    this.flashLight = new THREE.PointLight(0xcfd8ff, 0, 90, 1.6);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.moon, this.flashLight);
    this.sunDir = new THREE.Vector3(0, 1, 0);
  }

  buildClouds() {
    const r = rng(5);
    this.cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, emissive: 0x000000 });
    this.clouds = [];
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Group();
      const blobs = 5 + Math.floor(r() * 4);
      for (let b = 0; b < blobs; b++) {
        const m = new THREE.Mesh(geo, this.cloudMat);
        const s = 1.3 + r() * 1.5;
        m.position.set((b - blobs / 2) * 1.5 + r(), r() * 0.8, (r() - 0.5) * 2);
        m.scale.set(s * 1.25, s * 0.8, s);
        g.add(m);
      }
      const overhead = i % 5 === 0;
      const low = i % 3 === 0;
      const c = {
        group: g,
        angle: r() * Math.PI * 2,
        radius: overhead ? 6 + r() * 11 : 20 + r() * 24,
        y: overhead ? 13 + r() * 6 : low ? -9 + r() * 6 : 2 + r() * 12,
        base: 0.55 + r() * 0.7,
        thr: overhead ? 0.55 + r() * 0.4 : r() * 0.85,
        speed: 0.6 + r() * 0.8,
        vis: 0,
      };
      this.scene.add(g);
      this.clouds.push(c);
    }
  }

  buildRain() {
    this.rainCount = 3200;
    const p = new Float32Array(this.rainCount * 6);
    this.rainSeed = new Float32Array(this.rainCount * 4);
    const r = rng(11);
    for (let i = 0; i < this.rainCount; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 23;
      this.rainSeed.set([Math.cos(a) * d, r() * 26 - 9, Math.sin(a) * d, 18 + r() * 8], i * 4);
    }
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xbcd0e6, transparent: true, opacity: 0.5, depthWrite: false });
    this.rainLines = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);
  }

  buildLightning() {
    const pts = 14;
    this.boltGeo = new THREE.BufferGeometry();
    this.boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts * 3), 3));
    this.bolt = new THREE.Line(this.boltGeo, new THREE.LineBasicMaterial({ color: 0xeaf0ff, fog: false, transparent: true }));
    this.bolt.visible = false;
    this.bolt.frustumCulled = false;
    this.scene.add(this.bolt);
    this.boltPts = pts;
    this.boltTime = 0;
    this.flashQueue = [];
  }

  buildRainbow() {
    this.rainbow = new THREE.Group();
    const cols = [0xe53935, 0xff9800, 0xffeb3b, 0x43a047, 0x1e88e5, 0x3949ab, 0x8e24aa];
    this.rainbowMats = cols.map((c, i) => {
      const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false, depthWrite: false });
      this.rainbow.add(new THREE.Mesh(new THREE.RingGeometry(150 - i * 4.5, 154.5 - i * 4.5, 64, 1, 0, Math.PI), m));
      return m;
    });
    this.rainbow.renderOrder = -8;
    this.scene.add(this.rainbow);
  }

  /* ---------- control ---------- */

  setPreset(name) {
    Object.assign(this.tgt, PRESETS[name]);
  }
  set(key, value) {
    this.tgt[key] = value;
  }
  setTime(h) {
    this.time = ((h % 24) + 24) % 24;
  }

  /* ---------- per-frame ---------- */

  update(dt, t) {
    const k = 1 - Math.exp(-dt * 1.5);
    for (const key of Object.keys(this.cur)) this.cur[key] += (this.tgt[key] - this.cur[key]) * k;
    const w = this.cur;
    if (this.flow) this.time = (this.time + dt * this.flowSpeed) % 24;

    // sun position
    const a = ((this.time - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(a) * 0.9, Math.sin(a), 0.38).normalize();
    const elev = this.sunDir.y;
    const daySm = smooth(-0.05, 0.22, elev);
    const twilight = 1 - smooth(0.04, 0.42, Math.abs(elev) + 0.0);
    const tw = twilight * (1 - smooth(-0.3, -0.12, elev));
    const gray = clamp(w.cloud * 0.55 + w.rain * 0.4 + w.storm * 0.3);
    this.day = daySm;

    // sky colours
    const top = NIGHT_TOP.clone().lerp(DAY_TOP, daySm).lerp(TW_TOP, tw * 0.45);
    const hor = NIGHT_HOR.clone().lerp(DAY_HOR, daySm).lerp(TW_HOR, tw * 0.85);
    const lum = (0.07 + 0.55 * daySm + 0.18 * tw) * (1 - 0.6 * w.storm);
    const greyCol = new THREE.Color().setRGB(0.62 * lum, 0.66 * lum, 0.7 * lum);
    top.lerp(greyCol, gray * 0.9);
    hor.lerp(greyCol.clone().multiplyScalar(1.15), gray * 0.82);
    const flash = this.flash;
    if (flash > 0) { top.lerp(col(0xdde6ff), flash * 0.6); hor.lerp(col(0xf0f4ff), flash * 0.6); }
    const bottom = hor.clone().lerp(top, 0.55);

    const u = this.skyUniforms;
    u.uTop.value.copy(top); u.uHorizon.value.copy(hor); u.uBottom.value.copy(bottom);
    u.uSunDir.value.copy(this.sunDir);
    const sunCol = col(0xfff1d8).lerp(col(0xff8a3a), tw);
    u.uSunColor.value.copy(sunCol);
    u.uGlow.value = smooth(-0.15, 0.1, elev) * (1 - gray * 0.85);
    this.sky.position.copy(this.camera.position);

    // lights
    const L = this.sunDir.clone();
    L.y = Math.max(L.y, 0.17);
    L.normalize();
    this.sun.position.copy(L).multiplyScalar(45);
    this.sun.intensity = 3.4 * daySm * (1 - 0.82 * gray);
    this.sun.color.copy(sunCol);
    this.moon.position.copy(this.sunDir).multiplyScalar(-45).setY(Math.max(-this.sunDir.y, 0.4) * 45);
    this.moon.intensity = 0.95 * (1 - daySm) * (1 - gray * 0.7);
    this.hemi.color.copy(top).lerp(col(0xffffff), 0.3);
    this.hemi.groundColor.copy(col(0xa08058)).multiplyScalar(0.25 + 0.75 * daySm);
    this.hemi.intensity = (0.3 + 0.55 * daySm) * (1 + gray * 0.35 - w.storm * 0.4) + flash * 2.2;

    // fog
    this.scene.fog.color.copy(hor).lerp(col(0xffffff), 0.05);
    this.scene.fog.density = 0.003 + w.fog * 0.05 + w.rain * 0.004 + w.storm * 0.003;

    // sun & moon discs
    const cp = this.camera.position;
    this.sunMesh.position.copy(cp).addScaledVector(this.sunDir, 700);
    this.sunGlow.position.copy(this.sunMesh.position);
    const moonDir = this.sunDir.clone().negate();
    moonDir.x += 0.15;
    moonDir.normalize();
    this.moonMesh.position.copy(cp).addScaledVector(moonDir, 700);
    this.moonGlow.position.copy(this.moonMesh.position);
    const clear = 1 - clamp(gray * 1.15 + w.fog * 0.6);
    this.sunMesh.visible = this.sunGlow.visible = elev > -0.14;
    this.sunMesh.material.color.copy(col(0xfff3c4).lerp(col(0xff9b4a), tw));
    this.sunMesh.material.opacity = clear;
    this.sunGlow.material.opacity = clear * smooth(-0.14, 0.05, elev);
    this.moonMesh.visible = this.moonGlow.visible = moonDir.y > -0.14;
    this.moonMesh.material.opacity = clear * (1 - daySm);
    this.moonGlow.material.opacity = clear * (1 - daySm);
    this.stars.position.copy(cp);
    this.stars.material.opacity = (1 - daySm) * clear;
    this.stars.visible = this.stars.material.opacity > 0.01;

    // night details (windows, lamps) light up when it is dark or gloomy
    const lampsOn = clamp(1 - daySm + gray * 0.3 * daySm + w.storm * 0.2);
    mats.windowGlow.emissiveIntensity = 1.8 * lampsOn;
    mats.lampGlow.emissiveIntensity = 2.2 * lampsOn;
    for (const l of this.lamps) l.intensity = l.userData.base * lampsOn * (0.92 + 0.08 * Math.sin(t * 9 + l.userData.phase));
    this.lampsOn = lampsOn;

    // wetness
    this.wet = clamp(this.wet + (w.rain > 0.1 ? dt * 0.12 * w.rain : -dt * 0.02));
    const wetK = this.wet;
    mats.ground.color.setRGB(1 - 0.36 * wetK, 1 - 0.3 * wetK, 1 - 0.38 * wetK);
    mats.ground.roughness = 1 - 0.4 * wetK;
    mats.dirt.color.setRGB(1 - 0.38 * wetK, 1 - 0.4 * wetK, 1 - 0.42 * wetK);
    mats.roof.roughness = 0.85 - 0.45 * wetK;

    this.updateClouds(dt, t, w, gray, top, daySm);
    this.updateRain(dt, w, daySm);
    this.updateLightning(dt, w, t);
    this.updateRainbow(w, elev, gray);
    this.sound.update(w.rain, w.wind, w.storm);
  }

  updateClouds(dt, t, w, gray, skyTop, daySm) {
    const m = this.cloudMat;
    const white = col(0xffffff), dark = col(0x555d68), stormy = col(0x2b3038);
    m.color.copy(white).lerp(dark, gray * 0.85).lerp(stormy, w.storm * 0.6).multiplyScalar(0.28 + 0.72 * daySm);
    m.emissive.copy(skyTop).multiplyScalar(0.25 * (1 - daySm) + 0.04);
    m.emissive.addScalar(this.flash * 0.9);
    for (const c of this.clouds) {
      c.angle += dt * (0.004 + w.wind * 0.03) * c.speed;
      const vis = smooth(c.thr, c.thr + 0.22, w.cloud);
      c.vis += (vis - c.vis) * Math.min(1, dt * 2);
      c.group.visible = c.vis > 0.02;
      c.group.scale.setScalar(c.base * (0.25 + 0.75 * c.vis) * (1 + w.storm * 0.3));
      c.group.position.set(Math.cos(c.angle) * c.radius, c.y + Math.sin(t * 0.2 + c.thr * 9) * 0.3, Math.sin(c.angle) * c.radius);
      c.group.rotation.y = -c.angle;
    }
  }

  updateRain(dt, w, daySm) {
    const n = Math.floor(this.rainCount * clamp(w.rain));
    this.rainGeo.setDrawRange(0, n * 2);
    this.rainLines.visible = n > 0;
    if (n === 0) return;
    const pos = this.rainGeo.attributes.position.array, s = this.rainSeed;
    const slant = 0.12 + w.wind * 0.45;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      s[o + 1] -= s[o + 3] * dt * (0.85 + w.rain * 0.3);
      s[o] += slant * s[o + 3] * dt * 0.5;
      if (s[o + 1] < -9) { s[o + 1] += 26; s[o] -= slant * 13; }
      const len = 0.5 + w.rain * 0.5;
      const p = i * 6;
      pos[p] = s[o]; pos[p + 1] = s[o + 1]; pos[p + 2] = s[o + 2];
      pos[p + 3] = s[o] - slant * len; pos[p + 4] = s[o + 1] + len; pos[p + 5] = s[o + 2];
    }
    this.rainGeo.attributes.position.needsUpdate = true;
    this.rainMat.opacity = (0.22 + 0.3 * w.rain) * (0.35 + 0.65 * daySm);
  }

  updateLightning(dt, w, t) {
    // trigger
    if (w.storm > 0.3) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.strike();
        this.nextStrike = (2.2 + Math.random() * 5) / w.storm;
      }
    }
    // flash pattern (double flicker)
    this.flashQueue = this.flashQueue.filter((f) => { f.t -= dt; if (f.t <= 0) { this.flash = Math.max(this.flash, f.v); return false; } return true; });
    this.flash = Math.max(0, this.flash - dt * 4.5);
    this.flashLight.intensity = this.flash * 2500;
    if (this.boltTime > 0) {
      this.boltTime -= dt;
      this.bolt.material.opacity = clamp(this.boltTime / 0.22) * (0.6 + 0.4 * Math.random());
      if (this.boltTime <= 0) this.bolt.visible = false;
    }
  }

  strike() {
    const ang = Math.random() * Math.PI * 2, rad = 6 + Math.random() * 16;
    const x0 = Math.cos(ang) * rad, z0 = Math.sin(ang) * rad;
    const p = this.boltGeo.attributes.position;
    for (let i = 0; i < this.boltPts; i++) {
      const f = i / (this.boltPts - 1);
      const jx = i === 0 ? 0 : (Math.random() - 0.5) * 2.2, jz = i === 0 ? 0 : (Math.random() - 0.5) * 2.2;
      p.setXYZ(i, x0 + jx + f * 2, 24 - f * 30, z0 + jz);
    }
    p.needsUpdate = true;
    this.bolt.visible = true;
    this.bolt.material.opacity = 1;
    this.boltTime = 0.25;
    this.flashLight.position.set(x0, 14, z0);
    this.flash = 1;
    this.flashQueue.push({ t: 0.12, v: 0.75 }, { t: 0.2, v: 0.55 });
    this.sound.thunder(0.4 + Math.random() * 1.8);
  }

  updateRainbow(w, elev, gray) {
    const want = this.wet > 0.2 && w.rain < 0.15 && elev > 0.06 && elev < 0.65 && w.cloud < 0.75 ? 0.5 * clamp(this.wet * 1.5) : 0;
    const cur = this.rainbowMats[0].opacity;
    const next = cur + (want - cur) * 0.02;
    this.rainbowMats.forEach((m) => (m.opacity = next));
    this.rainbow.visible = next > 0.01;
    if (!this.rainbow.visible) return;
    const away = new THREE.Vector3(-this.sunDir.x, 0, -this.sunDir.z).normalize();
    this.rainbow.position.copy(this.camera.position).addScaledVector(away, 330).setY(this.camera.position.y - 70);
    this.rainbow.lookAt(this.camera.position.x, this.rainbow.position.y, this.camera.position.z);
  }
}

/* ---------- procedural sound (off by default, enabled from the UI) ---------- */

class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = false;
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
    this.master.connect(this.ctx.destination);

    const rain = this.ctx.createBufferSource();
    rain.buffer = this.noiseBuffer(2);
    rain.loop = true;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    this.rainGain = this.ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(hp).connect(lp).connect(this.rainGain).connect(this.master);
    rain.start();

    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuffer(4, true);
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
    this.master.gain.setTargetAtTime(this.enabled ? 0.8 : 0, this.ctx.currentTime, 0.2);
    return this.enabled;
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
    src.buffer = this.noiseBuffer(4, true);
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
}
