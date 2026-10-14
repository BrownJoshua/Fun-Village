import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as B from './builders.js';
import { buildIsland, buildRibbon, buildMiniIsland, radiusAt } from './island.js';
import { Weather, PRESETS, TIMES } from './weather.js';
import {
  makeOnLane, walkPose, animalPose, DogWalker, CatBrain, GooseSwimmer, PloughPath,
  houseSpot, hutSpot, templeSpot,
} from './life.js';

const { mats } = B;
const rand = B.rng(2024);

/* ---------- renderer / scene ---------- */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2500);
camera.position.set(17.2, 11.4, 19.4);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, -1.8, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 12;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI * 0.64;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;

const weather = new Weather(scene, camera);

/* ---------- island + layout ---------- */

const island = new THREE.Group();
scene.add(island);
island.add(buildIsland());

// Houses sit well outside the lane so the cart, villagers and animals never touch a veranda or field.
const CZ = 0.5, AX = 5.2, AZ = 3.7;
const E = (deg, k) => {
  const a = (deg * Math.PI) / 180;
  return [k * AX * Math.cos(a), CZ + k * AZ * Math.sin(a)];
};
const faceCenter = (o) => (o.rotation.y = Math.atan2(-o.position.x, CZ - o.position.z));

// the looping village lane
const lanePts = [];
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  const k = 1 + 0.1 * Math.sin(2 * a + 0.5) + 0.07 * Math.sin(3 * a);
  lanePts.push(new THREE.Vector3(AX * k * Math.cos(a), 0, CZ + AZ * k * Math.sin(a)));
}
const lane = new THREE.CatmullRomCurve3(lanePts, true, 'catmullrom', 0.5);
const laneLen = lane.getLength();
const laneSamples = lane.getSpacedPoints(160);
const onLane = makeOnLane(lane);
island.add(buildRibbon(laneSamples.slice(0, -1), 2.2, 0.025, 0x9a7a4a, 0xa88858, true));
island.add(buildRibbon(laneSamples.slice(0, -1), 1.5, 0.032, 0xc9a56a, 0xd6b478, true));

const placed = [];
const isFree = (x, z, r, rimGap = 0.8, laneGap = 1.15) => {
  if (Math.hypot(x, z) > radiusAt(Math.atan2(z, x)) - rimGap - r) return false;
  for (const p of placed) if (Math.hypot(x - p.x, z - p.z) < p.r + r) return false;
  for (const s of laneSamples) if (Math.hypot(x - s.x, z - s.z) < laneGap + r) return false;
  return true;
};
const put = (obj, x, z, r, y = 0) => {
  obj.position.set(x, y, z);
  island.add(obj);
  placed.push({ x, z, r });
  return obj;
};
const toLane = (x, z) => laneSamples.reduce((b, s) => (Math.hypot(s.x - x, s.z - z) < Math.hypot(b.x - x, b.z - z) ? s : b));

const lights = [];
function addLamp(parent, local, base = 6) {
  const l = new THREE.PointLight(0xffa550, 0, 9, 2);
  l.userData = { base, phase: Math.random() * 6 };
  l.position.copy(local);
  parent.add(l);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mats.lampGlow);
  bulb.position.copy(local);
  parent.add(bulb);
  lights.push(l);
}

const palms = [], trees = [], walkers = [], chickens = [], chimneys = [], crowd = [], structures = [];
let temple = null;

// houses, huts and the temple, all facing the lane
const layout = [
  { t: 'tile', deg: 140, k: 1.98, o: { w: 3.2, d: 2.5, h: 1.7 }, r: 2.3 },
  { t: 'tile', deg: 186, k: 1.86, o: { w: 2.8, d: 2.3, h: 1.55 }, r: 2.1 },
  { t: 'hut', deg: 225, k: 1.8, o: {}, r: 1.7 },
  { t: 'temple', deg: 270, k: 2.28, o: {}, r: 3.4 },
  { t: 'tile', deg: 315, k: 1.88, o: { w: 2.6, d: 2.2, h: 1.5 }, r: 2.0 },
  { t: 'hut', deg: 354, k: 1.7, o: { r: 1.0 }, r: 1.7 },
];
layout.forEach((s, i) => {
  const [x, z] = E(s.deg, s.k);
  const obj = s.t === 'tile' ? B.makeTiledHouse(s.o) : s.t === 'hut' ? B.makeHut(s.o) : B.makeTemple();
  put(obj, x, z, s.r);
  faceCenter(obj);
  obj.updateMatrix();
  if (s.t === 'temple') temple = obj;
  if (s.t === 'hut') chimneys.push(obj.userData.chimney.clone().applyMatrix4(obj.matrix));
  structures.push({ obj, type: s.t });
  addLamp(obj, obj.userData.lamp, s.t === 'temple' ? 9 : 6);
  // footpath from the doorstep to the lane
  obj.updateMatrixWorld(true);
  const door = obj.localToWorld(obj.userData.doorFront.clone());
  const l = toLane(door.x, door.z);
  island.add(buildRibbon([new THREE.Vector3(door.x, 0, door.z), new THREE.Vector3(l.x, 0, l.z)], 0.7, 0.03, 0xc9a56a, 0xd6b478));
  if (s.t === 'tile') {
    const rg = B.makeRangoli(i);
    const rp = obj.localToWorld(new THREE.Vector3(0.9, 0, obj.userData.doorFront.z + 0.6));
    rg.position.set(rp.x, 0, rp.z);
    island.add(rg);
  }
});

