import * as THREE from 'three';
import { LOT } from './furnish.js';
import { resolve } from './voxels.js';

export const FH = 0.9; // floor height

// Non-box parts of a building (dishes, cones, discs, blinking lights). Each keeps a palette key.
export class Parts {
  constructor(group) {
    this.group = group;
    this.items = [];
  }

  add(geo, key, { x = 0, y = 0, z = 0, rx = 0, ry = 0, order = 'XYZ', glow = false, transparent = false } = {}) {
    const mat = glow || transparent
      ? new THREE.MeshBasicMaterial({ transparent, opacity: transparent ? 0 : 1, depthWrite: !transparent, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.order = order;
    m.rotation.set(rx, ry, 0);
    m.castShadow = !glow && !transparent;
    m.receiveShadow = !glow && !transparent;
    this.group.add(m);
    this.items.push({ m, key });
    return m;
  }

  recolor(pal) {
    for (const { m, key } of this.items) m.material.color.copy(resolve(pal, key));
  }
}

// ---------- shared pieces ----------

// Punched windows on all four faces of a w x d box centred on (x, z).
function punched(b, x, z, w, d, y0, floors, { ww = 0.5, wh = 0.48, lit = b.lit, from = 0 } = {}) {
  const nx = Math.max(1, Math.round(w) - 1), nz = Math.max(1, Math.round(d) - 1);
  for (let f = from; f < floors; f++) {
    const y = y0 + f * FH + 0.22;
    for (let k = 0; k < nx; k++) {
      const px = x - (nx - 1) / 2 + k;
      win(b, px, y, z + d / 2 + 0.01, ww, wh, 0.03, lit);
      win(b, px, y, z - d / 2 - 0.01, ww, wh, 0.03, lit);
    }
    for (let k = 0; k < nz; k++) {
      const pz = z - (nz - 1) / 2 + k;
      win(b, x + w / 2 + 0.01, y, pz, 0.03, wh, ww, lit);
      win(b, x - w / 2 - 0.01, y, pz, 0.03, wh, ww, lit);
    }
  }
}

function win(b, x, y, z, sx, sy, sz, lit) {
  if (b.rnd() < lit) b.glow.add(x, y, z, sx, sy, sz, 'windowOn');
  else b.solid.add(x, y, z, sx, sy, sz, 'windowOff');
}

// Glass box with white floor slabs. Returns the roof height.
function glassBox(b, x, z, w, d, y0, floors) {
  const { solid, glow, rnd, lit } = b;
  solid.add(x, y0, z, w - 0.4, floors * FH, d - 0.4, 'glass');
  for (let f = 0; f <= floors; f++) solid.add(x, y0 + f * FH - 0.08, z, w, 0.16, d, 'concrete');
  const nx = Math.max(1, Math.round(w) - 1), nz = Math.max(1, Math.round(d) - 1);
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * FH + 0.16;
    for (let k = 0; k < nx; k++) {
      const px = x - (nx - 1) / 2 + k;
      if (rnd() < lit) glow.add(px, y, z + (d - 0.4) / 2 + 0.01, 0.9, 0.56, 0.02, 'windowOn');
      if (rnd() < lit) glow.add(px, y, z - (d - 0.4) / 2 - 0.01, 0.9, 0.56, 0.02, 'windowOn');
    }
    for (let k = 0; k < nz; k++) {
      const pz = z - (nz - 1) / 2 + k;
      if (rnd() < lit) glow.add(x + (w - 0.4) / 2 + 0.01, y, pz, 0.02, 0.56, 0.9, 'windowOn');
      if (rnd() < lit) glow.add(x - (w - 0.4) / 2 - 0.01, y, pz, 0.02, 0.56, 0.9, 'windowOn');
    }
  }
  return y0 + floors * FH + 0.08;
}

// A low wall around the edge of a roof.
function parapet(b, x, z, w, d, y, h, key) {
  b.solid.add(x, y, z + d / 2 - 0.1, w, h, 0.2, key);
  b.solid.add(x, y, z - d / 2 + 0.1, w, h, 0.2, key);
  b.solid.add(x - w / 2 + 0.1, y, z, 0.2, h, d, key);
  b.solid.add(x + w / 2 - 0.1, y, z, 0.2, h, d, key);
}

// A flag on a pole, facing +z.
function flag(b, x, y, z, red = 'swissRed') {
  b.solid.add(x, y, z, 0.06, 2.0, 0.06, 'metalDark');
  b.solid.add(x + 0.5, y + 1.3, z, 0.9, 0.6, 0.03, red);
  b.solid.add(x + 0.5, y + 1.48, z + 0.02, 0.12, 0.26, 0.02, 'sail');
  b.solid.add(x + 0.5, y + 1.55, z + 0.02, 0.4, 0.12, 0.02, 'sail');
}

const dishGeo = new THREE.SphereGeometry(0.55, 20, 6, 0, Math.PI * 2, 0, 0.8);
function dish(b, x, y, z, ry, s = 1) {
  b.solid.add(x, y, z, 0.16, 0.45 * s, 0.16, 'metalDark');
  const m = b.parts.add(dishGeo, 'concrete', { x, y: y + 0.6 * s, z, rx: -0.68 * Math.PI, ry, order: 'YXZ' });
  m.scale.setScalar(s);
}

// ---------- the buildings ----------
// Each takes the shared context b and returns { roof, top, billboard, side }:
// roof = where the rooftop billboard stands, top = highest point (label),
// side = the facade sign on the +x face.

// rrradio: a broadcasting house. Dark tower in the app's colours, a studio wing with an
// ON AIR light, and a red-and-white lattice mast with a blinking beacon sending out waves.
function radio(b) {
  const { w, d, floors, z0, solid, glow, parts } = b;
  const wingW = Math.max(3, Math.round(w * 0.36)), mainW = w - wingW;
  const mx = -w / 2 + wingW + mainW / 2, wx = -w / 2 + wingW / 2;
  const h = floors * FH;
  solid.add(mx, LOT, z0, mainW - 0.3, h, d - 0.3, 'rrDark');
  punched(b, mx, z0, mainW - 0.3, d - 0.3, LOT, floors);
  // Roof with a yellow parapet, and a yellow stripe down the front corner.
  solid.add(mx, LOT + h, z0, mainW - 0.3, 0.12, d - 0.3, 'roof');
  parapet(b, mx, z0, mainW, d, LOT + h, 0.4, 'rrYellow');
  solid.add(mx + mainW / 2 - 0.4, LOT, z0 + (d - 0.3) / 2 + 0.02, 0.36, h, 0.06, 'rrYellow');
  const roof = LOT + h + 0.12;
  solid.add(mx, LOT, z0 + d / 2 + 0.35, 2.4, 0.1, 0.8, 'concreteDark');
  solid.add(mx, LOT + 0.9, z0 + d / 2 + 0.35, 2.6, 0.12, 0.9, 'rrYellow');

  // Studio wing.
  const wf = Math.max(1, Math.min(2, floors - 1));
  solid.add(wx, LOT, z0, wingW - 0.2, wf * FH, d - 0.3, 'concrete');
  for (let f = 0; f < wf; f++) {
    const y = LOT + f * FH + 0.2;
    if (b.rnd() < b.lit + 0.3) glow.add(wx, y, z0 + (d - 0.3) / 2 + 0.01, wingW - 0.9, 0.5, 0.02, 'windowOn');
    else solid.add(wx, y, z0 + (d - 0.3) / 2 + 0.01, wingW - 0.9, 0.5, 0.02, 'glassDark');
  }
  const wingRoof = LOT + wf * FH;
  solid.add(wx, wingRoof, z0, wingW, 0.16, d, 'roof');
  solid.add(wx, wingRoof + 0.16, z0 + d / 2 - 0.35, 1.6, 0.5, 0.1, 'rubber');
  glow.add(wx, wingRoof + 0.22, z0 + d / 2 - 0.29, 1.4, 0.38, 0.04, b.paused ? 'windowOff' : 'onAir');

  // Lattice mast on the wing, red and white bands like a real transmitter.
  const base = wingRoof + 0.16, top = LOT + h + 6.5;
  const mxc = wx, mzc = z0 - 0.5;
  const segs = Math.round((top - base) / 0.8), sh = (top - base) / segs;
  let midHalf = 0.4;
  for (let s = 0; s < segs; s++) {
    const y = base + s * sh, k = s / segs, half = 0.75 * (1 - k) + 0.12 * k;
    const key = Math.floor(s / 2) % 2 ? 'concrete' : 'mastRed';
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) solid.add(mxc + sx * half, y, mzc + sz * half, 0.08, sh, 0.08, key);
    const yr = y + sh - 0.05;
    solid.add(mxc, yr, mzc - half, 2 * half, 0.05, 0.05, key);
    solid.add(mxc, yr, mzc + half, 2 * half, 0.05, 0.05, key);
    solid.add(mxc - half, yr, mzc, 0.05, 0.05, 2 * half, key);
    solid.add(mxc + half, yr, mzc, 0.05, 0.05, 2 * half, key);
    if (s === Math.floor(segs / 2)) midHalf = half;
  }
  solid.add(mxc, top, mzc, 0.06, 1.4, 0.06, 'metalDark');
  const beaconGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  const beacons = [
    parts.add(beaconGeo, 'beacon', { x: mxc, y: top + 1.5, z: mzc, glow: true }),
    parts.add(beaconGeo, 'beacon', { x: mxc + midHalf, y: base + (top - base) / 2, z: mzc + midHalf, glow: true }),
  ];

