// Procedural low-poly builders for the South Indian village diorama.
// Every builder returns a THREE.Group standing on y = 0, front facing +z.
import * as THREE from 'three';

const V3 = THREE.Vector3;

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- textures ---------- */

function canvasTexture(size, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const tileTexture = canvasTexture(128, (c, s) => {
  c.fillStyle = '#c9582c';
  c.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 16) {
    c.fillStyle = 'rgba(60,15,5,.38)';
    c.fillRect(0, y + 13, s, 3);
    for (let x = ((y / 16) % 2) * 16; x < s; x += 32) c.fillRect(x, y, 2, 14);
  }
  for (let i = 0; i < 260; i++) {
    c.fillStyle = Math.random() < 0.5 ? 'rgba(255,160,100,.14)' : 'rgba(90,30,10,.14)';
    c.fillRect(Math.random() * s, Math.random() * s, 8, 5);
  }
}, 2, 5);

const thatchTexture = canvasTexture(128, (c, s) => {
  c.fillStyle = '#cfa94f';
  c.fillRect(0, 0, s, s);
  const cols = ['#e3c577', '#b08a3a', '#9c7a30', '#d9b866'];
  for (let i = 0; i < 520; i++) {
    c.strokeStyle = cols[i % cols.length];
    c.lineWidth = 1 + Math.random() * 1.5;
    const x = Math.random() * s;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x + (Math.random() - 0.5) * 14, s);
    c.stroke();
  }
}, 3, 2);

const weaveTexture = canvasTexture(64, (c, s) => {
  c.fillStyle = '#d6a43a';
  c.fillRect(0, 0, s, s);
  c.strokeStyle = 'rgba(110,70,10,.55)';
  c.lineWidth = 2;
  for (let i = 0; i < s; i += 8) {
    c.beginPath(); c.moveTo(i, 0); c.lineTo(i, s); c.stroke();
    c.beginPath(); c.moveTo(0, i); c.lineTo(s, i); c.stroke();
  }
}, 4, 2);

/* ---------- materials ---------- */

const std = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...o });

export const mats = {
  white: std(0xf4ecd6),
  cream: std(0xead9ae),
  ochre: std(0xd9a566),
  plinth: std(0xa5683d),
  roof: std(0xffffff, { map: tileTexture }),
  roofPlain: std(0xc4572b),
  thatch: std(0xffffff, { map: thatchTexture }),
  weave: std(0xffffff, { map: weaveTexture, side: THREE.DoubleSide }),
  wood: std(0x7a4a2a),
  darkWood: std(0x4a2d1a),
  door: std(0x2f6f8f),
  stone: std(0x9b9488),
  redStripe: std(0xc8452a),
  yellow: std(0xf2c14e),
  gold: std(0xe0b030, { metalness: 0.5, roughness: 0.4 }),
  trunk: std(0x7b5a3a),
  palmTrunk: std(0x9a7b55),
  palmLeafA: std(0x4f9d2b, { side: THREE.DoubleSide }),
  palmLeafB: std(0x6bb534, { side: THREE.DoubleSide }),
  leafA: std(0x5a9a2e),
  leafB: std(0x6fae35),
  leafC: std(0x3f7d28),
  skinA: std(0x8a5634),
  hair: std(0x1b1210, { flatShading: false }),
  bullock: std(0xf1ece0),
  horn: std(0xd8c8a0),
  muzzle: std(0xc9a79a),
  dark: std(0x2a211c),
  hoof: std(0x2a211c),
  pot: std(0xc9772f),
  water: new THREE.MeshStandardMaterial({
    color: 0x3c8fb5, roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.92,
  }),
  // surfaces the weather system darkens when wet
  ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
  dirt: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  // window panes glow at night (intensity driven by weather)
  windowGlow: new THREE.MeshStandardMaterial({
    color: 0x2b1c10, emissive: 0xffb040, emissiveIntensity: 0, flatShading: true,
  }),
  lampGlow: new THREE.MeshStandardMaterial({
    color: 0xffd9a0, emissive: 0xffa030, emissiveIntensity: 0,
  }),
};

/* ---------- little helpers ---------- */

const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
};
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const cyl = (rt, rb, h, mat, x, y, z, seg = 8) =>
  mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
const ball = (r, mat, x, y, z, detail = 0) => mesh(new THREE.IcosahedronGeometry(r, detail), mat, x, y, z);

/* ---------- houses ---------- */