// banyan with its platform, and the well
const banyan = put(B.makeBanyan(), -0.4, 0.7, 2.4);
addLamp(banyan, banyan.userData.lamp, 5);
trees.push(banyan);
const wellPos = new THREE.Vector3(2.4, 0, 1.3);
put(B.makeWell(), wellPos.x, wellPos.z, 1.0);

/* ---------- paddy field: ploughed rows in front, young rice behind ---------- */

const FIELD = { x: 9.1, z: 4.2, w: 4.6, d: 3.2 };
placed.push({ x: FIELD.x, z: FIELD.z, r: 2.6 });
const PLOUGH_ROWS = [0, 1, 2, 3].map((j) => FIELD.z - FIELD.d / 2 + 0.5 + j * 0.5);
const RICE_Z = [FIELD.z + 0.8, FIELD.z + FIELD.d / 2 - 0.15];
const furrowMat = new THREE.MeshStandardMaterial({ color: 0x56402a, roughness: 0.6, transparent: true });
const furrows = [];
{
  const g = new THREE.Group();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.w, FIELD.d),
    new THREE.MeshStandardMaterial({ color: 0x7d6b4a, roughness: 0.25, metalness: 0.1 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(FIELD.x, 0.06, FIELD.z);
  water.receiveShadow = true;
  g.add(water);
  const bund = new THREE.MeshStandardMaterial({ color: 0x8a6a42, flatShading: true, roughness: 1 });
  for (const [bx, bz, bw, bd] of [
    [0, -FIELD.d / 2, FIELD.w + 0.2, 0.14], [0, FIELD.d / 2, FIELD.w + 0.2, 0.14],
    [-FIELD.w / 2, 0, 0.14, FIELD.d], [FIELD.w / 2, 0, 0.14, FIELD.d],
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.14, bd), bund);
    m.position.set(FIELD.x + bx, 0.07, FIELD.z + bz);
    m.receiveShadow = true;
    g.add(m);
  }
  for (const z of PLOUGH_ROWS) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 0.13), furrowMat);
    f.position.set(FIELD.x, 0.085, z);
    f.scale.x = 0.001;
    f.receiveShadow = true;
    g.add(f);
    furrows.push(f);
  }
  island.add(g);
}

// instanced swaying vegetation (grass tufts + paddy rice)
const dummy = new THREE.Object3D();
function makeSway(count, geo, mat, positions, colors) {
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const c = new THREE.Color();
  positions.forEach((p, i) => {
    dummy.position.set(p[0], 0.02, p[1]);
    dummy.rotation.set(0, rand() * 6.28, 0);
    dummy.scale.setScalar(p[2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    c.setHex(colors[Math.floor(rand() * colors.length)]);
    mesh.setColorAt(i, c);
  });
  mesh.instanceColor.needsUpdate = true;
  island.add(mesh);
  return { mesh, positions };
}
const bladeGeo = new THREE.ConeGeometry(0.055, 0.34, 4).translate(0, 0.17, 0);
const bladeMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });

const ricePts = [];
for (let x = -FIELD.w / 2 + 0.2; x < FIELD.w / 2 - 0.1; x += 0.26) {
  for (let z = RICE_Z[0]; z < RICE_Z[1]; z += 0.26) {
    for (let k = 0; k < 3; k++) ricePts.push([FIELD.x + x + (rand() - 0.5) * 0.12, z + (rand() - 0.5) * 0.12, 0.9 + rand() * 0.5]);
  }
}
const rice = makeSway(ricePts.length, bladeGeo, bladeMat, ricePts, [0x6fb83a, 0x86c44a, 0x5aa532]);

// the plough team: one bullock, one farmer in a thalapa and vesti
const ploughPath = new PloughPath(FIELD.x - FIELD.w / 2 + 0.95, FIELD.x + FIELD.w / 2 - 1.0, PLOUGH_ROWS);
const ploughRig = new THREE.Group();
const plough = B.makePlough();
ploughRig.add(plough);
const ploughCow = B.makeBullock({ hornScale: 0.9, scale: 0.95 });
ploughCow.position.set(0, 0, 0.95);
ploughRig.add(ploughCow);
const farmer = B.makePerson({ type: 'man', turban: 0xf5efe0, dhoti: true, bare: true, scale: 0.88, seed: 2, umbrella: 0x777777 });
farmer.position.set(0, 0, -1.05);
ploughRig.add(farmer);
island.add(ploughRig);
const PLOUGH_SPEED = 0.45, PLOUGH_REST = 5;
const ploughCycle = ploughPath.total / PLOUGH_SPEED + PLOUGH_REST;
let ploughTilt = 0;

/* ---------- pond with geese ---------- */