  // Dishes on the tower roof.
  dish(b, mx - mainW / 2 + 1, roof, z0 - d / 2 + 1, 0.4);
  dish(b, mx + mainW / 2 - 1, roof, z0 - d / 2 + 1, 0.9, 0.8);

  // Radio waves: rings that leave the mast top and fade.
  const rings = [];
  if (!b.still && !b.paused) {
    const ringGeo = new THREE.TorusGeometry(1, 0.05, 4, 64);
    for (let k = 0; k < 3; k++) rings.push(parts.add(ringGeo, 'rrYellow', { x: mxc, y: top + 1.5, z: mzc, rx: Math.PI / 2, transparent: true }));
  }
  b.anim.push((dt, t) => {
    const on = b.paused ? false : b.still || t % 1.6 < 0.9;
    beacons.forEach((m) => { m.visible = on; });
    rings.forEach((m, k) => {
      const p = (t * 0.35 + k / 3) % 1;
      m.scale.setScalar(0.4 + p * 4);
      m.material.opacity = (1 - p) * 0.75;
    });
  });

  return {
    roof,
    top: top + 2,
    billboard: { x: mx, y: roof, z: z0 + 0.5, maxW: mainW + 0.5 },
    side: { x: mx + mainW / 2 - 0.15 + 0.06, y: LOT + (floors - 0.6) * FH, z: z0, maxW: d - 0.5 },
  };
}