export function makeTiledHouse({ w = 2.8, d = 2.3, h = 1.55 } = {}) {
  const g = new THREE.Group();
  g.add(box(w + 0.12, 0.16, d + 0.12, mats.plinth, 0, 0.08, 0));
  g.add(box(w, h, d, mats.white, 0, h / 2 + 0.08, 0));

  const roofGeo = new THREE.ConeGeometry(1, 1, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  const roof = mesh(roofGeo, mats.roof, 0, h + 0.08 + 0.62, 0);
  roof.scale.set((w + 0.9) / Math.SQRT2, 1.24, (d + 0.9) / Math.SQRT2);
  g.add(roof);
  g.add(box(0.14, 0.18, 0.14, mats.roofPlain, 0, h + 0.08 + 1.28, 0));

  // veranda with lean-to tiled roof and pillars
  const vz = d / 2 + 0.58;
  g.add(box(w + 0.3, 0.14, 1.15, mats.plinth, 0, 0.07, vz));
  const lean = box(w + 0.5, 0.07, 1.3, mats.roofPlain, 0, h * 0.78 + 0.1, vz + 0.04);
  lean.rotation.x = 0.22;
  g.add(lean);
  const ph = h * 0.7;
  for (let i = 0; i < 4; i++) {
    const px = -w / 2 + 0.15 + (i * (w - 0.3)) / 3;
    g.add(cyl(0.06, 0.07, ph, mats.darkWood, px, 0.14 + ph / 2, d / 2 + 1.08, 6));
  }

  g.add(box(0.5, 0.95, 0.06, mats.door, 0, 0.08 + 0.475, d / 2 + 0.03));
  for (const sx of [-1, 1]) {
    const wx = sx * w * 0.32;
    g.add(box(0.44, 0.48, 0.05, mats.darkWood, wx, h * 0.62 + 0.08, d / 2 + 0.02));
    g.add(box(0.34, 0.38, 0.06, mats.windowGlow, wx, h * 0.62 + 0.08, d / 2 + 0.03));
    g.add(box(0.05, 0.48, 0.44, mats.darkWood, sx * (w / 2 + 0.02), h * 0.62 + 0.08, 0));
    g.add(box(0.06, 0.38, 0.34, mats.windowGlow, sx * (w / 2 + 0.03), h * 0.62 + 0.08, 0));
  }
  // red-and-white kolam border on the veranda step
  g.add(box(w + 0.32, 0.04, 0.1, mats.redStripe, 0, 0.16, d / 2 + 1.18));

  g.userData.dims = { w, d, h };
  g.userData.lamp = new V3(0, 1.0, d / 2 + 1.0);
  g.userData.doorFront = new V3(0, 0, d / 2 + 1.2);
  return g;
}

export function makeHut({ r = 1.05, h = 1.0 } = {}) {
  const g = new THREE.Group();
  g.add(cyl(r * 1.06, r * 1.1, 0.14, mats.plinth, 0, 0.07, 0, 12));
  g.add(cyl(r, r * 1.04, h, mats.ochre, 0, h / 2 + 0.14, 0, 12));
  const roof = mesh(new THREE.ConeGeometry(r * 1.6, 1.55, 12), mats.thatch, 0, h + 0.14 + 0.72, 0);
  g.add(roof);
  g.add(cyl(0.05, 0.1, 0.3, mats.thatch, 0, h + 0.14 + 1.55, 0, 6));
  // clay chimney pipe poking through the thatch
  const cx = r * 0.55, cz = -r * 0.35;
  const surfaceY = h + 0.085 + 1.55 * (1 - Math.hypot(cx, cz) / (r * 1.6));
  g.add(cyl(0.1, 0.12, 0.6, mats.pot, cx, surfaceY + 0.15, cz, 8));
  g.add(cyl(0.13, 0.1, 0.06, mats.dark, cx, surfaceY + 0.47, cz, 8));
  g.userData.chimney = new V3(cx, surfaceY + 0.52, cz);
  g.add(box(0.42, 0.78, 0.06, mats.darkWood, 0, 0.14 + 0.39, r * 1.0));
  g.add(box(0.26, 0.26, 0.06, mats.windowGlow, r * 0.62, 0.14 + h * 0.62, r * 0.8));
  g.userData.dims = { r, h };
  g.userData.lamp = new V3(0, 0.9, r + 0.5);
  g.userData.doorFront = new V3(0, 0, r + 0.7);
  return g;
}

export function makeTemple() {
  const g = new THREE.Group();
  // two-step stone plinth (tops at y = 0.22 and 0.44) and a ground-level front step
  g.add(box(5.6, 0.22, 4.8, mats.stone, 0, 0.11, 0));
  g.add(box(5.0, 0.22, 4.2, mats.cream, 0, 0.33, 0));
  g.add(box(2.2, 0.11, 0.5, mats.stone, 0, 0.055, 2.65));

  // sanctum (garbhagriha): a solid body that carries the tower, y 0.44 -> 1.8
  const sz = -0.4;
  g.add(box(2.9, 1.36, 2.1, mats.white, 0, 0.44 + 0.68, sz));
  g.add(box(3.02, 0.12, 2.22, mats.redStripe, 0, 0.5, sz));
  g.add(box(3.04, 0.1, 2.24, mats.redStripe, 0, 1.72, sz));
  for (const sx of [-1, 1]) {
    for (const zz of [-1, 0.0]) g.add(box(0.1, 1.2, 0.06, mats.redStripe, sx * 1.46, 1.1, sz + zz * 0.9));
    g.add(box(0.06, 0.9, 0.12, mats.darkWood, sx * 1.46, 1.05, sz - 0.1)); // side window slits
  }
  g.add(box(2.9, 0.08, 0.06, mats.redStripe, 0, 1.6, 0.66));

  // mandapam (pillared porch) in front of the sanctum
  g.add(box(3.2, 1.15, 1.7, mats.white, 0, 0.44 + 0.575, 1.0));
  g.add(box(3.26, 0.1, 1.76, mats.redStripe, 0, 0.44 + 1.2, 1.0));
  g.add(box(3.4, 0.1, 1.9, mats.cream, 0, 0.44 + 1.3, 1.0));
  // doorway with lintel and flanking pillars
  g.add(box(0.9, 0.95, 0.05, mats.dark, 0, 0.44 + 0.475, 1.87));
  g.add(box(1.25, 0.1, 0.1, mats.redStripe, 0, 0.44 + 1.0, 1.88));
  for (const sx of [-1, 1]) {
    g.add(cyl(0.07, 0.08, 1.0, mats.redStripe, sx * 0.6, 0.44 + 0.5, 1.9, 8));
    g.add(box(0.2, 0.08, 0.2, mats.cream, sx * 0.6, 0.44 + 1.04, 1.9));
    for (const px of [0.95, 1.4]) g.add(box(0.1, 1.15, 0.04, mats.redStripe, sx * px, 1.02, 1.88));
  }

  // gopuram: stacked, tapering tiers resting on the sanctum
  let y = 0.44 + 1.36;
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const tw = 2.9 - i * 0.46;
    const td = 2.1 - i * 0.3;
    const th = 0.56 - i * 0.03;
    g.add(box(tw, th, td, i % 2 ? mats.cream : mats.white, 0, y + th / 2, sz));
    g.add(box(tw + 0.2, 0.08, td + 0.2, mats.redStripe, 0, y + th + 0.04, sz));
    const niches = Math.max(2, 5 - i);
    for (let n = 0; n < niches; n++) {
      const nx = -tw / 2 + (tw * (n + 0.5)) / niches;
      g.add(box(0.16, th * 0.62, 0.06, mats.darkWood, nx, y + th * 0.5, sz + td / 2 + 0.02));
      g.add(ball(0.05, mats.yellow, nx, y + th * 0.78, sz + td / 2 + 0.05));
    }
    y += th + 0.08;
  }
  const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 10);
  barrelGeo.rotateZ(Math.PI / 2);
  g.add(mesh(barrelGeo, mats.redStripe, 0, y + 0.3, sz));
  for (const kx of [-0.45, 0, 0.45]) {
    g.add(cyl(0.05, 0.09, 0.2, mats.gold, kx, y + 0.72, sz, 6));
    g.add(mesh(new THREE.ConeGeometry(0.06, 0.28, 6), mats.gold, kx, y + 0.95, sz));
  }

  // lamp pillars either side of the steps
  for (const sx of [-1, 1]) {
    g.add(box(0.34, 0.14, 0.34, mats.stone, sx * 1.95, 0.44 + 0.07, 1.95));
    g.add(cyl(0.07, 0.09, 0.7, mats.stone, sx * 1.95, 0.44 + 0.49, 1.95, 8));
    g.add(cyl(0.16, 0.07, 0.1, mats.gold, sx * 1.95, 0.44 + 0.88, 1.95, 8));
    g.add(ball(0.05, mats.lampGlow, sx * 1.95, 0.44 + 0.98, 1.95));
  }

  // flagstaff on a stone base, front-left
  g.add(cyl(0.16, 0.2, 0.2, mats.stone, -2.3, 0.44 + 0.1, 1.2, 8));
  g.add(cyl(0.03, 0.04, 1.9, mats.darkWood, -2.3, 0.44 + 1.15, 1.2, 5));
  g.add(ball(0.06, mats.gold, -2.3, 0.44 + 2.12, 1.2));
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.34, 6, 1),
    new THREE.MeshStandardMaterial({ color: 0xff8a1f, side: THREE.DoubleSide, roughness: 0.9 })
  );
  flag.position.set(-2.0, 0.44 + 1.85, 1.2);
  flag.castShadow = true;
  g.add(flag);
  g.userData.flag = flag;
  g.userData.flagBase = Float32Array.from(flag.geometry.attributes.position.array);

  // hanging lantern under the porch ledge
  g.add(cyl(0.01, 0.01, 0.3, mats.dark, 0, 1.54, 2.0, 3));
  g.userData.lamp = new V3(0, 1.36, 2.0);
  g.userData.doorFront = new V3(0, 0, 3.1);
  g.userData.bell = new V3(0, 0.44 + 1.0, 1.9);
  return g;
}

