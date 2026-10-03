import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bfs, corners } from './city/layout.js';

// The one human in the city, as a LEGO-style minifigure after the GitHub photo: red climbing helmet with a headlamp,
// pale sunglasses, dark jacket. Walks from building to building, stops at each one for a
// look, and gets a coffee now and then. Colours are scene values, like the logo signs.
const C = { skin: '#F2CD37', helmet: '#E5322B', lamp: '#2A2E33', glass: '#D9DCD6', lens: '#5B6168', jacket: '#2A2E33', jeans: '#3B4A63', shoe: '#1F2328', strap: '#1F2328' };
const SPEED = 1.5;

// The printed minifig face: his pale sunglasses and a grin.
function faceTexture() {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 200;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  for (const x of [112, 208]) {
    ctx.fillStyle = '#D9DCD6';
    ctx.beginPath();
    ctx.roundRect(x - 40, 84, 80, 46, 16);
    ctx.fill();
    ctx.fillStyle = '#4A5058';
    ctx.beginPath();
    ctx.roundRect(x - 31, 92, 62, 30, 11);
    ctx.fill();
  }
  ctx.strokeStyle = '#D9DCD6';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(150, 98);
  ctx.lineTo(170, 98);
  ctx.stroke();
  ctx.strokeStyle = '#1F2328';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(160, 132, 32, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

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
    const box = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, r);
    // A LEGO-style minifigure: blocky legs on a hip piece, a tapered torso, splayed arms with
    // C-shaped hands, a cylinder head with a printed face, and the helmet on top.
    const limb = (x, y, parts, splay = 0) => {
      const p = new THREE.Group();
      p.position.set(x, y, 0);
      g.add(p);
      const inner = new THREE.Group();
      inner.rotation.z = splay;
      p.add(inner);
      parts.forEach(([geo, m, py, pz = 0]) => add(geo, m, 0, py, pz, inner));
      return p;
    };
    this.legs = [-0.105, 0.105].map((x) => limb(x, 0.66, [[box(0.2, 0.52, 0.26), mat.jeans, -0.28], [box(0.2, 0.1, 0.32), mat.jeans, -0.56, 0.03]]));
    add(box(0.44, 0.12, 0.26), mat.jeans, 0, 0.72, 0);
    const torso = new THREE.BoxGeometry(0.44, 0.6, 0.24);
    const pos = torso.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setX(i, pos.getX(i) * (0.32 / 0.44));
    torso.computeVertexNormals();
    add(torso, mat.jacket, 0, 1.08, 0);
    add(new THREE.BoxGeometry(0.016, 0.56, 0.01), mat.glass, 0, 1.08, 0.125);
    add(box(0.2, 0.05, 0.05, 0.015), mat.jacket, 0, 1.39, 0.06);
    const claw = new THREE.TorusGeometry(0.055, 0.026, 8, 16, Math.PI * 1.5);
    claw.rotateX(Math.PI / 2);
    claw.rotateY(-0.75 * Math.PI);
    this.arms = [-1, 1].map((sx) => limb(sx * 0.19, 1.32, [[box(0.12, 0.42, 0.14, 0.04), mat.jacket, -0.19], [new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10), mat.skin, -0.42], [claw, mat.skin, -0.47, 0.02]], sx * 0.14));
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), mat.skin, 0, 1.405, 0);
    const head = (this.head = new THREE.Group());
    head.position.set(0, 1.58, 0);
    g.add(head);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 32), mat.skin, 0, 0, 0, head);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.1705, 0.1705, 0.3, 32, 1, true, -0.45 * Math.PI, 0.9 * Math.PI), new THREE.MeshStandardMaterial({ map: faceTexture(), transparent: true, roughness: 0.6 }));
    head.add(face);
    // Climbing helmet: a round shell with a thin rim and a headlamp; straps down the sides.
    add(new THREE.SphereGeometry(0.215, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.helmet, 0, 0.08, -0.01, head).scale.set(1, 0.9, 1.04);
    add(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 28), mat.helmet, 0, 0.08, -0.01, head).scale.set(1, 1, 1.04);
    add(box(0.1, 0.07, 0.05, 0.015), mat.lamp, 0, 0.19, 0.19, head);
    add(box(0.24, 0.025, 0.025, 0.01), mat.strap, 0, 0.14, 0.205, head);
    add(box(0.025, 0.16, 0.025, 0.01), mat.strap, -0.172, -0.01, 0.03, head);
    add(box(0.025, 0.16, 0.025, 0.01), mat.strap, 0.172, -0.01, 0.03, head);
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