// Archipelago: stacked glass islands, each terrace a green roof garden.
function terraces(b) {
  const { w, d, floors, z0, solid, trees } = b;
  const f1 = Math.ceil(floors * 0.45), f2 = Math.max(1, Math.ceil((floors - f1) * 0.6)), f3 = Math.max(1, floors - f1 - f2);
  const tiers = [
    { x: 0, z: z0, w, d, f: f1 },
    { x: -1.25, z: z0 - 0.5, w: w - 2.5, d: d - 1, f: f2 },
    { x: -2.25, z: z0 - 0.75, w: w - 4.5, d: d - 1.5, f: f3 },
  ];
  let y = LOT;
  tiers.forEach((t, i) => {
    const roof = glassBox(b, t.x, t.z, t.w, t.d, y, t.f);
    t.y0 = y;
    t.roof = roof;
    y = roof - 0.08;
    const next = tiers[i + 1];
    solid.add(t.x, roof, t.z, t.w - 0.2, 0.12, t.d - 0.2, next ? 'grass' : 'roof');
    if (next) {
      // Trees on the exposed strip to the front right of the next tier.
      const ex0 = next.x + next.w / 2, ex1 = t.x + t.w / 2;
      for (let x = ex0 + 0.6; x < ex1 - 0.3; x += 1.1) trees.add(b.wx + x, b.wz + t.z + t.d / 2 - 0.6, roof + 0.1, 0.42);
      trees.add(b.wx + t.x - t.w / 2 + 0.6, b.wz + t.z + t.d / 2 - 0.5, roof + 0.1, 0.38);
    }
  });
  const last = tiers[2];
  solid.add(last.x - 0.8, last.roof + 0.12, last.z - 0.2, 1.2, 0.5, 0.9, 'concreteDark');
  solid.add(0, LOT, z0 + d / 2 + 0.35, 2.6, 0.1, 0.8, 'concrete');
  solid.add(0, LOT + 0.9, z0 + d / 2 + 0.35, 2.8, 0.1, 0.9, 'concreteDark');
  return {
    roof: last.roof + 0.12,
    top: last.roof + 2.5,
    billboard: { x: last.x, y: last.roof + 0.12, z: last.z + 0.2, maxW: last.w + 2 },
    side: { x: w / 2 + 0.06, y: LOT + (f1 - 0.6) * FH, z: z0, maxW: d - 0.5 },
  };
}