/* ---------- vegetation ---------- */

export function makePalm(h = 4, bend = 0.6, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new V3(0, 0, 0), new V3(bend * 0.12, h * 0.35, 0), new V3(bend * 0.45, h * 0.7, 0), new V3(bend, h, 0),
  ]);
  const tubular = 10;
  const radial = 6;
  const tube = new THREE.TubeGeometry(curve, tubular, 0.13, radial, false);
  const pos = tube.attributes.position;
  for (let ring = 0; ring <= tubular; ring++) {
    const c = curve.getPointAt(ring / tubular);
    const k = 1 - 0.38 * (ring / tubular) + (ring % 2 ? 0.07 : 0);
    for (let j = 0; j <= radial; j++) {
      const i = ring * (radial + 1) + j;
      pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k);
    }
  }
  tube.computeVertexNormals();
  g.add(mesh(tube, mats.palmTrunk));

  const crown = new THREE.Group();
  crown.position.copy(curve.getPointAt(1));
  g.add(crown);

  const L = 2.1;
  const leafGeo = new THREE.PlaneGeometry(0.62, L, 2, 8);
  const lp = leafGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const s = lp.getY(i) / L + 0.5;
    const px = lp.getX(i) * (1 - 0.78 * s) * (1 + 0.28 * Math.sin(s * 34));
    lp.setXYZ(i, px, 1.45 * s - 1.9 * s * s, L * s);
  }
  leafGeo.computeVertexNormals();

  const fronds = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / n) * Math.PI * 2 + r() * 0.3;
    const leaf = mesh(leafGeo, i % 2 ? mats.palmLeafA : mats.palmLeafB);
    leaf.rotation.x = -0.15 - r() * 0.35;
    leaf.scale.setScalar(0.85 + r() * 0.3);
    pivot.add(leaf);
    crown.add(pivot);
    fronds.push({ leaf, base: leaf.rotation.x, phase: r() * 6 });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    crown.add(ball(0.13, mats.leafC, Math.cos(a) * 0.17, -0.12, Math.sin(a) * 0.17, 1));
  }
  g.userData = { crown, fronds, phase: r() * 6.28, height: h };
  return g;
}

