// City grid. One cell = one day-sized tile. Blocks are 16 x 16 cells (outer ring = sidewalk)
// separated by 2-cell roads, so the pattern repeats every P cells. Block b covers cells
// b*P-8 .. b*P+7; road cells sit at b*P+8 and b*P+9.
export const P = 18;
export const BMIN = -3, BMAX = 3; // detailed blocks
export const X0 = (BMIN - 1) * P + 8; // -64: the outer road on the low side
export const X1 = BMAX * P + 9; //  63: the outer road on the high side
export const W = X1 - X0 + 1;
export const OUTER = 9; // low-detail blocks reach out to here

export const CLS = { lot: 0, sidewalk: 1, road: 2, crosswalk: 3, junction: 4, apron: 5, hq: 6, grass: 7, paving: 8, field: 9 };
export const HEIGHT = [0.18, 0.26, 0.1, 0.1, 0.1, 0.18, 0.18, 0.22, 0.12, 0.22];
export const FLOOR = 0.18;

export const idx = (x, z) => (z - X0) * W + (x - X0);
export const inside = (x, z) => x >= X0 && x <= X1 && z >= X0 && z <= X1;
export const loc = (v) => (((v + 8) % P) + P) % P;
export const blockOf = (v) => Math.floor((v + 8) / P);

// Class of a cell from the repeating pattern alone (before blocks are furnished).
export function baseClass(x, z) {
  const lx = loc(x), lz = loc(z);
  const rx = lx >= 16, rz = lz >= 16;
  if (rx && rz) return CLS.junction;
  if (rx) return lz === 0 || lz === 15 ? CLS.crosswalk : CLS.road;
  if (rz) return lx === 0 || lx === 15 ? CLS.crosswalk : CLS.road;
  if (lx === 0 || lx === 15 || lz === 0 || lz === 15) return CLS.sidewalk;
  return CLS.lot;
}

// Road direction at a road cell: 'v' runs along z, 'h' runs along x.
export const roadAxis = (x, z) => (loc(x) >= 16 ? 'v' : 'h');

// Stations sit in the ring of blocks around the HQ; the last two flank it further out.
export const STATION_BLOCKS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [-2, 0], [2, 0]];

// Hand-placed specials; every other detailed block is furnished at random.
export const SPECIAL_BLOCKS = {
  '0,-2': 'park',
  '2,-2': 'stadium',
  '-2,-2': 'works',
  '-2,2': 'park',
  '2,2': 'parking',
  '0,2': 'downtown',
  '0,-3': 'downtown',
  '-3,0': 'works',
};

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Breadth-first path over walkable cells. Returns [[x, z], ...] or null.
export function bfs(walk, from, to, maxSteps = Infinity) {
  const n = W * W;
  const prev = new Int32Array(n).fill(-1);
  const s = idx(from[0], from[1]), t = idx(to[0], to[1]);
  if (!walk[s] || !walk[t]) return null;
  const q = new Int32Array(n);
  let head = 0, tail = 0;
  q[tail++] = s;
  prev[s] = s;
  while (head < tail) {
    const c = q[head++];
    if (c === t) break;
    if (head > maxSteps) return null;
    const cx = (c % W) + X0, cz = Math.floor(c / W) + X0;
    for (const [dx, dz] of DIRS) {
      const nx = cx + dx, nz = cz + dz;
      if (!inside(nx, nz)) continue;
      const ni = idx(nx, nz);
      if (prev[ni] !== -1 || !walk[ni]) continue;
      prev[ni] = c;
      q[tail++] = ni;
    }
  }
  if (prev[t] === -1) return null;
  const out = [];
  for (let c = t; ; c = prev[c]) {
    out.push([(c % W) + X0, Math.floor(c / W) + X0]);
    if (c === s) break;
  }
  return out.reverse();
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Keep only the corners of a cell path.
export function corners(cells) {
  if (cells.length < 3) return cells.map(([x, z]) => ({ x, z }));
  const out = [{ x: cells[0][0], z: cells[0][1] }];
  for (let i = 1; i < cells.length - 1; i++) {
    const [ax, az] = cells[i - 1], [bx, bz] = cells[i], [cx, cz] = cells[i + 1];
    if (bx - ax !== cx - bx || bz - az !== cz - bz) out.push({ x: bx, z: bz });
  }
  const last = cells[cells.length - 1];
  out.push({ x: last[0], z: last[1] });
  return out;
}
