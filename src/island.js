// The floating island: grass top, soil lip, jagged rock underside and road ribbons.
import * as THREE from 'three';
import { mats, rng } from './builders.js';

export const ISLAND_R = 13.5;
const SEGMENTS = 96;

export const radiusAt = (a) =>
  ISLAND_R * (1 + 0.05 * Math.sin(3 * a + 1.2) + 0.035 * Math.sin(5 * a + 0.4) + 0.025 * Math.sin(8 * a + 2.1));

const hash = (i, j) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function indexGrid(cols, rowsCount) {
  const idx = [];
  for (let j = 0; j < rowsCount - 1; j++) {
    for (let i = 0; i < cols; i++) {
      const i2 = (i + 1) % cols;
      const a = j * cols + i, b = j * cols + i2, c = (j + 1) * cols + i, d = (j + 1) * cols + i2;
      idx.push(a, b, c, b, d, c);
    }
  }
  return idx;
}

function buildTop() {
  const rings = 18;
  const pos = [], col = [];
  const center = new THREE.Color(0x86b447), mid = new THREE.Color(0x6a9c35), edge = new THREE.Color(0x4f8a2f);
  const patch = new THREE.Color(0xb0bd4e), tmp = new THREE.Color();
  for (let k = 0; k <= rings; k++) {
    const f = k / rings;
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const r = f * radiusAt(a);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, 0, z);
      tmp.copy(center).lerp(mid, Math.min(1, f * 1.6)).lerp(edge, Math.max(0, f - 0.55) * 2);
      const n = Math.sin(x * 0.55) * Math.sin(z * 0.5) + 0.5 * Math.sin(x * 1.3 + z * 0.9);
      tmp.lerp(patch, Math.max(0, n - 0.35) * 0.55);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(indexGrid(SEGMENTS, rings + 1));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mats.ground);
  m.receiveShadow = true;
  return m;
}

function buildUnderside() {
  const rows = [
    { y: 0.0, r: 1.0, c: 0x4f8a2f, j: 0 },
    { y: -0.28, r: 1.0, c: 0x3f7a28, j: 0.01 },
    { y: -0.55, r: 0.985, c: 0x8a6040, j: 0.02 },
    { y: -1.5, r: 0.92, c: 0x6d4a33, j: 0.05 },
    { y: -3.0, r: 0.78, c: 0x6a5748, j: 0.09 },
    { y: -4.8, r: 0.6, c: 0x5b4c43, j: 0.12 },
    { y: -6.6, r: 0.4, c: 0x504339, j: 0.14 },
    { y: -8.4, r: 0.2, c: 0x453a32, j: 0.16 },
  ];
  const pos = [], col = [];
  const c = new THREE.Color();
  rows.forEach((row, jr) => {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const wob = Math.sin(a * 7 + jr * 1.7) * 0.5 + Math.sin(a * 13 + jr * 3.1) * 0.3 + (hash(i, jr) - 0.5) * 0.6;
      const r = radiusAt(a) * row.r * (1 + wob * row.j);
      const y = row.y * 1.15 + (jr > 1 ? wob * 0.35 * (jr / 4) : 0);
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      c.setHex(row.c).offsetHSL(0, 0, (hash(i * 3, jr) - 0.5) * 0.05);
      col.push(c.r, c.g, c.b);
    }
  });
  const apexIndex = rows.length * SEGMENTS;
  pos.push(0, -12, 0);
  c.setHex(0x3a312b);
  col.push(c.r, c.g, c.b);

  const idx = indexGrid(SEGMENTS, rows.length);
  const last = (rows.length - 1) * SEGMENTS;
  for (let i = 0; i < SEGMENTS; i++) idx.push(last + i, last + ((i + 1) % SEGMENTS), apexIndex);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide })
  );
  m.castShadow = m.receiveShadow = true;
  return m;
}

function buildRoots() {
  const g = new THREE.Group();
  const r = rng(21);
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x4a3a22, flatShading: true, roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5f4f44, flatShading: true, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const rad = radiusAt(a) * (0.9 - r() * 0.25);
    const len = 0.8 + r() * 2.2;
    const geo = new THREE.ConeGeometry(0.05 + r() * 0.05, len, 5);
    geo.rotateX(Math.PI);
    const m = new THREE.Mesh(geo, rootMat);
    m.position.set(Math.cos(a) * rad, -0.9 - len / 2 - r() * 0.5, Math.sin(a) * rad);
    m.rotation.set((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2);
    g.add(m);
  }
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const rad = radiusAt(a) * (0.55 + r() * 0.2);
    const len = 1.2 + r() * 2.0;
    const geo = new THREE.ConeGeometry(0.3 + r() * 0.35, len, 6);
    geo.rotateX(Math.PI);
    const m = new THREE.Mesh(geo, rockMat);
    m.position.set(Math.cos(a) * rad, -3.6 - r() * 2.5 - len / 2, Math.sin(a) * rad);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

/* ---------- ribbons (roads, streams) ---------- */

export function buildRibbon(points, width, y, colorA, colorB, closed = false, material = mats.dirt) {
  const pos = [], col = [], idx = [];
  const n = points.length;
  const ca = new THREE.Color(colorA), cb = new THREE.Color(colorB), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n], o = points[(i - 1 + n) % n];
    const next = closed || i < n - 1 ? q : p, prev = closed || i > 0 ? o : p;
    const tx = next.x - prev.x, tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len, nz = tx / len;
    const w = (width / 2) * (1 + 0.12 * Math.sin(i * 0.7));
    pos.push(p.x - nx * w, y, p.z - nz * w, p.x + nx * w, y, p.z + nz * w);
    c.copy(ca).lerp(cb, 0.5 + 0.5 * Math.sin(i * 0.9));
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = ((i + 1) % n) * 2;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  return m;
}

export function buildIsland() {
  const g = new THREE.Group();
  g.add(buildTop(), buildUnderside(), buildRoots());
  return g;
}

/* ---------- small floating rocks that orbit the main island ---------- */

export function buildMiniIsland(seed = 1, radius = 1.6) {
  const r = rng(seed);
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.92, 0.3, 10),
    new THREE.MeshStandardMaterial({ color: 0x6aa238, flatShading: true, roughness: 1 })
  );
  const rock = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.92, radius * 1.9, 7, 2).rotateX(Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x66534a, flatShading: true, roughness: 1 })
  );
  rock.position.y = -0.15 - radius * 0.95;
  const p = rock.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > -radius * 0.9) {
      p.setXYZ(i, p.getX(i) * (1 + (r() - 0.5) * 0.2), p.getY(i) + (r() - 0.5) * 0.2, p.getZ(i) * (1 + (r() - 0.5) * 0.2));
    }
  }
  rock.geometry.computeVertexNormals();
  top.castShadow = rock.castShadow = true;
  top.receiveShadow = rock.receiveShadow = true;
  g.add(top, rock);
  g.userData.phase = r() * 6.28;
  return g;
}