export function makeTree({ h = 2.2, seed = 1, scale = 1 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(cyl(0.12 * scale, 0.2 * scale, h * 0.6, mats.trunk, 0, h * 0.3, 0, 7));
  const greens = [mats.leafA, mats.leafB, mats.leafC];
  const blobs = 6;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + r();
    const rad = (0.35 + r() * 0.5) * scale;
    const b = ball((0.7 + r() * 0.35) * scale, greens[i % 3], Math.cos(a) * rad, h * 0.68 + r() * 0.5 * scale, Math.sin(a) * rad, 1);
    g.add(b);
  }
  g.add(ball(0.95 * scale, greens[1], 0, h * 0.85, 0, 1));
  g.userData.phase = r() * 6.28;
  return g;
}

export function makeBanyan() {
  const r = rng(77);
  const g = new THREE.Group();
  // raised stone platform (katte) around the trunk
  g.add(cyl(1.25, 1.35, 0.3, mats.stone, 0, 0.15, 0, 14));
  g.add(cyl(1.05, 1.1, 0.06, mats.cream, 0, 0.32, 0, 14));
  g.add(cyl(0.34, 0.5, 2.4, mats.trunk, 0, 1.4, 0, 8));
  const greens = [mats.leafA, mats.leafB, mats.leafC];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const rad = 0.9 + r() * 0.9;
    g.add(ball(0.95 + r() * 0.5, greens[i % 3], Math.cos(a) * rad, 3.0 + r() * 0.6, Math.sin(a) * rad, 1));
  }
  g.add(ball(1.35, greens[1], 0, 3.7, 0, 1));
  g.add(ball(1.1, greens[0], 0.4, 4.15, -0.2, 1));
  // aerial roots
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const rad = 0.9 + r() * 1.3;
    const len = 1.2 + r() * 1.2;
    g.add(cyl(0.025, 0.045, len, mats.trunk, Math.cos(a) * rad, 2.6 - len / 2 + 0.3, Math.sin(a) * rad, 4));
  }
  // small shrine stones under the tree
  g.add(mesh(new THREE.ConeGeometry(0.16, 0.38, 6), mats.dark, 0.7, 0.5, 0.55));
  g.add(mesh(new THREE.ConeGeometry(0.12, 0.3, 6), mats.dark, 0.95, 0.46, 0.3));
  g.add(ball(0.05, std(0xff5a2a), 0.7, 0.72, 0.55));
  g.userData.lamp = new V3(0.8, 0.9, 0.9);
  g.userData.phase = 1.3;
  return g;
}

export function makeBush(seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const flowerCols = [0xff9a1f, 0xd6467a, 0xf5f0e0, 0xffc933];
  const fc = flowerCols[Math.floor(r() * flowerCols.length)];
  const fm = std(fc, { emissive: fc, emissiveIntensity: 0.1 });
  for (let i = 0; i < 3; i++) {
    g.add(ball(0.22 + r() * 0.15, i % 2 ? mats.leafC : mats.leafB, (r() - 0.5) * 0.4, 0.2 + r() * 0.1, (r() - 0.5) * 0.4, 1));
  }
  if (r() < 0.7) for (let i = 0; i < 6; i++) g.add(ball(0.05, fm, (r() - 0.5) * 0.6, 0.3 + r() * 0.2, (r() - 0.5) * 0.6));
  return g;
}

/* ---------- village props ---------- */