const POND = { x: 1.4, z: 8.6, r: 2.0 };
placed.push({ x: POND.x, z: POND.z, r: 2.4 });
const geese = [];
{
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 28), mats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(POND.x, 0.06, POND.z);
  water.receiveShadow = true;
  g.add(water);
  const stone = new THREE.MeshStandardMaterial({ color: 0x9b9488, flatShading: true, roughness: 1 });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + rand() * 0.1, 0), stone);
    s.position.set(POND.x + Math.cos(a) * (POND.r + 0.05), 0.07, POND.z + Math.sin(a) * (POND.r + 0.05));
    s.castShadow = s.receiveShadow = true;
    g.add(s);
  }
  for (let i = 0; i < 6; i++) {
    const a = rand() * 6.28, d = 1.2 + rand() * 0.6;
    const px = POND.x + Math.cos(a) * d, pz = POND.z + Math.sin(a) * d;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.2, 8), new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 1 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(px, 0.075, pz);
    g.add(pad);
    if (i % 2 === 0) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0xf08ab4, flatShading: true }));
      f.position.set(px, 0.17, pz);
      g.add(f);
    }
  }
  island.add(g);

  const centre = new THREE.Vector3(POND.x, 0, POND.z);
  [
    { rx: 1.1, rz: 0.85, speed: 0.26, phase: 0 },
    { rx: 0.75, rz: 0.6, speed: 0.3, phase: 2.2 },
    { rx: 1.25, rz: 1.0, speed: -0.22, phase: 4.0 },
    { rx: 0.45, rz: 0.4, speed: -0.34, phase: 1.1 },
  ].forEach((o) => {
    const goose = B.makeGoose();
    island.add(goose);
    geese.push(new GooseSwimmer(goose, centre, o));
  });
}

/* ---------- scatter: palms, trees, bushes, grass ---------- */

for (let i = 0, tries = 0; i < 14 && tries < 800; tries++) {
  const a = rand() * Math.PI * 2, d = 5 + rand() * 8.5;
  const x = Math.cos(a) * d, z = Math.sin(a) * d;
  if (!isFree(x, z, 0.5, 0.7, 1.3)) continue;
  const p = B.makePalm(2.8 + rand() * 1.6, (rand() - 0.5) * 1.1, i + 1);
  p.rotation.y = rand() * 6.28;
  put(p, x, z, 0.8);
  palms.push(p);
  i++;
}
for (let i = 0, tries = 0; i < 6 && tries < 800; tries++) {
  const a = rand() * Math.PI * 2, d = 5 + rand() * 7.5;
  const x = Math.cos(a) * d, z = Math.sin(a) * d;
  if (!isFree(x, z, 0.9, 0.8, 1.4)) continue;
  const t = B.makeTree({ h: 1.8 + rand() * 1.2, seed: i + 3, scale: 0.65 + rand() * 0.3 });
  put(t, x, z, 1.0);
  trees.push(t);
  i++;
}
for (let i = 0, tries = 0; i < 44 && tries < 1000; tries++) {
  const a = rand() * Math.PI * 2, d = rand() * 12.5;
  const x = Math.cos(a) * d, z = Math.sin(a) * d;
  if (!isFree(x, z, 0.35, 0.6, 1.1)) continue;
  const b = B.makeBush(i + 11);
  b.position.set(x, 0, z);
  b.rotation.y = rand() * 6.28;
  island.add(b);
  placed.push({ x, z, r: 0.35 });
  i++;
}
for (const [x, z] of [[-9.6, -3.4], [11.0, 0.9]]) {
  if (isFree(x, z, 0.6, 0.5, 0.6)) put(B.makeHaystack(), x, z, 0.7);
}

const grassPts = [];
for (let tries = 0; grassPts.length < 560 && tries < 4000; tries++) {
  const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 13.5;
  const x = Math.cos(a) * d, z = Math.sin(a) * d;
  if (Math.hypot(x, z) > radiusAt(a) - 0.4) continue;
  if (Math.abs(x - FIELD.x) < FIELD.w / 2 + 0.3 && Math.abs(z - FIELD.z) < FIELD.d / 2 + 0.3) continue;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.3) continue;
  if (laneSamples.some((s) => Math.hypot(s.x - x, s.z - z) < 1.2)) continue;
  if (placed.some((p) => p.r > 1 && Math.hypot(x - p.x, z - p.z) < p.r * 0.75)) continue;
  grassPts.push([x, z, 0.7 + rand() * 0.9]);
}
const grass = makeSway(grassPts.length, bladeGeo, bladeMat, grassPts, [0x7cb342, 0x8bc34a, 0x689f38, 0xa5c84a]);

/* ---------- power poles + wires ---------- */