// meinHERMES: an academy. Stone body on a colonnade, a pediment, and a clock tower
// (it is an exam-prep site after all).
function academy(b) {
  const { w, d, floors, z0, solid, parts } = b;
  const h = floors * FH, front = z0 + d / 2;
  solid.add(0, LOT, z0 + 0.1, w + 0.4, 0.1, d + 0.4, 'concreteDark');
  // Ground floors recessed behind the columns.
  const cf = Math.min(2, floors - 1), ch = cf * FH;
  solid.add(0, LOT, z0 - 0.6, w - 0.5, ch, d - 1.5, 'stone');
  for (let k = 0; k < Math.round(w) - 2; k++) win(b, -(Math.round(w) - 3) / 2 + k, LOT + 0.3, front - 1.34, 0.5, ch - 0.6, 0.03, b.lit);
  const n = Math.max(4, Math.floor(w / 1.3));
  for (let k = 0; k < n; k++) {
    const x = -(w - 1) / 2 + (k * (w - 1)) / (n - 1);
    solid.add(x, LOT + 0.1, front - 0.3, 0.34, ch - 0.1, 0.34, 'concrete');
    solid.add(x, LOT + 0.1, front - 0.3, 0.46, 0.12, 0.46, 'concrete');
    solid.add(x, LOT + ch - 0.12, front - 0.3, 0.46, 0.12, 0.46, 'concrete');
  }
  // Upper body.
  solid.add(0, LOT + ch, z0, w, 0.3, d, 'concrete');
  solid.add(0, LOT + ch + 0.3, z0, w - 0.3, h - ch - 0.3, d - 0.3, 'stone');
  punched(b, 0, z0, w - 0.3, d - 0.3, LOT, floors, { ww: 0.4, wh: 0.6, from: cf + 1 });
  solid.add(0, LOT + h, z0, w + 0.2, 0.25, d + 0.2, 'concrete');
  const roof = LOT + h + 0.25;
  // Pediment over the entrance, stepped like a roof gable.
  const pw = Math.min(w * 0.55, 6);
  [1, 0.7, 0.4, 0.14].forEach((s, i) => solid.add(0, roof + i * 0.22, front - 0.25, pw * s, 0.22, 0.5, 'concrete'));
  // Clock tower at the back.
  const tx = w / 2 - 1.3, tz = z0 - d / 2 + 1.1;
  solid.add(tx, roof, tz, 1.4, 1.8, 1.4, 'stone');
  solid.add(tx, roof + 1.8, tz, 1.6, 0.16, 1.6, 'concrete');
  [1.1, 0.75, 0.4].forEach((s, i) => solid.add(tx, roof + 1.96 + i * 0.25, tz, 1.4 * s, 0.25, 1.4 * s, 'roofSlate'));
  const disc = new THREE.CylinderGeometry(0.46, 0.46, 0.04, 24);
  parts.add(disc, 'sail', { x: tx, y: roof + 1.05, z: tz + 0.72, rx: Math.PI / 2 });
  parts.add(disc, 'sail', { x: tx + 0.72, y: roof + 1.05, z: tz, rx: Math.PI / 2, ry: Math.PI / 2, order: 'YXZ' });
  solid.add(tx, roof + 1.05, tz + 0.75, 0.05, 0.34, 0.02, 'ink');
  solid.add(tx + 0.1, roof + 1.03, tz + 0.75, 0.24, 0.05, 0.02, 'ink');
  solid.add(tx + 0.75, roof + 1.05, tz, 0.02, 0.34, 0.05, 'ink');
  solid.add(tx + 0.75, roof + 1.03, tz - 0.1, 0.02, 0.05, 0.24, 'ink');
  return {
    roof,
    top: roof + 3,
    billboard: { x: -1, y: roof, z: z0 - 0.2, maxW: w - 3 },
    side: { x: w / 2 - 0.15 + 0.06, y: LOT + (floors - 0.6) * FH, z: z0, maxW: d - 0.5 },
  };
}

// meineSteuer: a small Swiss bank-style office: sandstone, white piers, a flag on the roof.
function bank(b) {
  const { w, d, floors, z0, solid } = b;
  const h = floors * FH;
  solid.add(0, LOT, z0, w - 0.4, h, d - 0.4, 'sand');
  for (let f = 0; f < floors; f++) {
    const y = LOT + f * FH + 0.2;
    const nx = Math.round(w) - 1, nz = Math.round(d) - 1;
    for (let k = 0; k < nx; k++) {
      const x = -(nx - 1) / 2 + k;
      if (f === 0 && Math.abs(x) < 0.6) continue;
      win(b, x, y, z0 + (d - 0.4) / 2 + 0.01, 0.62, 0.55, 0.03, b.lit);
    }
    for (let k = 0; k < nz; k++) win(b, w / 2 - 0.2 + 0.01, y, z0 - (nz - 1) / 2 + k, 0.03, 0.55, 0.62, b.lit);
  }
  // Piers between the windows on the two street faces.
  for (let k = 0; k <= Math.round(w) - 1; k++) solid.add(-(w - 1) / 2 + k, LOT, z0 + d / 2 - 0.12, 0.2, h, 0.24, 'concrete');
  for (let k = 0; k <= Math.round(d) - 1; k++) solid.add(w / 2 - 0.12, LOT, z0 - (d - 1) / 2 + k, 0.24, h, 0.2, 'concrete');
  solid.add(0, LOT + h, z0, w, 0.5, d, 'concrete');
  solid.add(0, LOT, z0 + d / 2 - 0.05, 0.9, 1.2, 0.08, 'rubber');
  solid.add(0, LOT + 1.25, z0 + d / 2 + 0.25, 1.6, 0.1, 0.7, 'concreteDark');
  const roof = LOT + h + 0.5;
  flag(b, -w / 2 + 1, roof, z0 + d / 2 - 0.8);
  return {
    roof,
    top: roof + 2.5,
    billboard: { x: 0.6, y: roof, z: z0, maxW: w - 1 },
    side: { x: w / 2 + 0.07, y: LOT + (floors - 0.6) * FH, z: z0, maxW: d - 0.6 },
  };
}