export function makeWell() {
  const g = new THREE.Group();
  const ring = mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.55, 12, 1, true), mats.stone, 0, 0.27, 0);
  ring.material = mats.stone.clone();
  ring.material.side = THREE.DoubleSide;
  g.add(ring);
  g.add(cyl(0.5, 0.5, 0.04, mats.stone, 0, 0.55, 0, 12));
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.44, 12), mats.dark);
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.4;
  g.add(inner);
  for (const sx of [-1, 1]) g.add(box(0.07, 1.1, 0.07, mats.darkWood, sx * 0.5, 1.0, 0));
  const crossbar = cyl(0.05, 0.05, 1.1, mats.darkWood, 0, 1.55, 0, 6);
  crossbar.rotation.z = Math.PI / 2;
  g.add(crossbar);
  g.add(cyl(0.09, 0.07, 0.14, mats.pot, 0, 1.1, 0, 8));
  g.add(cyl(0.008, 0.008, 0.45, mats.dark, 0, 1.32, 0, 3));
  return g;
}

export function makePole(h = 3.6) {
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.08, h, mats.darkWood, 0, h / 2, 0, 6));
  g.add(box(1.0, 0.07, 0.07, mats.darkWood, 0, h - 0.25, 0));
  for (const x of [-0.45, 0, 0.45]) g.add(cyl(0.025, 0.025, 0.1, mats.stone, x, h - 0.17, 0, 5));
  g.userData.wireTop = new V3(0, h - 0.12, 0);
  return g;
}

export function makeHaystack() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.thatch, 0, 0.0, 0));
  g.add(mesh(new THREE.ConeGeometry(0.12, 0.3, 6), mats.thatch, 0, 0.62, 0));
  return g;
}

export function makeChicken(seed = 0) {
  const g = new THREE.Group();
  const cols = [0xb5532a, 0xf0e6d0, 0x6a3a22];
  const body = std(cols[seed % 3]);
  const b = mesh(new THREE.SphereGeometry(0.1, 7, 5), body, 0, 0.16, 0);
  b.scale.set(0.8, 0.8, 1.2);
  g.add(b);
  const head = new THREE.Group();
  head.position.set(0, 0.24, 0.1);
  head.add(ball(0.05, body, 0, 0.04, 0.02));
  const beak = mesh(new THREE.ConeGeometry(0.018, 0.05, 4), std(0xf0a020), 0, 0.04, 0.08);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);
  head.add(ball(0.02, std(0xd02020), 0, 0.1, 0.01));
  g.add(head);
  const tail = mesh(new THREE.ConeGeometry(0.05, 0.14, 4), body, 0, 0.22, -0.13);
  tail.rotation.x = -0.9;
  g.add(tail);
  for (const sx of [-1, 1]) g.add(cyl(0.008, 0.008, 0.08, std(0xf0a020), sx * 0.03, 0.04, 0, 3));
  g.userData.head = head;
  return g;
}

export function makeRangoli(seed = 0) {
  const g = new THREE.Group();
  const cols = [0xf5f0e0, 0xd6467a, 0xffc933, 0x4aa3d8];
  const r = rng(seed + 5);
  const rings = 4;
  for (let i = 0; i < rings; i++) {
    const rad = 0.42 - i * 0.09;
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(rad, i === 0 ? 14 : 10),
      new THREE.MeshStandardMaterial({ color: cols[(i + seed) % cols.length], roughness: 1 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.045 + i * 0.004;
    m.rotation.z = r() * 3;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/* ---------- people ---------- */

export function makePerson({
  type = 'woman', cloth = 0xd9481e, top = 0x2e8b57, scale = 0.9, pot = false, seed = 0, umbrella = 0xc0392b,
  turban = null, dhoti = false, bare = false,
} = {}) {
  const g = new THREE.Group();
  const skin = std([0x8a5634, 0x9b6a42, 0x74492c, 0x6c4128][seed % 4]);
  const hipY = 0.36;
  const upper = new THREE.Group();
  upper.position.y = hipY;
  g.add(upper);
  const ud = (g.userData = { upper, legs: [], arms: [] });
  const clothMat = std(cloth);
  const topMat = std(top);

  const head = ball(0.085, skin, 0, 0.39, 0, 1);
  const hair = ball(0.09, mats.hair, 0, 0.405, -0.012, 1);
  upper.add(head, hair);

  // thalapa: a wrapped head-cloth with a loose tail
  if (turban !== null) {
    const tm = std(turban);
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.032, 6, 12), tm);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.set(0, 0.425, 0);
    wrap.castShadow = true;
    const dome = ball(0.085, tm, 0, 0.45, 0, 1);
    dome.scale.y = 0.65;
    const tail = box(0.05, 0.14, 0.03, tm, 0.09, 0.36, -0.06);
    tail.rotation.z = -0.2;
    upper.add(wrap, dome, tail);
  }

  if (type === 'woman') {
    ud.skirt = cyl(0.1, 0.17, 0.42, clothMat, 0, 0.21, 0, 10);
    g.add(ud.skirt);
    upper.add(cyl(0.085, 0.1, 0.28, topMat, 0, 0.14, 0, 8));
    const pallu = box(0.2, 0.28, 0.03, clothMat, 0, 0.15, 0.08);
    pallu.rotation.z = 0.4;
    upper.add(pallu);
    upper.add(ball(0.045, mats.hair, 0, 0.385, -0.09));
  } else {
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.045, hipY, 0);
      leg.add(cyl(0.04, 0.035, 0.36, type === 'kid' ? clothMat : dhoti ? skin : mats.white, 0, -0.18, 0, 6));
      g.add(leg);
      ud.legs.push(leg);
    }
    upper.add(cyl(0.09, 0.095, 0.3, bare ? skin : topMat, 0, 0.15, 0, 8));
    if (dhoti) {
      // vesti: white waist-cloth down to the knees, plus a shoulder cloth
      g.add(cyl(0.1, 0.135, 0.3, mats.white, 0, 0.23, 0, 10));
      const sash = box(0.27, 0.05, 0.17, mats.white, 0, 0.2, 0);
      sash.rotation.z = 0.55;
      upper.add(sash);
    }
  }

  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.115, 0.27, 0);
    arm.add(cyl(0.027, 0.024, 0.27, skin, 0, -0.135, 0, 5));
    upper.add(arm);
    ud.arms.push(arm);
  }

  if (pot) {
    const p = ball(0.085, mats.pot, 0, 0.52, 0, 1);
    p.scale.set(1, 0.9, 1);
    upper.add(p);
    upper.add(cyl(0.05, 0.06, 0.05, mats.pot, 0, 0.6, 0, 8));
    ud.arms[0].rotation.z = 2.6;
    ud.hasPot = true;
  } else {
    const um = new THREE.Group();
    um.position.set(0.1, 0.4, 0);
    um.add(mesh(new THREE.ConeGeometry(0.3, 0.14, 12), std(umbrella, { side: THREE.DoubleSide }), 0, 0.28, 0));
    um.add(cyl(0.01, 0.01, 0.3, mats.dark, 0, 0.14, 0, 4));
    um.visible = false;
    upper.add(um);
    ud.umbrella = um;
  }
  g.scale.setScalar(scale);
  return g;
}

