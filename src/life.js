// Behaviours for the village's animals and workers: lane following, climbing cats,
// swimming geese and the ploughing sequence.
import * as THREE from 'three';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;

/* ---------- lane following ---------- */

// Places an object on the lane curve at parameter u, offset sideways, facing along (dir = 1) or against (-1) it.
export function makeOnLane(lane) {
  return (obj, u, off = 0, dir = 1, y = 0) => {
    u = ((u % 1) + 1) % 1;
    const p = lane.getPointAt(u), t = lane.getTangentAt(u);
    obj.position.set(p.x - t.z * off, y, p.z + t.x * off);
    obj.rotation.y = Math.atan2(t.x * dir, t.z * dir);
  };
}

export function walkPose(p, phase, moving = 1) {
  const ud = p.userData;
  ud.legs.forEach((l, i) => (l.rotation.x = Math.sin(phase + i * Math.PI) * 0.7 * moving));
  ud.arms.forEach((a, i) => {
    if (ud.hasPot && i === 0) return;
    a.rotation.x = Math.sin(phase + (i ? 0 : Math.PI)) * 0.55 * moving;
  });
  if (ud.skirt) ud.skirt.rotation.z = Math.sin(phase) * 0.05 * moving;
}

export function animalPose(a, phase, amp = 0.45) {
  a.userData.legs.forEach((l, i) => (l.rotation.x = Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * amp));
  a.userData.tail.rotation.x = Math.sin(phase * 0.7) * 0.2;
  a.userData.head.rotation.x = Math.sin(phase * 0.5) * 0.04;
}

// A dog that trots round the lane and stops now and then to sniff about.
export class DogWalker {
  constructor(dog, onLane, laneLen, { u = 0, dir = 1, speed = 0.9, off = 0.5 } = {}, rand = Math.random) {
    Object.assign(this, { dog, onLane, laneLen, u, dir, speed, off, rand });
    this.phase = rand() * 6;
    this.timer = 3 + rand() * 5;
    this.pausing = false;
  }
  update(dt, t, rush = 1) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.pausing = !this.pausing;
      this.timer = this.pausing ? 1.8 + this.rand() * 2.2 : 5 + this.rand() * 6;
      if (this.pausing) this.onPause?.();
    }
    const ud = this.dog.userData;
    if (this.pausing) {
      ud.legs.forEach((l) => (l.rotation.x *= 0.85));
      ud.head.rotation.x = 0.55 + Math.sin(t * 3 + this.phase) * 0.12;
      ud.tail.rotation.y = Math.sin(t * 9) * 0.5;
      this.onLane(this.dog, this.u, this.off, this.dir, 0);
      return;
    }
    this.u += (this.dir * this.speed * rush * dt) / this.laneLen;
    this.phase += this.speed * rush * dt * 9;
    this.onLane(this.dog, this.u, this.off, this.dir, Math.abs(Math.sin(this.phase)) * 0.012);
    animalPose(this.dog, this.phase, 0.55);
    ud.head.rotation.x = Math.sin(this.phase * 0.5) * 0.06;
    ud.tail.rotation.y = Math.sin(this.phase * 0.8) * 0.25;
  }
}

/* ---------- climbing cats ---------- */

const P = (x, y, z, face) => ({ x, y, z, face });

// Each spot is a list of waypoints in the structure's local space, from a ground start up to a perch.
// `face` (yaw, local) marks vertical stretches: the cat hugs the wall facing it, head up.
function toWorld(obj, pts) {
  obj.updateMatrix();
  return pts.map((q) => ({
    p: new V3(q.x, q.y, q.z).applyMatrix4(obj.matrix),
    face: q.face === undefined ? undefined : q.face + obj.rotation.y,
  }));
}

export function houseSpot(obj) {
  const { w, h } = obj.userData.dims;
  const hx = (w + 0.9) / 2;
  const roofY = (x) => h + 0.08 + 1.24 * (1 - Math.abs(x) / hx);
  const wx = w / 2 + 0.08;
  const F = -Math.PI / 2; // wall is to the cat's -x side
  return toWorld(obj, [
    P(w / 2 + 0.95, 0, 0),
    P(wx, 0.02, 0, F),
    P(wx, h - 0.02, 0, F),
    P(hx - 0.05, roofY(hx - 0.05) + 0.05, 0),
    P(0.22, roofY(0.22) + 0.05, 0),
  ]);
}