{
  const polePos = [[11.4, -3.9], [12.2, -1.0], [12.1, 1.8]];
  const poles = polePos.map(([x, z]) => put(B.makePole(3.7), x, z, 0.3));
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1b1b1b });
  const verts = [];
  const top = poles[0].userData.wireTop;
  for (let i = 0; i < poles.length - 1; i++) {
    for (const ox of [-0.45, 0, 0.45]) {
      let prev = null;
      for (let s = 0; s <= 10; s++) {
        const f = s / 10;
        const p = new THREE.Vector3(
          polePos[i][0] + (polePos[i + 1][0] - polePos[i][0]) * f + ox,
          top.y - 0.35 * 4 * f * (1 - f) - (ox === 0 ? 0.1 : 0),
          polePos[i][1] + (polePos[i + 1][1] - polePos[i][1]) * f
        );
        if (prev) verts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        prev = p;
      }
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  island.add(new THREE.LineSegments(wg, wireMat));
}

/* ---------- chickens, dogs and cats ---------- */

for (let i = 0; i < 6; i++) {
  const home = structures[i < 3 ? 0 : 1].obj;
  const p = home.localToWorld(new THREE.Vector3((rand() - 0.5) * 1.4, 0, home.userData.doorFront.z + 1.0));
  const c = B.makeChicken(i);
  island.add(c);
  chickens.push({ c, bx: p.x, bz: p.z, ph: rand() * 6 });
}

const dogs = [
  new DogWalker(B.makeDog({ color: 0xc9a063 }), onLane, laneLen, { u: 0.2, dir: 1, speed: 0.95, off: 0.6 }, rand),
  new DogWalker(B.makeDog({ color: 0x4a3a30, ear: 0x2a1f19, scale: 0.92 }), onLane, laneLen, { u: 0.7, dir: -1, speed: 0.8, off: -0.6 }, rand),
];
dogs.forEach((d) => island.add(d.dog));

// perches: each structure gets a climbing route up its wall to the roof or tower
const spots = structures.map(({ obj, type }) => (type === 'tile' ? houseSpot(obj) : type === 'hut' ? hutSpot(obj) : templeSpot(obj)));
const templeIdx = structures.findIndex((s) => s.type === 'temple');
const cats = [
  new CatBrain(B.makeCat({ color: 0xe0893a }), spots, lane, laneSamples, 0, rand),
  new CatBrain(B.makeCat({ color: 0x6f7378, belly: 0xe9e6df, scale: 1.1 }), spots, lane, laneSamples, templeIdx, rand),
];
cats.forEach((c) => island.add(c.cat));

/* ---------- bullock cart and villagers walking the lane ---------- */

// the cart and its bullocks are placed separately on the lane, so each one follows the road's curve
const CART_GAP = 2.15;
const cartRig = new THREE.Group();
const cart = B.makeCart();
cartRig.add(cart);
const driver = B.makePerson({ type: 'man', top: 0xf2e6c9, scale: 0.85, seed: 1, turban: 0xd9481e });
driver.position.set(0.0, 0.62, 1.15);
driver.userData.legs.forEach((l) => (l.rotation.x = -1.35));
cartRig.add(driver);
const yokeRig = new THREE.Group();
const bullocks = [];
for (const sx of [-1, 1]) {
  const b = B.makeBullock({ hornScale: 1 });
  b.position.set(sx * 0.3, 0, 0);
  yokeRig.add(b);
  bullocks.push(b);
}
island.add(cartRig, yokeRig);
let cartU = 0.62;

const addWalker = (person, u, speed, off, dir) => {
  island.add(person);
  walkers.push({ p: person, u, speed, off, dir, phase: rand() * 6 });
};
addWalker(B.makePerson({ type: 'woman', cloth: 0xd9481e, top: 0x2e8b57, pot: true, seed: 0 }), 0.05, 0.5, 0.55, 1);
addWalker(B.makePerson({ type: 'kid', cloth: 0x2d5fa8, top: 0x4a9bd6, scale: 0.55, seed: 2 }), 0.075, 0.5, 0.2, 1);
addWalker(B.makePerson({ type: 'woman', cloth: 0x2a8f5a, top: 0xe0b030, pot: true, seed: 3 }), 0.35, 0.42, -0.5, -1);
addWalker(B.makePerson({ type: 'man', top: 0x3a7bd5, scale: 0.9, seed: 1, umbrella: 0x222222 }), 0.85, 0.4, 0.5, -1);
addWalker(B.makePerson({ type: 'woman', cloth: 0xc02f7a, top: 0xf5f0e0, scale: 0.88, seed: 2, umbrella: 0xe0a020 }), 0.18, 0.36, -0.45, 1);
addWalker(B.makePerson({ type: 'man', turban: 0xe8dcc0, dhoti: true, bare: true, scale: 0.88, seed: 3, umbrella: 0x555555 }), 0.48, 0.45, 0.5, 1);
addWalker(B.makePerson({ type: 'kid', cloth: 0xd9a21e, top: 0xe05a8a, scale: 0.55, seed: 1 }), 0.505, 0.45, 0.2, 1);
addWalker(B.makePerson({ type: 'woman', cloth: 0x3a5fc0, top: 0xf2c14e, pot: true, seed: 1 }), 0.92, 0.4, 0.45, -1);
addWalker(B.makePerson({ type: 'man', top: 0xb8552a, scale: 0.88, seed: 0, umbrella: 0x2a6fa0 }), 0.27, 0.38, -0.5, 1);

// children playing around the well
const kids = [];
for (let i = 0; i < 2; i++) {
  const k = B.makePerson({ type: 'kid', cloth: i ? 0xd9a21e : 0xc0392b, top: i ? 0xe05a8a : 0x4a9bd6, scale: 0.55, seed: i + 2 });
  island.add(k);
  kids.push({ k, ph: i * Math.PI });
}

/* ---------- a village gathering under the banyan ---------- */

{
  const cx = banyan.position.x, cz = banyan.position.z;
  const people = [
    // seated on the platform (top at y = 0.35)
    { deg: 200, r: 1.0, seated: true, o: { type: 'man', turban: 0xf5efe0, dhoti: true, bare: true, seed: 0 } },
    { deg: 245, r: 1.0, seated: true, o: { type: 'woman', cloth: 0xd9481e, top: 0x2e8b57, seed: 1 } },
    { deg: 295, r: 1.0, seated: true, o: { type: 'man', top: 0x3a7bd5, seed: 2 } },
    { deg: 345, r: 1.0, seated: true, o: { type: 'woman', cloth: 0x2a8f5a, top: 0xe0b030, seed: 3 } },
    { deg: 150, r: 1.0, seated: true, o: { type: 'kid', cloth: 0x2d5fa8, top: 0x4a9bd6, scale: 0.55, seed: 2 } },
    // standing in a loose circle around it
    { deg: 115, r: 2.2, o: { type: 'woman', cloth: 0xc02f7a, top: 0xf5f0e0, seed: 2 } },
    { deg: 158, r: 2.25, o: { type: 'man', top: 0xb8552a, seed: 1 } },
    { deg: 200, r: 2.3, o: { type: 'woman', cloth: 0x3a5fc0, top: 0xf2c14e, seed: 0 } },
    { deg: 245, r: 2.2, o: { type: 'man', turban: 0xd9481e, dhoti: true, bare: true, seed: 3 } },
    { deg: 288, r: 2.2, o: { type: 'woman', cloth: 0x8e44ad, top: 0xf0d9b5, seed: 3 } },
    { deg: 325, r: 2.1, o: { type: 'kid', cloth: 0xd9a21e, top: 0xe05a8a, scale: 0.55, seed: 1 } },
    { deg: 90, r: 2.1, o: { type: 'man', top: 0x2a8f5a, seed: 2 } },
  ];
  people.forEach((c, i) => {
    const a = (c.deg * Math.PI) / 180;
    const x = cx + Math.cos(a) * c.r, z = cz + Math.sin(a) * c.r;
    const p = B.makePerson({ scale: 0.85, umbrella: 0x9b2d30, ...c.o });
    p.position.set(x, 0, z);
    p.rotation.y = Math.atan2(cx - x, cz - z) + (rand() - 0.5) * 0.5;
    if (c.seated) {
      p.position.y = 0.39 - 0.36 * p.scale.y;
      p.userData.legs.forEach((l) => (l.rotation.x = -1.45));
    }
    island.add(p);
    crowd.push({ p, ph: rand() * 6, seated: !!c.seated, talk: i % 2 === 0 });
  });
}

/* ---------- chimney smoke ---------- */

const smokeTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const PUFFS = 12, PUFF_LIFE = 5;
const smoke = [];
chimneys.forEach((origin) => {
  for (let i = 0; i < PUFFS; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.renderOrder = 3;
    island.add(sp);
    smoke.push({ sp, origin, t: i / PUFFS, drift: (rand() - 0.5) * 0.4, spin: rand() * 6.28 });
  }
});

/* ---------- rain splashes on the ground ---------- */

const splashes = [];
const splashGeo = new THREE.RingGeometry(0.85, 1, 14).rotateX(-Math.PI / 2);
for (let i = 0; i < 90; i++) {
  const m = new THREE.Mesh(splashGeo, new THREE.MeshBasicMaterial({ color: 0xdfeaf5, transparent: true, opacity: 0, depthWrite: false, fog: true }));
  m.position.y = 0.07;
  m.visible = false;
  island.add(m);
  splashes.push({ m, t: rand() });
}

/* ---------- fireflies for the night ---------- */

const flyN = 80;
const flyPos = new Float32Array(flyN * 3);
const flySeed = Array.from({ length: flyN }, () => [rand() * 6.28, 2 + rand() * 10, 0.3 + rand() * 1.8, rand() * 6]);
const flyGeo = new THREE.BufferGeometry();
flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ color: 0xd8ff6a, size: 0.14, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
flies.frustumCulled = false;
island.add(flies);

/* ---------- lamps register with the weather system ---------- */

weather.lamps = lights;

/* ---------- crows, parrots and floating rocks ---------- */

const flyers = [];
{
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.9, 0, 0.25, 0, 0, -0.3], 3));
  wingGeo.computeVertexNormals();
  const bm = new THREE.MeshBasicMaterial({ color: 0x2a2420, side: THREE.DoubleSide, fog: true });
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    const l = new THREE.Mesh(wingGeo, bm), r = new THREE.Mesh(wingGeo, bm);
    r.scale.x = -1;
    g.add(l, r);
    const size = 0.45 + rand() * 0.25;
    scene.add(g);
    flyers.push({ g, wings: [l, r], size, a: rand() * 6.28, rad: 16 + rand() * 8, h: 6 + rand() * 6, sp: (0.08 + rand() * 0.06) * (i % 2 ? 1 : -1), ph: rand() * 6, flap: 7, vis: 'bird' });
  }
  // a noisy flock of parrots circling low over the village
  for (let i = 0; i < 6; i++) {
    const g = B.makeParrot({ scale: 1.5 });
    scene.add(g);
    flyers.push({ g, wings: g.userData.wings, size: 1, a: i * 0.16, rad: 7 + rand() * 4, h: 6.2 + rand() * 1.8, sp: 0.42 + rand() * 0.08, ph: rand() * 6, flap: 16, vis: 'parrot' });
  }
}
// two parrots perched on palm crowns
palms.slice(0, 4).filter((_, i) => i % 2 === 0).forEach((p, i) => {
  const parrot = B.makeParrot({ perched: true, scale: 1.5 });
  parrot.position.set(0.12, 0.2, 0.1);
  parrot.rotation.y = i ? 2.2 : -1.0;
  p.userData.crown.add(parrot);
});