/* ---------- bullock + cart ---------- */

export function makeBullock({ color = 0xf1ece0, hornScale = 1, scale = 1 } = {}) {
  const g = new THREE.Group();
  const m = std(color);
  const body = mesh(new THREE.CapsuleGeometry(0.24, 0.62, 3, 8), m, 0, 0.64, 0);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const hump = ball(0.17, m, 0, 0.9, 0.3, 1);
  hump.scale.set(1, 1, 1.25);
  g.add(hump);

  const head = new THREE.Group();
  head.position.set(0, 0.78, 0.55);
  const neck = box(0.26, 0.28, 0.34, m, 0, 0, 0.08);
  neck.rotation.x = 0.35;
  head.add(neck);
  head.add(box(0.24, 0.26, 0.38, m, 0, -0.04, 0.3));
  head.add(box(0.2, 0.17, 0.14, mats.muzzle, 0, -0.1, 0.52));
  for (const sx of [-1, 1]) {
    head.add(ball(0.025, mats.dark, sx * 0.125, 0.0, 0.34));
    const ear = box(0.14, 0.05, 0.08, m, sx * 0.19, 0.08, 0.2);
    ear.rotation.z = sx * -0.3;
    head.add(ear);
    const hornGeo = new THREE.TorusGeometry(0.17 * hornScale, 0.03, 5, 9, Math.PI * 0.55);
    hornGeo.rotateZ(-Math.PI / 2);
    const horn = mesh(hornGeo, mats.horn, sx * 0.1, 0.1, 0.18);
    horn.position.y += 0.17 * hornScale;
    horn.scale.x = sx;
    horn.rotation.x = -0.35;
    head.add(horn);
  }
  g.add(head);

  const legs = [];
  for (const [lx, lz] of [[-0.14, 0.3], [0.14, 0.3], [-0.14, -0.3], [0.14, -0.3]]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.5, lz);
    leg.add(cyl(0.05, 0.04, 0.5, m, 0, -0.25, 0, 5));
    leg.add(cyl(0.05, 0.05, 0.06, mats.hoof, 0, -0.5, 0.0, 5));
    g.add(leg);
    legs.push(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.78, -0.56);
  tail.add(cyl(0.015, 0.012, 0.5, m, 0, -0.25, 0, 4));
  tail.add(ball(0.04, mats.dark, 0, -0.52, 0));
  g.add(tail);

  g.scale.setScalar(scale);
  g.userData = { legs, head, tail, headBase: head.rotation.x };
  return g;
}