export function hutSpot(obj) {
  const { r, h } = obj.userData.dims;
  const wx = -(r * 1.1 + 0.04);
  const roofY = (x) => h + 0.085 + 1.55 * (1 - Math.abs(x) / (r * 1.6));
  const F = Math.PI / 2; // wall is to the cat's +x side
  return toWorld(obj, [
    P(-(r + 0.95), 0, 0),
    P(wx, 0.02, 0, F),
    P(wx, h + 0.1, 0, F),
    P(-(r * 1.6 - 0.05), roofY(r * 1.6 - 0.05) + 0.05, 0),
    P(-0.25, roofY(0.25) + 0.05, 0),
  ]);
}

// Up the slab, the mandapam wall, then tier by tier to the top of the gopuram.
export function templeSpot(obj) {
  const pts = [
    P(3.3, 0, 1.0),
    P(2.86, 0.02, 1.0, -Math.PI / 2),
    P(2.86, 0.24, 1.0, -Math.PI / 2),
    P(2.6, 0.26, 1.0),
    P(2.56, 0.26, 1.0, -Math.PI / 2),
    P(2.56, 0.46, 1.0, -Math.PI / 2),
    P(1.95, 0.48, 1.0),
    P(1.67, 0.48, 1.0, -Math.PI / 2),
    P(1.67, 1.62, 1.0, -Math.PI / 2),
    P(1.5, 1.84, 1.0),
    P(0.3, 1.84, 0.9),
  ];
  let y = 0.44 + 1.36;
  for (let i = 0; i < 5; i++) {
    const td = 2.1 - i * 0.3, th = 0.56 - i * 0.03;
    const zf = -0.4 + td / 2 + 0.06;
    const top = y + th + 0.08;
    pts.push(P(0.3, y + 0.04, zf, Math.PI), P(0.3, top + 0.04, zf, Math.PI));
    const nextZ = -0.4 + (2.1 - (i + 1) * 0.3) / 2 + 0.06;
    pts.push(P(0.3, top + 0.04, i < 4 ? nextZ : zf - 0.5));
    y = top;
  }
  return toWorld(obj, pts);
}

export class CatBrain {
  constructor(cat, spots, lane, laneSamples, startSpot, rand = Math.random) {
    this.cat = cat;
    this.spots = spots;
    this.laneSamples = laneSamples;
    this.rand = rand;
    this.last = startSpot;
    this.pos = spots[startSpot][0].p.clone();
    cat.position.copy(this.pos);
    this.yaw = 0;
    this.phase = rand() * 6;
    this.pts = [];
    this.i = 0;
    this.wait = 1 + rand() * 3;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.q = new THREE.Quaternion();
    this.climbing = false;
    this.plan();
  }

  nearest(p) {
    let best = 0, bd = Infinity;
    const n = this.laneSamples.length - 1;
    for (let i = 0; i < n; i++) {
      const s = this.laneSamples[i];
      const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  plan() {
    const n = this.laneSamples.length - 1;
    let next;
    do next = Math.floor(this.rand() * this.spots.length); while (next === this.last && this.spots.length > 1);
    const spot = this.spots[next];
    const a = this.nearest(this.pos), b = this.nearest(spot[0].p);
    const fwd = (b - a + n) % n;
    const step = fwd <= n / 2 ? 1 : -1;
    const count = step === 1 ? fwd : n - fwd;
    const pts = [];
    for (let k = 0, idx = a; k <= count; k++, idx = (idx + step + n) % n) {
      const s = this.laneSamples[idx];
      pts.push({ p: new V3(s.x, 0, s.z) });
    }
    spot.forEach((q) => pts.push({ p: q.p.clone(), face: q.face }));
    pts[pts.length - 1].wait = 5 + this.rand() * 6;
    for (let k = spot.length - 2; k >= 0; k--) pts.push({ p: spot[k].p.clone(), face: spot[k].face ?? spot[k + 1].face });
    this.pts = pts;
    this.i = 0;
    this.last = next;
  }

  update(dt, t) {
    const ud = this.cat.userData;
    if (this.wait > 0) {
      this.wait -= dt;
      ud.legs.forEach((l) => (l.rotation.x *= 0.85));
      ud.head.rotation.y = Math.sin(t * 0.9 + this.phase) * 0.7;
      ud.tail.rotation.z = Math.sin(t * 2.2 + this.phase) * 0.5;
      return;
    }
    let target = this.pts[this.i];
    if (!target) { this.plan(); target = this.pts[0]; }
    const dx = target.p.x - this.pos.x, dy = target.p.y - this.pos.y, dz = target.p.z - this.pos.z;
    const horiz = Math.hypot(dx, dz);
    const dist = Math.hypot(horiz, dy);
    const vertical = horiz < 0.03 && Math.abs(dy) > 0.02;
    const speed = vertical ? 0.42 : dy > 0.08 ? 0.55 : 0.85;
    const step = speed * dt;

    if (dist <= step) {
      this.pos.copy(target.p);
      this.i++;
      if (target.wait) {
        this.wait = target.wait;
        this.onPerch?.();
      }
    } else {
      this.pos.x += (dx / dist) * step;
      this.pos.y += (dy / dist) * step;
      this.pos.z += (dz / dist) * step;
    }
    this.cat.position.copy(this.pos);

    let yaw = this.yaw, pitch = 0;
    if (vertical) {
      yaw = target.face ?? this.yaw;
      pitch = Math.PI / 2;
    } else if (horiz > 0.001) {
      yaw = Math.atan2(dx, dz);
      pitch = Math.atan2(dy, horiz);
    }
    this.yaw = yaw;
    this.euler.set(-pitch, yaw, 0);
    this.q.setFromEuler(this.euler);
    this.cat.quaternion.slerp(this.q, 1 - Math.exp(-dt * 10));

    this.phase += speed * dt * (vertical ? 16 : 11) * (dy < -0.02 && vertical ? -1 : 1);
    ud.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * (vertical ? 0.8 : 0.6)));
    ud.tail.rotation.z = Math.sin(this.phase * 0.5) * 0.25;
    ud.head.rotation.y *= 0.9;
  }
}