// rrrecipe: a bistro. Brick, a striped awning over the glowing shop front, a smoking
// kitchen chimney and a roof terrace with parasols.
function bistro(b) {
  const { w, d, floors, z0, solid, glow, parts } = b;
  const h = floors * FH, front = z0 + (d - 0.3) / 2;
  solid.add(0, LOT, z0, w - 0.3, h, d - 0.3, 'brick');
  // Shop front.
  glow.add(0, LOT + 0.12, front + 0.01, w - 1.4, 0.66, 0.02, b.paused ? 'windowOff' : 'windowOn');
  solid.add(0, LOT, front + 0.03, 0.7, 0.8, 0.04, 'rubber');
  const n = Math.round((w - 0.4) / 0.5);
  for (let k = 0; k < n; k++) {
    const x = -(n - 1) / 4 + k * 0.5, key = k % 2 ? 'concrete' : 'awning';
    solid.add(x, LOT + 0.98, front + 0.25, 0.5, 0.08, 0.5, key);
    solid.add(x, LOT + 0.9, front + 0.6, 0.5, 0.08, 0.3, key);
  }
  punched(b, 0, z0, w - 0.3, d - 0.3, LOT, floors, { from: 1, ww: 0.42, wh: 0.55 });
  for (let f = 1; f < floors; f++) solid.add(0, LOT + f * FH + 0.12, z0, w - 0.2, 0.06, d - 0.2, 'concrete');
  solid.add(0, LOT + h, z0, w - 0.1, 0.22, d - 0.1, 'concrete');
  const roof = LOT + h + 0.22;
  solid.add(0, roof, z0, w - 0.3, 0.04, d - 0.3, 'trunk');
  // Chimney.
  const cx = -w / 2 + 0.8, cz = z0 - d / 2 + 0.8;
  solid.add(cx, roof, cz, 0.6, 1.5, 0.6, 'brick');
  solid.add(cx, roof + 1.5, cz, 0.72, 0.12, 0.72, 'concreteDark');
  b.chimneys.push({ x: b.wx + cx, y: roof + 1.7, z: b.wz + cz, s: 0.45 });
  // Roof terrace: planters, tables, parasols.
  for (let k = 0; k < 3; k++) {
    solid.add(-w / 2 + 2 + k * 1.2, roof, z0 + d / 2 - 0.45, 1, 0.3, 0.4, 'trunk');
    solid.add(-w / 2 + 2 + k * 1.2, roof + 0.3, z0 + d / 2 - 0.45, 0.9, 0.12, 0.3, 'c2');
  }
  const cone = new THREE.ConeGeometry(0.75, 0.35, 8);
  for (const px of [w / 2 - 1.2, w / 2 - 2.9]) {
    solid.add(px, roof, z0 + 0.4, 0.06, 1.0, 0.06, 'metalDark');
    solid.add(px, roof, z0 + 0.4, 0.7, 0.42, 0.7, 'concrete');
    parts.add(cone, 'awning', { x: px, y: roof + 1.1, z: z0 + 0.4 });
  }
  return {
    roof,
    top: roof + 2.5,
    billboard: { x: -0.4, y: roof, z: z0 - 0.6, maxW: w - 2 },
    side: { x: w / 2 - 0.15 + 0.06, y: LOT + (floors - 0.6) * FH, z: z0, maxW: d - 0.5 },
  };
}

