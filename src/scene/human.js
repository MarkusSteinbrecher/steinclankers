import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bfs, corners } from './city/layout.js';

// The one human in the city, after the GitHub photo: red climbing helmet with a headlamp,
// pale sunglasses, dark jacket. Walks from building to building, stops at each one for a
// look, and gets a coffee now and then. Colours are scene values, like the logo signs.
const C = { skin: '#E2B596', helmet: '#E5322B', lamp: '#2A2E33', glass: '#D9DCD6', lens: '#5B6168', jacket: '#2A2E33', jeans: '#3B4A63', shoe: '#1F2328', strap: '#1F2328' };
const SPEED = 1.5;

export class Human {
  // stops: [{ door: [x, z], approach: [{ x, z }, ...], face }]; walk: the sidewalk grid.
  constructor(walk, stops, still) {
    this.walk = walk;
    this.stops = stops;
    this.still = still;
    this.path = [];
    this.seg = 0;
    this.d = 0;
    this.wait = 0;
    this.wave = -1;
    this.heading = 0;
    this.stopIndex = 0;
    this.pos = new THREE.Vector3();

    const mat = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, new THREE.MeshStandardMaterial({ color: v, roughness: k === 'helmet' ? 0.45 : 0.8 })]));
    const g = (this.group = new THREE.Group());
    g.scale.setScalar(1.6);
    const add = (geo, m, x, y, z, parent = g) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const box = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 2, r);
    // Legs and arms hang from pivots so they can swing.
    const limb = (x, y, parts) => {
      const p = new THREE.Group();
      p.position.set(x, y, 0);
      g.add(p);
      parts.forEach(([geo, m, py]) => add(geo, m, 0, py, 0, p));
      return p;
    };
    this.legs = [-0.12, 0.12].map((x) => limb(x, 0.72, [[box(0.18, 0.62, 0.2), mat.jeans, -0.31], [box(0.2, 0.12, 0.3), mat.shoe, -0.66]]));
    add(box(0.5, 0.66, 0.3, 0.08), mat.jacket, 0, 1.04, 0);
    this.arms = [-0.32, 0.32].map((x) => limb(x, 1.32, [[box(0.14, 0.58, 0.16), mat.jacket, -0.27], [box(0.12, 0.12, 0.12), mat.skin, -0.6]]));
    add(box(0.12, 0.1, 0.12), mat.skin, 0, 1.42, 0);
    const head = (this.head = new THREE.Group());
    head.position.set(0, 1.62, 0);
    g.add(head);
    add(box(0.36, 0.38, 0.36, 0.1), mat.skin, 0, 0, 0, head);
    add(new THREE.SphereGeometry(0.25, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat.helmet, 0, 0.08, -0.01, head);
    add(box(0.52, 0.04, 0.52, 0.02), mat.helmet, 0, 0.08, -0.01, head);
    add(box(0.12, 0.08, 0.06, 0.02), mat.lamp, 0, 0.2, 0.22, head);
    add(box(0.38, 0.03, 0.05, 0.01), mat.strap, 0, 0.11, 0.2, head);
    add(box(0.14, 0.09, 0.03, 0.02), mat.glass, -0.09, 0.02, 0.185, head);
    add(box(0.14, 0.09, 0.03, 0.02), mat.glass, 0.09, 0.02, 0.185, head);
    add(box(0.1, 0.06, 0.02, 0.015), mat.lens, -0.09, 0.02, 0.2, head);
    add(box(0.1, 0.06, 0.02, 0.015), mat.lens, 0.09, 0.02, 0.2, head);
    add(box(0.03, 0.2, 0.03, 0.01), mat.strap, -0.17, -0.08, 0.05, head);
    add(box(0.03, 0.2, 0.03, 0.01), mat.strap, 0.17, -0.08, 0.05, head);
    g.traverse((o) => { o.userData.human = this; });

    const first = stops[0];
    const a = first.approach.at(-1);
    this.pos.set(a.x, 0.22, a.z);
    this.heading = first.face;
    this.wait = 2;
    this.#place();
  }

  // Wave and pause for a moment (on click).
  poke() {
    this.wave = 0;
    this.wait = Math.max(this.wait, 2.2);
  }

  #nextStop() {
    const here = this.stops[this.stopIndex];
    let n = this.stopIndex;
    while (n === this.stopIndex) n = Math.floor(Math.random() * this.stops.length);
    const next = this.stops[n];
    const cells = bfs(this.walk, here.door, next.door);
    if (!cells) return void (this.wait = 2);
    this.stopIndex = n;
    this.path = [
      { x: this.pos.x, z: this.pos.z },
      ...here.approach.slice(0, -1).reverse(),
      ...corners(cells),
      ...next.approach,
    ];
    this.seg = 0;
    this.d = 0;
  }

  update(dt, t) {
    if (this.still) return;
    if (this.wave >= 0) {
      this.wave += dt;
      this.arms[1].rotation.z = Math.sin(Math.min(1, this.wave / 0.3) * Math.PI / 2) * 2.6 + Math.sin(this.wave * 12) * 0.25;
      if (this.wave > 1.8) { this.wave = -1; this.arms[1].rotation.z = 0; }
    }
    if (this.wait > 0) {
      this.wait -= dt;
      this.#swing(0);
      if (this.wait <= 0) this.#nextStop();
      return;
    }
    const a = this.path[this.seg], b = this.path[this.seg + 1];
    if (!b) {
      this.wait = 3 + Math.random() * 3;
      this.heading = this.stops[this.stopIndex].face;
      this.#place();
      return;
    }
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
    this.d += SPEED * dt;
    if (this.d >= len) {
      this.d -= len;
      this.seg++;
    }
    const k = Math.min(1, this.d / len);
    this.pos.set(a.x + (b.x - a.x) * k, 0.22, a.z + (b.z - a.z) * k);
    const want = Math.atan2(b.x - a.x, b.z - a.z);
    let diff = want - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.heading += diff * Math.min(1, dt * 10);
    this.#swing(Math.sin(t * 7.5));
    this.#place();
  }

  #swing(s) {
    this.legs[0].rotation.x = s * 0.5;
    this.legs[1].rotation.x = -s * 0.5;
    this.arms[0].rotation.x = -s * 0.4;
    if (this.wave < 0) this.arms[1].rotation.x = s * 0.4;
  }

  #place() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }
}