/* ---------- geese on the pond ---------- */

export class GooseSwimmer {
  constructor(goose, center, { rx = 1, rz = 0.8, speed = 0.25, phase = 0, y = 0.06 } = {}) {
    Object.assign(this, { goose, center, rx, rz, speed, phase, y });
  }
  update(t) {
    const a = this.phase + t * this.speed;
    const x = this.center.x + Math.cos(a) * this.rx;
    const z = this.center.z + Math.sin(a) * this.rz;
    const dir = Math.sign(this.speed) || 1;
    const hx = -Math.sin(a) * this.rx * dir, hz = Math.cos(a) * this.rz * dir;
    this.goose.position.set(x, this.y + Math.sin(t * 1.6 + this.phase * 3) * 0.008, z);
    this.goose.rotation.y = Math.atan2(hx, hz);
    this.goose.rotation.z = Math.sin(t * 1.2 + this.phase) * 0.04;
    const ud = this.goose.userData;
    const dip = Math.max(0, Math.sin(t * 0.55 + this.phase * 2.3) - 0.8) * 5;
    ud.neck.rotation.x = 0.1 + dip * 1.1;
    ud.head.rotation.x = dip * 0.5;
  }
}

/* ---------- ploughing sequence ---------- */

// Boustrophedon rows with semicircular turns at each end. at(s) gives the share's pose after s metres.
export class PloughPath {
  constructor(x0, x1, rowZs) {
    this.x0 = x0;
    this.x1 = x1;
    this.zs = rowZs;
    this.rowLen = Math.abs(x1 - x0);
    this.segs = [];
    let total = 0;
    rowZs.forEach((z, j) => {
      this.segs.push({ type: 'row', j, z, dir: j % 2 === 0 ? 1 : -1, len: this.rowLen, start: total });
      total += this.rowLen;
      if (j < rowZs.length - 1) {
        const r = (rowZs[j + 1] - z) / 2;
        const len = Math.PI * r;
        this.segs.push({ type: 'turn', j, z, r, dir: j % 2 === 0 ? 1 : -1, len, start: total });
        total += len;
      }
    });
    this.total = total;
  }
  at(s) {
    s = Math.min(Math.max(s, 0), this.total - 1e-6);
    for (const g of this.segs) {
      if (s > g.start + g.len) continue;
      const f = (s - g.start) / g.len;
      if (g.type === 'row') {
        const xs = g.dir > 0 ? this.x0 : this.x1;
        return { x: xs + g.dir * g.len * f, z: g.z, yaw: g.dir > 0 ? Math.PI / 2 : -Math.PI / 2, row: g.j, frac: f, cutting: true };
      }
      const xe = g.dir > 0 ? this.x1 : this.x0;
      const phi = f * Math.PI;
      const hx = g.dir * Math.cos(phi), hz = Math.sin(phi);
      return {
        x: xe + g.dir * g.r * Math.sin(phi),
        z: g.z + g.r - g.r * Math.cos(phi),
        yaw: Math.atan2(hx, hz),
        row: g.j + 0.5,
        frac: f,
        cutting: false,
      };
    }
    return null;
  }
}