export function makeCart() {
  const g = new THREE.Group();
  const wheels = [];

  g.add(box(0.95, 0.07, 1.7, mats.wood, 0, 0.55, -0.1));
  for (const sx of [-1, 1]) {
    g.add(box(0.05, 0.3, 1.7, mats.darkWood, sx * 0.48, 0.7, -0.1));
    g.add(box(0.05, 0.05, 1.7, mats.darkWood, sx * 0.48, 0.86, -0.1));
  }
  g.add(box(0.95, 0.3, 0.05, mats.darkWood, 0, 0.7, -0.95));

  // woven hood
  const hoodGeo = new THREE.CylinderGeometry(0.56, 0.56, 1.6, 14, 1, true, Math.PI / 2, Math.PI);
  hoodGeo.rotateX(Math.PI / 2);
  const hood = mesh(hoodGeo, mats.weave, 0, 0.85, -0.1);
  hood.scale.y = 0.95;
  g.add(hood);
  for (let i = 0; i < 4; i++) {
    const ribGeo = new THREE.TorusGeometry(0.56, 0.018, 4, 14, Math.PI);
    g.add(mesh(ribGeo, mats.darkWood, 0, 0.85, -0.8 + i * 0.5));
  }

  // wheels with spokes
  for (const sx of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(sx * 0.56, 0.42, 0);
    const rimGeo = new THREE.TorusGeometry(0.4, 0.04, 6, 22);
    rimGeo.rotateY(Math.PI / 2);
    w.add(mesh(rimGeo, mats.darkWood));
    w.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8).rotateZ(Math.PI / 2), mats.wood));
    for (let i = 0; i < 8; i++) {
      const s = box(0.035, 0.8, 0.035, mats.wood, 0, 0, 0);
      s.rotation.x = (i * Math.PI) / 8;
      w.add(s);
    }
    g.add(w);
    wheels.push(w);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6).rotateZ(Math.PI / 2), mats.darkWood, 0, 0.42, 0));

  // shafts and yoke
  for (const sx of [-1, 1]) g.add(box(0.05, 0.05, 2.4, mats.wood, sx * 0.2, 0.58, 1.25));
  const yoke = cyl(0.025, 0.025, 0.8, mats.darkWood, 0, 1.0, 2.35, 5);
  yoke.rotation.z = Math.PI / 2;
  g.add(yoke);
  g.userData = { wheels, wheelR: 0.42 };
  return g;
}

/* ---------- plough, dogs, cats, geese, parrots ---------- */

// Faces +z. Origin is the share tip on the ground; the beam ends at the bullock's yoke.
export function makePlough() {
  const g = new THREE.Group();
  g.add(box(0.07, 0.62, 0.07, mats.darkWood, 0, 0.34, -0.12));
  const beam = box(0.06, 0.06, 1.38, mats.wood, 0, 0.735, 0.55);
  beam.rotation.x = -0.17;
  g.add(beam);
  const handle = box(0.05, 0.05, 0.72, mats.wood, 0, 0.485, -0.475);
  handle.rotation.x = 0.39;
  g.add(handle);
  g.add(box(0.34, 0.04, 0.04, mats.darkWood, 0, 0.62, -0.8));
  const share = mesh(new THREE.ConeGeometry(0.07, 0.4, 4), std(0x3a3a3a, { metalness: 0.4 }), 0, 0.05, 0.1);
  share.rotation.x = Math.PI / 2;
  g.add(share);
  g.userData.handle = new V3(0, 0.62, -0.8);
  return g;
}

export function makeDog({ color = 0xc9a063, ear = 0x5a3a22, scale = 1 } = {}) {
  const g = new THREE.Group();
  const m = std(color), em = std(ear);
  const body = mesh(new THREE.CapsuleGeometry(0.1, 0.34, 3, 8), m, 0, 0.32, 0);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  g.add(ball(0.085, std(0xf3ead8), 0, 0.3, 0.22, 1));
  const head = new THREE.Group();
  head.position.set(0, 0.43, 0.3);
  head.add(box(0.15, 0.14, 0.16, m, 0, 0, 0.06));
  head.add(box(0.09, 0.08, 0.13, std(0xe8d7b5), 0, -0.03, 0.2));
  head.add(ball(0.022, mats.dark, 0, -0.01, 0.27));
  for (const sx of [-1, 1]) {
    const e = box(0.04, 0.12, 0.07, em, sx * 0.085, 0.0, 0.02);
    e.rotation.z = sx * 0.35;
    head.add(e, ball(0.018, mats.dark, sx * 0.05, 0.03, 0.12));
  }
  g.add(head);
  const legs = [];
  for (const [lx, lz] of [[-0.07, 0.2], [0.07, 0.2], [-0.07, -0.2], [0.07, -0.2]]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.28, lz);
    leg.add(cyl(0.032, 0.026, 0.28, m, 0, -0.14, 0, 5));
    leg.add(ball(0.03, std(0xf3ead8), 0, -0.28, 0.01));
    g.add(leg);
    legs.push(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.38, -0.27);
  const tc = cyl(0.022, 0.012, 0.26, m, 0, 0.12, -0.05, 4);
  tc.rotation.x = -0.5;
  tail.add(tc);
  g.add(tail);
  g.scale.setScalar(scale);
  g.userData = { legs, head, tail };
  return g;
}