// SteinerDesign: a white studio drawn in 1px lines. A gridded glass base, a white volume
// cantilevered over it, and exactly one signal-red element.
function studio(b) {
  const { w, d, floors, z0, solid, glow } = b;
  const f1 = Math.max(1, Math.ceil(floors / 2)), f2 = Math.max(1, floors - f1);
  const h1 = f1 * FH;
  solid.add(-0.5, LOT, z0, w - 1.4, h1, d - 0.4, 'glass');
  for (let k = 0; k <= Math.round(w - 1.4) * 2; k++) {
    const x = -0.5 - (w - 1.4) / 2 + k * 0.5;
    solid.add(x, LOT, z0 + (d - 0.4) / 2 + 0.01, 0.04, h1, 0.03, 'ink');
  }
  for (let k = 0; k <= Math.round(d - 0.4) * 2; k++) solid.add(-0.5 + (w - 1.4) / 2 + 0.01, LOT, z0 - (d - 0.4) / 2 + k * 0.5, 0.03, h1, 0.04, 'ink');
  for (let f = 0; f <= f1 * 2; f++) {
    solid.add(-0.5, LOT + f * FH / 2, z0 + (d - 0.4) / 2 + 0.02, w - 1.4, 0.03, 0.03, 'ink');
    solid.add(-0.5 + (w - 1.4) / 2 + 0.02, LOT + f * FH / 2, z0, 0.03, 0.03, d - 0.4, 'ink');
  }
  for (let f = 0; f < f1; f++) if (b.rnd() < b.lit) glow.add(-0.5, LOT + f * FH + 0.1, z0, w - 1.6, 0.6, d - 0.6, 'windowOn');
  solid.add(-1.2, LOT, z0 + (d - 0.4) / 2 + 0.03, 0.6, 1.0, 0.04, 'accent');
  // Cantilevered upper volume, offset toward the street.
  const ux = 0.6, h2 = f2 * FH, y2 = LOT + h1;
  solid.add(ux, y2, z0, w - 1.2, h2, d, 'concrete');
  for (let f = 0; f < f2; f++) {
    const y = y2 + f * FH + 0.3;
    if (b.rnd() < b.lit + 0.2) glow.add(ux, y, z0 + d / 2 + 0.01, w - 2.4, 0.3, 0.02, 'windowOn');
    else solid.add(ux, y, z0 + d / 2 + 0.01, w - 2.4, 0.3, 0.02, 'glassDark');
    solid.add(ux + (w - 1.2) / 2 + 0.01, y, z0, 0.02, 0.3, d - 1.2, 'glassDark');
  }
  solid.add(ux + (w - 1.2) / 2 - 0.4, y2, z0 + d / 2 + 0.02, 0.12, h2, 0.03, 'accent');
  const roof = y2 + h2;
  return {
    roof,
    top: roof + 2.5,
    billboard: { x: ux, y: roof, z: z0, maxW: w - 2 },
    side: { x: ux + (w - 1.2) / 2 + 0.06, y: y2 + (f2 - 0.55) * FH, z: z0, maxW: d - 0.6 },
  };
}

// claude-mods: a maker workshop. Corrugated walls, roll-up doors, a sawtooth roof,
// blinking server racks and a giant plug on the roof.
function workshop(b) {
  const { w, d, floors, z0, solid, glow } = b;
  const h = floors * FH, front = z0 + (d - 0.3) / 2, right = (w - 0.3) / 2;
  solid.add(0, LOT, z0, w - 0.3, h, d - 0.3, 'blueGrey');
  for (let x = -right + 0.25; x < right; x += 0.5) solid.add(x, LOT, front + 0.02, 0.08, h, 0.05, 'concreteDark');
  for (let z = -(d - 0.3) / 2 + 0.25; z < (d - 0.3) / 2; z += 0.5) solid.add(right + 0.02, LOT, z0 + z, 0.05, h, 0.08, 'concreteDark');
  for (const x of [-w / 4, w / 4]) {
    solid.add(x, LOT, front + 0.06, 2, 1.4, 0.05, 'metalDark');
    for (let k = 1; k < 7; k++) solid.add(x, LOT + k * 0.2, front + 0.09, 2, 0.02, 0.02, 'rubber');
  }
  for (let f = 2; f < floors; f++) {
    const y = LOT + f * FH + 0.25;
    if (b.rnd() < b.lit + 0.2) glow.add(0, y, front + 0.06, w - 1.2, 0.36, 0.02, 'windowOn');
    else solid.add(0, y, front + 0.06, w - 1.2, 0.36, 0.02, 'glassDark');
    if (b.rnd() < b.lit + 0.2) glow.add(right + 0.06, y, z0, 0.02, 0.36, d - 1, 'windowOn');
    else solid.add(right + 0.06, y, z0, 0.02, 0.36, d - 1, 'glassDark');
  }
  solid.add(0, LOT + h, z0, w - 0.3, 0.12, d - 0.3, 'roof');
  parapet(b, 0, z0, w, d, LOT + h, 0.45, 'mods');
  const roof = LOT + h + 0.12;
  // Sawtooth skylights over the back half.
  const teeth = Math.floor((w - 1) / 1.6);
  for (let k = 0; k < teeth; k++) {
    const x = -w / 2 + 1 + k * 1.6;
    solid.add(x, roof, z0 - d / 4, 1.2, 0.7, d / 2 - 0.2, 'roof');
    glow.add(x + 0.62, roof + 0.05, z0 - d / 4, 0.06, 0.6, d / 2 - 0.4, 'windowOn');
  }
  // Server racks with status LEDs.
  for (let k = 0; k < 2; k++) {
    const x = w / 2 - 1.2 - k * 1.0, z = z0 + d / 2 - 0.7;
    solid.add(x, roof, z, 0.7, 0.9, 0.5, 'rubber');
    for (let r = 0; r < 3; r++) glow.add(x - 0.15 + (r % 2) * 0.2, roof + 0.25 + r * 0.22, z + 0.26, 0.08, 0.06, 0.02, b.paused ? 'windowOff' : 'led');
  }
  // The plug.
  const px = -w / 2 + 1.4, pz = z0 + d / 2 - 0.9;
  solid.add(px, roof, pz, 1.1, 0.8, 0.8, 'concrete');
  solid.add(px, roof + 0.8, pz, 0.9, 0.18, 0.6, 'mods');
  solid.add(px - 0.22, roof + 0.98, pz, 0.12, 0.6, 0.08, 'metal');
  solid.add(px + 0.22, roof + 0.98, pz, 0.12, 0.6, 0.08, 'metal');
  solid.add(px + 0.3, roof - 1.8, front + 0.14, 0.12, 2.2, 0.12, 'rubber');
  return {
    roof,
    top: roof + 2.5,
    billboard: { x: 0.4, y: roof, z: z0 + 0.6, maxW: w - 3.5 },
    side: { x: right + 0.12, y: LOT + (floors - 0.6) * FH, z: z0, maxW: d - 0.6 },
  };
}

