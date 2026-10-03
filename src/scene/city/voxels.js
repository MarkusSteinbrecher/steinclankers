import * as THREE from 'three';

// Collects boxes (bottom-centre position, size, colour key) and turns them into one
// InstancedMesh. Colour keys are resolved against the palette, so a theme switch is a recolour.
export class VoxelBatch {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.items = [];
    this.mesh = null;
  }

  add(x, y, z, sx, sy, sz, key, rotY = 0) {
    this.items.push({ x, y, z, sx, sy, sz, key, rotY });
    return this.items.length - 1;
  }

  build(pal) {
    const n = this.items.length;
    const mesh = (this.mesh = new THREE.InstancedMesh(this.geometry, this.material, Math.max(n, 1)));
    mesh.count = n;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    this.items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rotY);
      p.set(it.x, it.y + it.sy / 2, it.z);
      s.set(it.sx, it.sy, it.sz);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    this.recolor(pal);
    return mesh;
  }

  recolor(pal) {
    if (!this.mesh) return;
    const c = new THREE.Color();
    this.items.forEach((it, i) => this.mesh.setColorAt(i, c.copy(resolve(pal, it.key))));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export function resolve(pal, key) {
  if (key[0] === 'l' && key.length === 2) return pal.levels[+key[1]];
  if (key[0] === 's' && key.length === 2) return pal.sleep[+key[1]];
  return pal[key] || pal.metal;
}

// Geometry with per-vertex colours from keyed parts, for instanced characters (cars, crowds).
export class KeyedGeometry {
  constructor(parts) {
    // parts: [{ geo, key, x, y, z }]
    const geos = parts.map((p) => {
      const g = p.geo.clone().toNonIndexed();
      g.translate(p.x || 0, p.y || 0, p.z || 0);
      return g;
    });
    let count = 0;
    geos.forEach((g) => { count += g.attributes.position.count; });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
    let o = 0;
    this.ranges = [];
    geos.forEach((g, i) => {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      this.ranges.push({ key: parts[i].key, start: o, count: g.attributes.position.count });
      o += g.attributes.position.count;
    });
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }

  recolor(pal) {
    const col = this.geometry.attributes.color;
    for (const r of this.ranges) {
      const c = resolve(pal, r.key);
      for (let i = r.start; i < r.start + r.count; i++) col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }
}