export function makeCat({ color = 0xe0893a, belly = 0xf5ecd8, scale = 1.15 } = {}) {
  const g = new THREE.Group();
  const m = std(color);
  const body = mesh(new THREE.CapsuleGeometry(0.065, 0.2, 3, 8), m, 0, 0.14, 0);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  g.add(ball(0.05, std(belly), 0, 0.12, 0.08, 1));
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.17);
  head.add(ball(0.065, m, 0, 0.0, 0.02, 1));
  for (const sx of [-1, 1]) {
    head.add(mesh(new THREE.ConeGeometry(0.025, 0.05, 4), m, sx * 0.04, 0.065, 0));
    head.add(ball(0.012, std(0x6fbf4a, { emissive: 0x6fbf4a, emissiveIntensity: 0.3 }), sx * 0.028, 0.012, 0.075));
  }
  head.add(ball(0.012, std(0xe08a8a), 0, -0.015, 0.085));
  g.add(head);
  const legs = [];
  for (const [lx, lz] of [[-0.04, 0.12], [0.04, 0.12], [-0.04, -0.12], [0.04, -0.12]]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.12, lz);
    leg.add(cyl(0.017, 0.014, 0.12, m, 0, -0.06, 0, 5));
    g.add(leg);
    legs.push(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.16, -0.2);
  const tc = cyl(0.014, 0.01, 0.3, m, 0, 0.13, -0.04, 4);
  tc.rotation.x = -0.45;
  tail.add(tc);
  g.add(tail);
  g.scale.setScalar(scale);
  g.userData = { legs, head, tail };
  return g;
}

export function makeGoose() {
  const g = new THREE.Group();
  const white = std(0xf7f4ec), orange = std(0xf09a2a);
  const body = ball(0.2, white, 0, 0.13, 0, 1);
  body.scale.set(0.72, 0.58, 1.15);
  g.add(body);
  const tail = mesh(new THREE.ConeGeometry(0.06, 0.16, 4), white, 0, 0.2, -0.23);
  tail.rotation.x = -1.2;
  g.add(tail);
  for (const sx of [-1, 1]) {
    const w = ball(0.1, std(0xe9e4d6), sx * 0.12, 0.17, -0.02, 1);
    w.scale.set(0.35, 0.55, 1.2);
    g.add(w);
  }
  const neck = new THREE.Group();
  neck.position.set(0, 0.2, 0.15);
  const low = cyl(0.04, 0.052, 0.2, white, 0, 0.09, 0.03, 6);
  low.rotation.x = 0.35;
  neck.add(low);
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.07);
  head.add(ball(0.052, white, 0, 0.03, 0.01, 1));
  const beak = mesh(new THREE.ConeGeometry(0.022, 0.08, 5), orange, 0, 0.025, 0.07);
  beak.rotation.x = Math.PI / 2;
  head.add(beak, ball(0.01, mats.dark, 0.03, 0.045, 0.03), ball(0.01, mats.dark, -0.03, 0.045, 0.03));
  neck.add(head);
  g.add(neck);
  g.userData = { neck, head };
  return g;
}

const parrotWingGeo = new THREE.BufferGeometry();
parrotWingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.06, 0.34, 0, -0.04, 0, 0, -0.1], 3));
parrotWingGeo.computeVertexNormals();

export function makeParrot({ perched = false, scale = 1 } = {}) {
  const g = new THREE.Group();
  const green = std(0x2fb34a), red = std(0xe53935), blue = std(0x2a6fd6), yellow = std(0xf4d03f);
  const body = ball(0.07, green, 0, 0, 0, 1);
  body.scale.set(0.8, 0.9, 1.35);
  g.add(body);
  g.add(ball(0.052, green, 0, 0.07, 0.075, 1));
  const beak = mesh(new THREE.ConeGeometry(0.02, 0.05, 5), red, 0, 0.065, 0.13);
  beak.rotation.x = Math.PI / 2 + 0.5;
  g.add(beak, ball(0.011, mats.dark, 0.03, 0.085, 0.1), ball(0.011, mats.dark, -0.03, 0.085, 0.1));
  g.add(ball(0.03, red, 0, 0.115, 0.05, 0));
  const tail = mesh(new THREE.ConeGeometry(0.03, 0.26, 4), green, 0, -0.01, -0.2);
  tail.rotation.x = -Math.PI / 2 - (perched ? 0.9 : 0.05);
  if (perched) tail.position.set(0, -0.12, -0.12);
  g.add(tail);
  const tip = mesh(new THREE.ConeGeometry(0.02, 0.08, 4), blue, 0, 0, 0);
  tip.rotation.x = tail.rotation.x;
  tip.position.set(0, tail.position.y - (perched ? 0.09 : 0.0), tail.position.z - (perched ? 0.06 : 0.14));
  g.add(tip);
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = mesh(parrotWingGeo, green);
    w.scale.x = sx;
    w.position.set(sx * 0.05, 0.03, 0.02);
    if (perched) w.scale.set(sx * 0.28, 1, 1.4);
    const patch = mesh(parrotWingGeo, yellow);
    patch.scale.set(0.55, 1, 0.4);
    patch.position.set(0, 0.003, 0);
    w.add(patch);
    g.add(w);
    wings.push(w);
  }
  g.scale.setScalar(scale);
  g.userData = { wings, perched };
  return g;
}