// squash: a small mill with a big hopper funnel on the roof. Paused, so the lights are out.
function hopper(b) {
  const { w, d, floors, z0, solid, parts } = b;
  const h = floors * FH;
  solid.add(0, LOT, z0, w - 0.3, h, d - 0.3, 'concrete');
  punched(b, 0, z0, w - 0.3, d - 0.3, LOT, floors, { ww: 0.6, wh: 0.4 });
  solid.add(0, LOT + h, z0, w, 0.2, d, 'concreteDark');
  const roof = LOT + h + 0.2;
  const fx = -w / 2 + 1.8, fz = z0;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) solid.add(fx + sx * 0.7, roof, fz + sz * 0.7, 0.1, 1.2, 0.1, 'metalDark');
  parts.add(new THREE.CylinderGeometry(0.25, 0.25, 0.6, 12), 'metalDark', { x: fx, y: roof + 0.9, z: fz });
  parts.add(new THREE.CylinderGeometry(1.4, 0.25, 1.6, 16, 1, true), 'metal', { x: fx, y: roof + 2.0, z: fz });
  return {
    roof,
    top: roof + 3.5,
    billboard: { x: 1.2, y: roof, z: z0 + 0.3, maxW: w - 3.5 },
    side: { x: w / 2 - 0.15 + 0.06, y: LOT + (floors - 0.6) * FH, z: z0, maxW: d - 0.5 },
  };
}

// The Lab: a windowless warehouse. The shutter is half down and something glows behind it.
function lab(b) {
  const { w, d, floors, z0, solid, glow } = b;
  const h = floors * FH, front = z0 + (d - 0.3) / 2;
  solid.add(0, LOT, z0, w - 0.3, h, d - 0.3, 'concreteDark');
  for (let f = 1; f < floors; f++) solid.add(0, LOT + f * FH, z0, w - 0.25, 0.04, d - 0.25, 'concrete');
  for (let k = 0; k < Math.round(w) - 2; k++) win(b, -(Math.round(w) - 3) / 2 + k, LOT + h - 0.5, front + 0.01, 0.6, 0.2, 0.03, b.lit);
  const sw = Math.min(4, w - 3), sh = Math.min(2.4, h - 0.6);
  solid.add(0, LOT, front + 0.02, sw + 0.4, sh + 0.2, 0.06, 'rubber');
  glow.add(0, LOT, front + 0.06, sw, 0.35, 0.02, 'led');
  for (let k = 0; k < 9; k++) solid.add(0, LOT + 0.35 + (k * (sh - 0.35)) / 9, front + 0.07, sw, (sh - 0.35) / 9 - 0.03, 0.03, k % 2 ? 'metalDark' : 'metal');
  for (const s of [-1, 1]) solid.add(s * (sw / 2 + 0.35), LOT, front + 0.08, 0.2, sh, 0.06, 'car2');
  solid.add(0, LOT + h, z0, w, 0.2, d, 'roof');
  const roof = LOT + h + 0.2;
  for (let k = 0; k < 3; k++) solid.add(-w / 2 + 1.2 + k * 1.1, roof, z0 - d / 2 + 0.8, 0.7, 0.6, 0.7, 'metalDark');
  solid.add(w / 2 - 1, roof, z0 - 0.5, 0.06, 2.6, 0.06, 'metalDark');
  glow.add(w / 2 - 1, roof + 2.6, z0 - 0.5, 0.16, 0.16, 0.16, 'led');
  return {
    roof,
    top: roof + 3,
    billboard: { x: 0, y: roof, z: z0 + 0.4, maxW: w - 1 },
    side: { x: w / 2 - 0.15 + 0.06, y: LOT + (floors - 0.6) * FH, z: z0, maxW: d - 0.5 },
  };
}