const minis = [];
for (const [x, y, z, rad, tree] of [[-21, -2, -10, 1.7, 'palm'], [23, 3, -11, 1.3, 'tree'], [-17, 4, 19, 1.1, 'palm'], [24, -4, 16, 1.5, 'tree'], [2, 7, -26, 1.0, 'palm']]) {
  const m = buildMiniIsland(minis.length + 1, rad);
  m.position.set(x, y, z);
  const t = tree === 'palm' ? B.makePalm(1.8 + rad, 0.3, minis.length + 40) : B.makeTree({ h: 1.2, seed: minis.length + 4, scale: 0.55 });
  t.scale.multiplyScalar(0.7);
  t.position.y = 0.15;
  m.add(t);
  m.userData.home = new THREE.Vector3(x, y, z);
  scene.add(m);
  minis.push(m);
  if (tree === 'palm') palms.push(t);
}

/* ---------- village sounds ---------- */

const audio = weather.sound;
const wp = new THREE.Vector3();
const emitFrom = (kind, obj, opts) => {
  obj.getWorldPosition(wp);
  audio.emit(kind, wp, camera, opts);
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const range = ([a, b]) => a + rand() * (b - a);
// each emitter fires at random intervals while its `when` condition holds
const ambience = [
  { kind: 'child', every: [2.5, 6], src: () => pick(kids).k, when: (e) => e.day > 0.4 && e.rain < 0.6 },
  { kind: 'child', every: [7, 14], src: () => pick(crowd.filter((c) => c.p.scale.y < 0.6)).p, when: (e) => e.day > 0.4 && e.rain < 0.6 },
  { kind: 'bark', every: [12, 24], src: () => pick(dogs).dog, when: () => true },
  { kind: 'meow', every: [10, 20], src: () => pick(cats).cat, when: () => true },
  { kind: 'moo', every: [9, 18], src: () => pick([...bullocks, ploughCow]), when: () => true },
  { kind: 'bell', every: [7, 12], src: () => temple, when: () => true, at: () => temple.userData.bell },
  { kind: 'conch', every: [45, 80], src: () => temple, when: () => true, at: () => temple.userData.bell },
  { kind: 'drum', every: [30, 55], src: () => temple, when: () => true, at: () => temple.userData.bell },
].map((a) => ({ ...a, next: range(a.every) * 0.5 }));

dogs.forEach((d) => (d.onPause = () => rand() < 0.5 && emitFrom('bark', d.dog)));
cats.forEach((c) => (c.onPerch = () => emitFrom('meow', c.cat)));

function tickAmbience(t, env) {
  if (!audio.enabled) return;
  for (const a of ambience) {
    if (t < a.next) continue;
    a.next = t + range(a.every);
    if (!a.when(env)) continue;
    if (a.at) {
      wp.copy(a.at());
      temple.localToWorld(wp);
      audio.emit(a.kind, wp, camera);
    } else emitFrom(a.kind, a.src());
  }
}

/* ---------- UI ---------- */

const $ = (s) => document.querySelector(s);
const sliders = {
  cloud: $('#s-cloud'), rain: $('#s-rain'), fog: $('#s-fog'), wind: $('#s-wind'), storm: $('#s-storm'),
};
const timeSlider = $('#s-time');
const timeLabel = $('#time-label');
const presetBtns = [...document.querySelectorAll('[data-weather]')];
const timeBtns = [...document.querySelectorAll('[data-time]')];

const fmtTime = (h) => {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const ap = hh >= 12 ? 'PM' : 'AM';
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ap}`;
};
const markPreset = (name) => presetBtns.forEach((b) => b.classList.toggle('on', b.dataset.weather === name));

function syncSliders() {
  for (const k of Object.keys(sliders)) sliders[k].value = weather.tgt[k];
  timeSlider.value = weather.time;
  timeLabel.textContent = fmtTime(weather.time);
}

presetBtns.forEach((b) =>
  b.addEventListener('click', () => {
    weather.setPreset(b.dataset.weather);
    markPreset(b.dataset.weather);
    syncSliders();
  })
);
for (const [k, el] of Object.entries(sliders)) {
  el.addEventListener('input', () => {
    weather.set(k, parseFloat(el.value));
    markPreset(null);
  });
}
timeSlider.addEventListener('input', () => {
  weather.setTime(parseFloat(timeSlider.value));
  timeLabel.textContent = fmtTime(weather.time);
  timeBtns.forEach((b) => b.classList.remove('on'));
});
timeBtns.forEach((b) =>
  b.addEventListener('click', () => {
    weather.setTime(TIMES[b.dataset.time]);
    timeBtns.forEach((x) => x.classList.toggle('on', x === b));
    syncSliders();
  })
);
$('#t-rotate').addEventListener('change', (e) => (controls.autoRotate = e.target.checked));
$('#t-flow').addEventListener('change', (e) => (weather.flow = e.target.checked));
$('#t-sound').addEventListener('change', (e) => {
  const on = weather.sound.toggle();
  e.target.checked = on;
});
$('#s-vol').addEventListener('input', (e) => audio.setVolume(parseFloat(e.target.value)));
$('#panel-toggle').addEventListener('click', () => $('#panel').classList.toggle('closed'));
window.addEventListener('keydown', (e) => {
  const map = { 1: 'sunny', 2: 'cloudy', 3: 'rain', 4: 'storm', 5: 'mist' };
  if (map[e.key]) {
    weather.setPreset(map[e.key]);
    markPreset(map[e.key]);
    syncSliders();
  }
});

markPreset('sunny');
syncSliders();

/* ---------- resize + loop ---------- */

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the island framed on tall (phone) screens
  camera.fov = w / h < 0.9 ? 50 : 40;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
if (window.innerWidth < 560) $('#panel').classList.add('closed');

const clock = new THREE.Clock();
let elapsed = 0;
const INTRO = 3.4;
const introDir = camera.position.clone().sub(controls.target).normalize();
let finalDist = camera.position.distanceTo(controls.target) * (window.innerWidth / window.innerHeight < 0.9 ? 1.7 : 1);
let flowSync = 0;
const smoothstep = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const t = elapsed;

  weather.update(dt, t);
  const w = weather.cur;
  const wind = w.wind;
  const night = 1 - weather.day;
  const rainy = w.rain;

  // intro dolly
  if (elapsed < INTRO) {
    const f = 1 - Math.pow(1 - elapsed / INTRO, 3);
    const d = 95 + (finalDist - 95) * f;
    camera.position.copy(controls.target).addScaledVector(introDir, d);
  }
  controls.update();

  // floating bob
  island.position.y = Math.sin(t * 0.7) * 0.22;
  island.rotation.z = Math.sin(t * 0.5) * 0.012;
  island.rotation.x = Math.cos(t * 0.43) * 0.01;

  // palms & trees
  const amp = 0.012 + wind * 0.05;
  for (const p of palms) {
    p.rotation.z = Math.sin(t * 1.1 + p.userData.phase) * amp;
    for (const f of p.userData.fronds) f.leaf.rotation.x = f.base + Math.sin(t * (2 + wind * 2.5) + f.phase) * (0.04 + wind * 0.12);
  }
  for (const tr of trees) tr.rotation.z = Math.sin(t * 0.9 + tr.userData.phase) * (0.004 + wind * 0.02);

  // grass & paddy
  const lean = 0.05 + wind * 0.3;
  for (const set of [grass, rice]) {
    const { mesh, positions } = set;
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const s = Math.sin(t * (1.6 + wind * 2) + p[0] * 0.7 + p[1] * 0.45);
      dummy.position.set(p[0], 0.02, p[1]);
      dummy.rotation.set(s * lean * 0.6, i, lean * 0.5 + s * lean);
      dummy.scale.setScalar(p[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  // temple flag
  if (temple) {
    const fl = temple.userData.flag, base = temple.userData.flagBase;
    const pos = fl.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], f = (x + 0.3) / 0.6;
      pos.setZ(i, Math.sin(f * 8 - t * (4 + wind * 8)) * 0.08 * f * (0.3 + wind * 1.6));
    }
    pos.needsUpdate = true;
  }

  // bullock cart: cart and bullocks each follow the lane, so they stay on the road
  const cartSpeed = (0.5 * (1 + rainy * 0.3)) / laneLen;
  cartU += cartSpeed * dt;
  onLane(cartRig, cartU - CART_GAP / laneLen, 0, 1, Math.abs(Math.sin(t * 6)) * 0.008);
  onLane(yokeRig, cartU, 0);
  const dist = cartSpeed * laneLen * dt;
  cart.userData.wheels.forEach((wh) => (wh.rotation.x += dist / cart.userData.wheelR));
  bullocks.forEach((b, i) => animalPose(b, t * 4 + i * 1.7));

  // villagers
  const rush = 1 + rainy * 0.7;
  const umbrellaOn = rainy > 0.2;
  for (const wk of walkers) {
    wk.u += (wk.dir * wk.speed * rush * dt) / laneLen;
    wk.phase += wk.speed * rush * dt * 9;
    onLane(wk.p, wk.u, wk.off, wk.dir, Math.abs(Math.sin(wk.phase)) * 0.015);
    walkPose(wk.p, wk.phase);
    if (wk.p.userData.umbrella) wk.p.userData.umbrella.visible = umbrellaOn;
  }
  for (const k of kids) {
    const a = t * 1.1 + k.ph, r = 1.15;
    k.k.position.set(wellPos.x + Math.cos(a) * r, Math.abs(Math.sin(a * 6)) * 0.03, wellPos.z + Math.sin(a) * r);
    k.k.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
    walkPose(k.k, t * 9 + k.ph);
    if (k.k.userData.umbrella) k.k.userData.umbrella.visible = umbrellaOn;
  }

  // the gathering under the banyan
  for (const c of crowd) {
    const u = c.p.userData;
    u.upper.rotation.x = Math.sin(t * 0.7 + c.ph) * 0.03;
    if (c.talk) u.arms[1].rotation.x = -0.45 + Math.sin(t * 1.7 + c.ph) * 0.4;
    else if (!c.seated) u.arms[0].rotation.x = Math.sin(t * 1.1 + c.ph) * 0.12;
    if (!c.seated) c.p.rotation.z = Math.sin(t * 0.6 + c.ph) * 0.015;
    if (u.umbrella) u.umbrella.visible = umbrellaOn;
  }

  // ploughing: rows with a turn at each end, then a rest while the furrows fade
  {
    const ph = t % ploughCycle;
    const s = ph * PLOUGH_SPEED;
    const done = s >= ploughPath.total;
    const pose = ploughPath.at(s);
    ploughRig.visible = !(done && ph > ploughCycle - 0.8);
    ploughRig.position.set(pose.x, 0.06, pose.z);
    ploughRig.rotation.y = pose.yaw;
    const moving = done ? 0 : 1;
    const gait = ph * PLOUGH_SPEED * 6.5;
    animalPose(ploughCow, gait, 0.4 * moving);
    walkPose(farmer, gait, moving);
    farmer.userData.arms.forEach((a) => (a.rotation.x = -1.3));
    farmer.userData.upper.rotation.x = 0.3;
    ploughTilt += ((pose.cutting ? 0 : -0.3) - ploughTilt) * Math.min(1, dt * 5);
    plough.rotation.x = ploughTilt;
    furrows.forEach((f, j) => {
      const p = done || pose.row > j ? 1 : pose.row === j ? pose.frac : 0;
      const len = Math.max(0.001, p * ploughPath.rowLen);
      const dir = j % 2 === 0 ? 1 : -1;
      const x0 = dir > 0 ? ploughPath.x0 : ploughPath.x1;
      f.scale.x = len;
      f.position.x = x0 + (dir * len) / 2;
    });
    const sinceDone = ph - ploughPath.total / PLOUGH_SPEED;
    furrowMat.opacity = done ? 1 - smoothstep(1.5, PLOUGH_REST - 0.6, sinceDone) : 1;
  }

  // dogs, cats, chickens
  for (const d of dogs) d.update(dt, t, 1 + rainy * 0.4);
  for (const c of cats) c.update(dt, t);
  for (const c of chickens) {
    const a = t * 0.35 + c.ph;
    c.c.position.set(c.bx + Math.cos(a) * 0.7, 0, c.bz + Math.sin(a * 1.3) * 0.7);
    c.c.rotation.y = Math.atan2(-Math.sin(a) * 0.7, Math.cos(a * 1.3) * 0.91);
    c.c.userData.head.rotation.x = Math.max(0, Math.sin(t * 4 + c.ph * 3)) * 0.9;
  }
  for (const g of geese) g.update(t);

  // rain splashes on the ground
  const splashN = Math.floor(splashes.length * rainy);
  splashes.forEach((s, i) => {
    const on = i < splashN;
    s.m.visible = on;
    if (!on) return;
    s.t += dt * 1.8;
    if (s.t >= 1) {
      s.t = 0;
      const a = rand() * 6.28, d = Math.sqrt(rand()) * 11.5;
      s.m.position.x = Math.cos(a) * d;
      s.m.position.z = Math.sin(a) * d;
    }
    s.m.scale.setScalar(0.03 + s.t * 0.32);
    s.m.material.opacity = (1 - s.t) * 0.55;
  });

  // chimney smoke: rises, widens and fades; wind bends it, rain flattens it
  const smokeCol = 0.3 + 0.32 * weather.day;
  for (const s of smoke) {
    s.t += (dt / PUFF_LIFE) * (1 + rainy * 0.5);
    if (s.t >= 1) s.t -= 1;
    const k = s.t;
    const bend = (0.25 + wind * 2.2) * k * k;
    s.sp.position.set(
      s.origin.x + bend * 1.6 + Math.sin(t * 0.8 + s.spin) * 0.06 * k + s.drift * k,
      s.origin.y + k * (1.9 - rainy * 0.7),
      s.origin.z + bend * 0.5
    );
    s.sp.scale.setScalar(0.22 + k * 1.1);
    s.sp.material.opacity = Math.sin(Math.min(1, k * 6) * Math.PI / 2) * (1 - k) * 0.85 * (1 - w.fog * 0.4);
    s.sp.material.color.setScalar(smokeCol);
  }

  // fireflies
  const flyOp = night * (1 - rainy) * (1 - w.fog * 0.6);
  flies.visible = flyOp > 0.02;
  if (flies.visible) {
    flies.material.opacity = flyOp * (0.6 + 0.4 * Math.sin(t * 3));
    flySeed.forEach((s, i) => {
      const a = s[0] + t * 0.12 * (1 + (i % 3));
      flyPos[i * 3] = Math.cos(a + s[3]) * s[1] + Math.sin(t * 0.7 + s[3]) * 0.6;
      flyPos[i * 3 + 1] = s[2] + Math.sin(t * 1.3 + s[3] * 2) * 0.4;
      flyPos[i * 3 + 2] = Math.sin(a) * s[1] + Math.cos(t * 0.6 + s[3]) * 0.6;
    });
    flyGeo.attributes.position.needsUpdate = true;
  }

  // crows and parrots only fly in fair weather
  const fair = weather.day * (1 - rainy) * (1 - w.storm) * (1 - w.fog * 0.7);
  for (const b of flyers) {
    const vis = b.vis === 'parrot' ? fair * 1.2 : fair;
    b.g.visible = vis > 0.1;
    if (!b.g.visible) continue;
    b.a += b.sp * dt * (1 + wind);
    b.g.position.set(Math.cos(b.a) * b.rad, b.h + Math.sin(t * 0.8 + b.ph) * 0.8, Math.sin(b.a) * b.rad);
    b.g.rotation.y = -b.a + (b.sp > 0 ? 0 : Math.PI);
    // the mirrored wing flaps with the opposite sign: index 1 for crows, index 0 for parrots
    const flap = Math.sin(t * b.flap + b.ph) * 0.6 * (b.vis === 'parrot' ? -1 : 1);
    b.wings[0].rotation.z = flap;
    b.wings[1].rotation.z = -flap;
    if (b.vis === 'bird') b.g.scale.setScalar(b.size * Math.min(1, vis * 1.5));
  }

  tickAmbience(t, { day: weather.day, rain: rainy });

  // floating rocks
  minis.forEach((m, i) => {
    m.position.y = m.userData.home.y + Math.sin(t * 0.6 + m.userData.phase) * 0.35;
    m.rotation.y = t * 0.05 * (i % 2 ? 1 : -1);
  });

  renderer.render(scene, camera);

  // keep the UI clock in step while time flows
  if (weather.flow && (flowSync += dt) > 0.15) {
    flowSync = 0;
    timeSlider.value = weather.time;
    timeLabel.textContent = fmtTime(weather.time);
    timeBtns.forEach((b) => b.classList.remove('on'));
  }
  requestAnimationFrame(frame);
}

document.body.classList.add('ready');
frame();

// handy for debugging from the console
window.village = { weather, camera, controls, scene, renderer, PRESETS, cats, dogs, spots, lane, laneSamples, structures, FIELD, POND };
