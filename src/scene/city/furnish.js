import { P, BMIN, BMAX, SPECIAL_BLOCKS, STATION_BLOCKS, rng, loc, roadAxis, X0, X1 } from './layout.js';

export const LOT = 0.22; // top of a block's lot slab

// Furnishes the city. Static boxes go into `solid` (lit) or `glow` (unlit: windows, lamps),
// trees into `trees`. Returns anchors for moving things.
export function furnish(ground, solid, glow, trees, stationBlocks = STATION_BLOCKS) {
  const R = rng(20261003);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const out = { chimneys: [], parking: [], rooftops: [], fountains: [] };
  const taken = new Set(stationBlocks.map(([x, z]) => `${x},${z}`));
  taken.add('0,0');

  // ----- street furniture: markings, lamps, street trees -----
  for (let z = X0; z <= X1; z++) {
    for (let x = X0; x <= X1; x++) {
      const lx = loc(x), lz = loc(z);
      if (lx === 16 && lz > 0 && lz < 15 && z % 2 === 0) solid.add(x + 0.5, 0.06, z, 0.1, 0.02, 0.6, 'lane');
      if (lz === 16 && lx > 0 && lx < 15 && x % 2 === 0) solid.add(x, 0.06, z + 0.5, 0.6, 0.02, 0.1, 'lane');
      if ((lx >= 16) !== (lz >= 16) && (lx === 0 || lx === 15 || lz === 0 || lz === 15)) {
        const v = roadAxis(x, z) === 'v';
        for (let k = -1; k <= 1; k++) {
          if (v) solid.add(x, 0.06, z + k * 0.27, 0.8, 0.02, 0.14, 'lane');
          else solid.add(x + k * 0.27, 0.06, z, 0.14, 0.02, 0.8, 'lane');
        }
      }
      if ((lx === 0 || lx === 15) && (lz === 0 || lz === 15)) lamp(x, z);
    }
  }
  for (let bz = BMIN; bz <= BMAX; bz++) {
    for (let bx = BMIN; bx <= BMAX; bx++) {
      const x0 = bx * P - 8.25, x1 = bx * P + 7.25, z0 = bz * P - 8.25, z1 = bz * P + 7.25;
      for (let o = -5.5; o <= 4.5; o += 3.3) {
        trees.add(bx * P - 0.5 + o, z0, 0.2, 0.8);
        trees.add(bx * P - 0.5 + o, z1, 0.2, 0.8);
        trees.add(x0, bz * P - 0.5 + o, 0.2, 0.8);
        trees.add(x1, bz * P - 0.5 + o, 0.2, 0.8);
      }
    }
  }

  // ======== block types ========
  const BUILDING = ['concrete', 'stone', 'sand', 'blueGrey', 'concreteDark'];

  function office(x, z, w, d, floors) {
    // Glass box with white floor slabs, Silicon Valley style.
    const fh = 0.9, h = floors * fh;
    solid.add(x, LOT, z, w - 0.4, h, d - 0.4, 'glass');
    for (let f = 0; f <= floors; f++) solid.add(x, LOT + f * fh - 0.08, z, w, 0.16, d, 'concrete');
    for (let f = 0; f < floors; f++) {
      const y = LOT + f * fh + 0.16;
      for (let k = 0; k < w - 1; k++) if (R() < 0.3) glow.add(x - (w - 2) / 2 + k, y, z + (d - 0.4) / 2 + 0.01, 0.9, 0.55, 0.02, 'windowOn');
      for (let k = 0; k < d - 1; k++) if (R() < 0.3) glow.add(x + (w - 0.4) / 2 + 0.01, y, z - (d - 2) / 2 + k, 0.02, 0.55, 0.9, 'windowOn');
    }
    roofTop(x, z, LOT + h + 0.08);
  }

  function masonry(x, z, w, d, floors) {
    const fh = 0.9, h = floors * fh;
    solid.add(x, LOT, z, w - 0.3, h, d - 0.3, pick(BUILDING));
    const lit = 0.2 + R() * 0.3;
    for (let f = 0; f < floors; f++) {
      const y = LOT + f * fh + 0.22;
      for (let k = 0; k < w - 1; k++) {
        const px = x - (w - 2) / 2 + k;
        win(px, y, z + (d - 0.3) / 2 + 0.01, 0.5, 0.48, 0.03, lit);
        win(px, y, z - (d - 0.3) / 2 - 0.01, 0.5, 0.48, 0.03, lit);
      }
      for (let k = 0; k < d - 1; k++) {
        const pz = z - (d - 2) / 2 + k;
        win(x + (w - 0.3) / 2 + 0.01, y, pz, 0.03, 0.48, 0.5, lit);
        win(x - (w - 0.3) / 2 - 0.01, y, pz, 0.03, 0.48, 0.5, lit);
      }
    }
    solid.add(x, LOT + h, z, w - 0.1, 0.16, d - 0.1, 'roof');
    roofTop(x, z, LOT + h + 0.16);
  }

  function roofTop(x, z, top) {
    const r = R();
    if (r < 0.4) solid.add(x + 0.6, top, z - 0.3, 1.2, 0.5, 0.9, 'concreteDark');
    else if (r < 0.6) {
      solid.add(x - 0.4, top, z, 0.1, 0.7, 0.1, 'trunk');
      solid.add(x + 0.4, top, z, 0.1, 0.7, 0.1, 'trunk');
      solid.add(x, top + 0.7, z, 1.2, 1.0, 1.2, 'roofSlate');
    } else if (r < 0.75) {
      solid.add(x, top, z, 0.08, 2.2, 0.08, 'trunk');
      glow.add(x, top + 2.2, z, 0.18, 0.18, 0.18, 'car0');
    }
    out.rooftops.push({ x, y: top + 0.2, z });
  }

  function win(x, y, z, sx, sy, sz, lit) {
    if (R() < lit) glow.add(x, y, z, sx, sy, sz, 'windowOn');
    else solid.add(x, y, z, sx, sy, sz, 'windowOff');
  }

  function downtown(cx, cz) {
    ground.setSurface(cx / P, cz / P, 'paving');
    for (const [ox, oz] of [[-4, -4], [3, -4], [-4, 3], [3, 3]]) {
      const x = cx + ox, z = cz + oz;
      if (R() < 0.2) {
        trees.add(x - 1.5, z - 1.5, LOT, 1.1);
        trees.add(x + 1.5, z + 1.2, LOT, 1);
        solid.add(x, LOT, z, 1.6, 0.35, 1.6, 'concreteDark');
        continue;
      }
      const w = 4 + Math.floor(R() * 2), d = 4 + Math.floor(R() * 2), floors = 4 + Math.floor(R() * 6);
      (R() < 0.5 ? office : masonry)(x, z, w, d, floors);
    }
  }

  function house(x, z, rot) {
    solid.add(x, LOT, z, 3, 1.6, 3, pick(['concrete', 'sand', 'stone']), rot);
    const roof = pick(['roofSlate', 'roofSlate', 'roof']);
    solid.add(x, LOT + 1.6, z, 3.3, 0.42, 3.3, roof, rot);
    solid.add(x, LOT + 2.02, z, 2.1, 0.4, 3.3, roof, rot);
    solid.add(x, LOT + 2.42, z, 0.9, 0.34, 3.3, roof, rot);
    const s = Math.sin(rot), c = Math.cos(rot);
    const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    let [dx, dz] = at(0, 1.51);
    solid.add(dx, LOT, dz, 0.6, 1.0, 0.05, 'glassDark', rot);
    for (const lx of [-0.95, 0.95]) {
      [dx, dz] = at(lx, 1.51);
      if (R() < 0.5) glow.add(dx, LOT + 0.7, dz, 0.55, 0.5, 0.05, 'windowOn', rot);
      else solid.add(dx, LOT + 0.7, dz, 0.55, 0.5, 0.05, 'windowOff', rot);
    }
  }

  function houses(cx, cz) {
    ground.setSurface(cx / P, cz / P, 'grass');
    for (let k = 0; k < 3; k++) {
      house(cx - 4.5 + k * 4.5, cz - 4.2, Math.PI);
      house(cx - 4.5 + k * 4.5, cz + 3.4, 0);
    }
    for (let k = 0; k < 6; k++) trees.add(cx - 6.5 + k * 2.5 + R(), cz - 0.6 + (R() - 0.5), LOT, 0.8 + R() * 0.4);
  }

  // Parks come in three kinds so the city doesn't repeat itself: a pond with a fountain,
  // a playground, and a lawn with a pavilion. Only the pond has a fountain.
  let parkCount = 0;
  function park(cx, cz) {
    ground.setSurface(cx / P, cz / P, 'grass');
    const kind = parkCount++ % 3;
    const x = cx - 0.5, z = cz - 0.5;
    if (kind === 0) {
      solid.add(x, LOT, z, 13.9, 0.02, 1.6, 'paving');
      solid.add(x, LOT, z, 1.6, 0.02, 13.9, 'paving');
      solid.add(x, LOT, z, 4.6, 0.12, 4.6, 'shore');
      solid.add(x, LOT, z, 4.0, 0.14, 4.0, 'water');
      solid.add(x, LOT, z, 0.6, 0.9, 0.6, 'concrete');
      out.fountains.push({ x, y: LOT + 1.0, z });
      for (const [bx, bz, r] of [[-3.2, -1.7, 0], [2.2, -1.7, 0], [-3.2, 0.7, Math.PI], [2.2, 0.7, Math.PI]]) solid.add(cx + bx, LOT, cz + bz, 1.2, 0.3, 0.4, 'trunk', r);
    } else if (kind === 1) {
      // Playground: sand pit, swings, a slide and a climbing frame.
      solid.add(x + 2, LOT, z - 1, 6, 0.04, 5, 'shore');
      for (const sx of [-0.9, 0.9]) solid.add(x + 0.4 + sx, LOT, z - 2.4, 0.1, 1.4, 0.1, 'car1');
      solid.add(x + 0.4, LOT + 1.4, z - 2.4, 1.9, 0.1, 0.1, 'car1');
      for (const sx of [-0.4, 0.4]) solid.add(x + 0.4 + sx, LOT + 0.4, z - 2.4, 0.4, 0.06, 0.25, 'car0');
      solid.add(x + 3.5, LOT, z - 2.2, 0.8, 1.2, 0.8, 'car2');
      solid.add(x + 3.5, LOT + 0.5, z - 1.1, 0.5, 0.08, 1.6, 'car7', 0);
      solid.add(x + 2.2, LOT, z + 0.4, 1.4, 1.0, 1.4, 'car6');
      solid.add(x + 2.2, LOT + 1.0, z + 0.4, 1.0, 0.1, 1.0, 'car0');
      solid.add(x - 3, LOT, z + 3, 6, 0.02, 1.4, 'paving');
      for (const [bx, bz] of [[-4, 2.2], [-1.5, 2.2]]) solid.add(x + bx, LOT, z + bz, 1.2, 0.3, 0.4, 'trunk');
    } else {
      // Lawn with a round-ish pavilion and paths.
      solid.add(x, LOT, z, 13.9, 0.02, 1.2, 'paving');
      solid.add(x - 2, LOT, z, 4, 0.12, 4, 'paving');
      for (const [px, pz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) solid.add(x - 2 + px, LOT + 0.12, z + pz, 0.2, 1.5, 0.2, 'concrete');
      solid.add(x - 2, LOT + 1.62, z, 3.8, 0.16, 3.8, 'roofSlate');
      solid.add(x - 2, LOT + 1.78, z, 2.6, 0.2, 2.6, 'roofSlate');
      solid.add(x - 2, LOT + 1.98, z, 1.2, 0.2, 1.2, 'roofSlate');
    }
    for (const [qx, qz] of [[-4.3, -4.3], [3.3, -4.3], [-4.3, 3.3], [3.3, 3.3]]) {
      if (kind === 1 && qx > 0 && qz < 0) continue; // keep the playground open
      for (let k = 0; k < 4; k++) trees.add(cx + qx + (R() - 0.5) * 4, cz + qz + (R() - 0.5) * 4, LOT, 0.9 + R() * 0.6);
    }
  }

  function stadium(cx, cz) {
    ground.setSurface(cx / P, cz / P, 'paving');
    const fx = cx - 0.5, fz = cz - 0.5;
    solid.add(fx, LOT, fz, 10, 0.04, 7.4, 'grass');
    for (let k = -4; k <= 4; k += 2) solid.add(fx + k, LOT + 0.04, fz, 1, 0.005, 7.4, 'grassDark');
    solid.add(fx, LOT + 0.045, fz, 0.06, 0.005, 7.4, 'lane');
    solid.add(fx - 4.6, LOT, fz, 0.1, 0.7, 1.6, 'lane');
    solid.add(fx + 4.6, LOT, fz, 0.1, 0.7, 1.6, 'lane');
    for (let s = 0; s < 3; s++) {
      const y = LOT + s * 0.55, o = 4.4 + s * 0.7, key = s % 2 ? 'concrete' : 'concreteDark';
      solid.add(fx, y, fz - o, 11.4 + s * 1.4, 0.55, 0.7, key);
      solid.add(fx, y, fz + o, 11.4 + s * 1.4, 0.55, 0.7, key);
      solid.add(fx - o - 1.4, y, fz, 0.7, 0.55, 8.2 + s * 1.4, key);
      solid.add(fx + o + 1.4, y, fz, 0.7, 0.55, 8.2 + s * 1.4, key);
    }
    for (const [ox, oz] of [[-6.6, -6.4], [6.6, -6.4], [-6.6, 5.6], [6.6, 5.6]]) {
      solid.add(fx + ox, LOT, fz + oz, 0.2, 4.5, 0.2, 'trunk');
      glow.add(fx + ox, LOT + 4.5, fz + oz, 0.9, 0.5, 0.9, 'lamp');
    }
  }

  function works(cx, cz) {
    ground.setSurface(cx / P, cz / P, 'paving');
    const x = cx - 0.5, z = cz - 2;
    solid.add(x, LOT, z, 12, 2.6, 6, 'blueGrey');
    for (let k = 0; k < 6; k++) {
      solid.add(x - 5 + k * 2, LOT + 2.6, z, 1.4, 0.9, 6, 'roof');
      glow.add(x - 5 + k * 2 + 0.75, LOT + 2.65, z, 0.1, 0.8, 5.6, 'windowOn');
    }
    for (let k = 0; k < 4; k++) win(x - 4.5 + k * 3, LOT + 0.9, z + 3.01, 1.6, 0.9, 0.04, 0.7);
    solid.add(x - 1.5, LOT, z + 3.02, 2, 1.8, 0.06, 'rubber');
    for (const ox of [-4.5, 4]) {
      solid.add(x + ox, LOT, z - 4.2, 1.1, 6.5, 1.1, 'concreteDark');
      solid.add(x + ox, LOT + 5.5, z - 4.2, 1.25, 0.35, 1.25, 'car0');
      out.chimneys.push({ x: x + ox, y: LOT + 6.6, z: z - 4.2 });
    }
    for (let k = 0; k < 7; k++) solid.add(cx - 6 + R() * 12, LOT, cz + 3.5 + R() * 3, 0.8, 0.8, 0.8, pick(['car7', 'car1', 'sand']), R());
  }

  function parking(cx, cz) {
    ground.setSurface(cx / P, cz / P, 'asphalt');
    for (let row = 0; row < 3; row++) {
      const z = cz - 5 + row * 5;
      for (let k = 0; k < 7; k++) {
        const x = cx - 6.5 + k * 2;
        solid.add(x - 0.95, LOT, z, 0.06, 0.01, 2.2, 'lane');
        if (R() < 0.7) out.parking.push({ x: x + 0.05, z, rot: Math.PI / 2 + (R() < 0.5 ? 0 : Math.PI) });
      }
    }
  }

  function lamp(x, z) {
    solid.add(x, 0.2, z, 0.1, 2.0, 0.1, 'trunk');
    glow.add(x, 2.2, z, 0.3, 0.16, 0.3, 'lamp');
  }

  // Fill the remaining blocks, inner rings first. Downtown near the centre, houses further
  // out, at most MAX_PARKS parks and never two parks side by side (diagonals included).
  const TYPES = { downtown, houses, park, stadium, works, parking };
  const MAX_PARKS = 6;
  const types = new Map(Object.entries(SPECIAL_BLOCKS));
  const ring = ([x, z]) => Math.max(Math.abs(x), Math.abs(z));
  const free = [];
  for (let bz = BMIN; bz <= BMAX; bz++) for (let bx = BMIN; bx <= BMAX; bx++) {
    const key = `${bx},${bz}`;
    if (!taken.has(key) && !types.has(key)) free.push([bx, bz]);
  }
  free.sort((a, b) => ring(a) - ring(b));
  const parkNear = (bx, bz) => {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if ((dx || dz) && types.get(`${bx + dx},${bz + dz}`) === 'park') return true;
    return false;
  };
  for (const [bx, bz] of free) {
    let options = ring([bx, bz]) <= 1 ? ['downtown'] : ring([bx, bz]) === 2 ? ['downtown', 'downtown', 'houses', 'park'] : ['houses', 'houses', 'houses', 'downtown', 'park'];
    const parks = [...types.values()].filter((t) => t === 'park').length;
    if (parks >= MAX_PARKS || parkNear(bx, bz)) options = options.filter((t) => t !== 'park');
    types.set(`${bx},${bz}`, pick(options));
  }
  for (const [key, type] of types) {
    if (taken.has(key)) continue;
    const [bx, bz] = key.split(',').map(Number);
    TYPES[type](bx * P, bz * P);
  }

  return out;
}