// Fallback for a project without its own architecture yet: a glass office.
function office(b) {
  const { w, d, floors, z0, solid } = b;
  const roof = glassBox(b, 0, z0, w, d, LOT, floors);
  solid.add(0, roof, z0, w - 0.2, 0.2, d - 0.2, 'roof');
  solid.add(0, LOT, z0 + d / 2 + 0.35, 2.6, 0.1, 0.8, 'concrete');
  solid.add(0, LOT + 0.9, z0 + d / 2 + 0.35, 2.8, 0.1, 0.9, 'concreteDark');
  return {
    roof: roof + 0.2,
    top: roof + 2.5,
    billboard: { x: 0, y: roof + 0.2, z: z0 + 0.6, maxW: w + 1 },
    side: { x: w / 2 + 0.06, y: LOT + (floors - 0.6) * FH, z: z0, maxW: d - 0.5 },
  };
}

// Clanker Café: a one-storey kiosk with a striped awning, tables outside and a giant cup
// of coffee on the roof. Local coordinates: kiosk centred on (0, 0), terrace toward +z.
export function cafe(b) {
  const { solid, glow, parts } = b;
  const w = 3, d = 2.6, h = 1.3;
  solid.add(0, LOT, 0, w, h, d, 'concrete');
  glow.add(0, LOT + 0.15, d / 2 + 0.01, w - 0.8, 0.75, 0.02, 'windowOn');
  glow.add(w / 2 + 0.01, LOT + 0.15, -0.2, 0.02, 0.75, d - 1.2, 'windowOn');
  solid.add(-0.9, LOT, d / 2 + 0.03, 0.55, 1.0, 0.04, 'coffee');
  // Awning stripes on the two street faces.
  for (let k = 0; k < 6; k++) {
    const key = k % 2 ? 'sail' : 'kofi';
    solid.add(-w / 2 + 0.25 + k * 0.5, LOT + h - 0.1, d / 2 + 0.3, 0.5, 0.07, 0.6, key);
  }
  for (let k = 0; k < 5; k++) solid.add(w / 2 + 0.3, LOT + h - 0.1, -d / 2 + 0.26 + k * 0.52, 0.6, 0.07, 0.52, k % 2 ? 'sail' : 'kofi');
  solid.add(0, LOT + h, 0, w + 0.1, 0.12, d + 0.1, 'kofi');
  const roof = LOT + h + 0.12;
  // The cup.
  parts.add(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 24), 'sail', { x: 0, y: roof + 0.05, z: 0 });
  parts.add(new THREE.CylinderGeometry(0.55, 0.4, 0.8, 24), 'sail', { x: 0, y: roof + 0.48, z: 0 });
  parts.add(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 24), 'coffee', { x: 0, y: roof + 0.86, z: 0 });
  parts.add(new THREE.CylinderGeometry(0.505, 0.47, 0.18, 24), 'kofi', { x: 0, y: roof + 0.6, z: 0 });
  const handle = parts.add(new THREE.TorusGeometry(0.2, 0.06, 8, 16, Math.PI), 'sail', { x: 0.5, y: roof + 0.5, z: 0 });
  handle.rotation.z = -Math.PI / 2;
  // Terrace: tables, chairs and parasols.
  const cone = new THREE.ConeGeometry(0.6, 0.3, 8);
  for (const [tx, tz] of [[-0.8, 2.6], [0.9, 2.4], [0.1, 3.7]]) {
    solid.add(tx, LOT, tz, 0.5, 0.42, 0.5, 'sail');
    solid.add(tx - 0.45, LOT, tz, 0.22, 0.25, 0.22, 'kofi');
    solid.add(tx + 0.45, LOT, tz, 0.22, 0.25, 0.22, 'kofi');
    solid.add(tx, LOT + 0.42, tz, 0.05, 0.75, 0.05, 'metalDark');
    parts.add(cone, 'kofi', { x: tx, y: LOT + 1.25, z: tz });
  }
  return { roof, top: roof + 2 };
}

const STYLES = { rrradio: radio, archipelago: terraces, meinhermes: academy, meinesteuer: bank, rrrecipe: bistro, steinerdesign: studio, 'claude-mods': workshop, squash: hopper, lab };

export function building(id, b) {
  return (STYLES[id] || office)(b);
}
