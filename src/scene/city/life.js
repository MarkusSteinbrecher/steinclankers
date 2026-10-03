import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { P, X0, X1, W, idx, inside, bfs, corners } from './layout.js';
import { KeyedGeometry, resolve } from './voxels.js';
import { CLOTHES } from '../robot.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const NODE_MIN = -4, NODE_MAX = 3;
const node = (i) => i * P + 8.5;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------- traffic: instanced cars driving the road grid on the right-hand lane ----------
export class Traffic {
  constructor(scene, pal, parked, count, still) {
    this.still = still;
    const R = Math.random;
    this.bodyGeo = box(1.5, 0.42, 0.78);
    this.bodyGeo.translate(0, 0.38, 0);
    this.details = new KeyedGeometry([
      { geo: box(0.86, 0.36, 0.7), key: 'glass', x: -0.12, y: 0.77 },
      { geo: box(0.7, 0.06, 0.72), key: 'concrete', x: -0.12, y: 0.98 },
      ...[[-0.48, -0.36], [0.48, -0.36], [-0.48, 0.36], [0.48, 0.36]].map(([x, z]) => ({ geo: box(0.32, 0.32, 0.14), key: 'rubber', x, y: 0.18, z })),
      { geo: box(0.04, 0.1, 0.16), key: 'lamp', x: 0.76, y: 0.42, z: -0.25 },
      { geo: box(0.04, 0.1, 0.16), key: 'lamp', x: 0.76, y: 0.42, z: 0.25 },
    ]);
    this.details.recolor(pal);
    this.cars = [];
    const keys = ['car0', 'car1', 'car2', 'car3', 'car4', 'car5', 'car6', 'car7', 'car3', 'car5'];
    for (let k = 0; k < count; k++) {
      const i = NODE_MIN + Math.floor(R() * (NODE_MAX - NODE_MIN + 1)), j = NODE_MIN + Math.floor(R() * (NODE_MAX - NODE_MIN + 1));
      const car = { from: [i, j], dir: DIRS[Math.floor(R() * 4)], t: R(), speed: 3.2 + R() * 2.2, key: keys[k % keys.length], bus: k % 11 === 0, x: node(i), z: node(j), heading: 0 };
      if (!this.#valid(car.from, car.dir)) car.dir = car.dir.map((v) => -v);
      this.cars.push(car);
    }
    for (const p of parked) this.cars.push({ parked: true, x: p.x, z: p.z, heading: p.rot, key: keys[Math.floor(R() * keys.length)] });

    const n = this.cars.length;
    this.bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    this.detailMat = new THREE.MeshStandardMaterial({ roughness: 0.6, vertexColors: true });
    this.body = new THREE.InstancedMesh(this.bodyGeo, this.bodyMat, n);
    this.detail = new THREE.InstancedMesh(this.details.geometry, this.detailMat, n);
    for (const m of [this.body, this.detail]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
    }
    this.recolor(pal);
    this.#write();
  }

  #valid([i, j], [dx, dz]) {
    const ni = i + dx, nj = j + dz;
    return ni >= NODE_MIN && ni <= NODE_MAX && nj >= NODE_MIN && nj <= NODE_MAX;
  }

  recolor(pal) {
    this.details.recolor(pal);
    const c = new THREE.Color();
    this.cars.forEach((car, i) => {
      this.body.setColorAt(i, c.copy(resolve(pal, car.key)));
      this.detail.setColorAt(i, c.set(0xffffff));
    });
    this.body.instanceColor.needsUpdate = true;
    this.detail.instanceColor.needsUpdate = true;
  }

  #m = new THREE.Matrix4();
  #q = new THREE.Quaternion();
  #p = new THREE.Vector3();
  #s = new THREE.Vector3();
  #up = new THREE.Vector3(0, 1, 0);

  #write() {
    this.cars.forEach((car, i) => {
      this.#q.setFromAxisAngle(this.#up, car.heading);
      this.#p.set(car.x, car.parked ? 0.22 : 0.06, car.z);
      this.#s.set(car.bus ? 1.9 : 1, car.bus ? 1.3 : 1, 1);
      this.#m.compose(this.#p, this.#q, this.#s);
      this.body.setMatrixAt(i, this.#m);
      this.detail.setMatrixAt(i, this.#m);
    });
    this.body.instanceMatrix.needsUpdate = true;
    this.detail.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    if (this.still) return;
    for (const car of this.cars) {
      if (car.parked) continue;
      car.t += (car.speed * dt) / P;
      while (car.t >= 1) {
        car.t -= 1;
        car.from = [car.from[0] + car.dir[0], car.from[1] + car.dir[1]];
        const options = DIRS.filter((d) => this.#valid(car.from, d) && !(d[0] === -car.dir[0] && d[1] === -car.dir[1]));
        // Prefer going straight, sometimes turn.
        const straight = options.find((d) => d[0] === car.dir[0] && d[1] === car.dir[1]);
        car.dir = straight && Math.random() < 0.55 ? straight : options[Math.floor(Math.random() * options.length)] || car.dir.map((v) => -v);
      }
      const [dx, dz] = car.dir;
      const tx = node(car.from[0]) + dx * car.t * P - dz * 0.5;
      const tz = node(car.from[1]) + dz * car.t * P + dx * 0.5;
      const k = Math.min(1, dt * 10);
      car.x += (tx - car.x) * k;
      car.z += (tz - car.z) * k;
      let target = Math.atan2(-dz, dx), d = target - car.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      car.heading += d * Math.min(1, dt * 8);
    }
    this.#write();
  }
}

// ---------- crowd: little clankers wandering the sidewalks (instanced, clickable) ----------
const LINES = ['beep', 'boop', 'hello!', 'nice city', 'on my way', 'coffee?', 'lgtm', 'brb', '01101000 01101001'];

export class Crowd {
  constructor(scene, pal, walk, count, still) {
    this.walk = walk;
    this.still = still;
    this.geo = new KeyedGeometry([
      { geo: box(0.5, 0.18, 0.42), key: 'rubber', y: 0.09 },
      { geo: box(0.58, 0.44, 0.48), key: 'botHead', y: 0.72 },
      { geo: box(0.1, 0.12, 0.04), key: 'botEye', x: -0.13, y: 0.75, z: 0.25 },
      { geo: box(0.1, 0.12, 0.04), key: 'botEye', x: 0.13, y: 0.75, z: 0.25 },
      { geo: box(0.04, 0.2, 0.04), key: 'metalDark', y: 1.04 },
      { geo: box(0.1, 0.1, 0.1), key: 'botBulb', y: 1.17 },
    ]);
    this.geo.recolor(pal);
    this.mesh = new THREE.InstancedMesh(this.geo.geometry, new THREE.MeshStandardMaterial({ roughness: 0.7, vertexColors: true }), count);
    this.mesh.castShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData.crowd = this;
    scene.add(this.mesh);
    // Clothes: a separate instanced body so each clanker gets its own colour.
    const shirt = box(0.42, 0.32, 0.36);
    shirt.translate(0, 0.34, 0);
    this.clothes = new THREE.InstancedMesh(shirt, new THREE.MeshStandardMaterial({ roughness: 0.85 }), count);
    this.clothes.castShadow = true;
    this.clothes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.clothes.userData.crowd = this;
    const c = new THREE.Color();
    for (let k = 0; k < count; k++) this.clothes.setColorAt(k, c.set(CLOTHES[(k * 5 + 2) % CLOTHES.length]));
    scene.add(this.clothes);

    const cells = [];
    for (let i = 0; i < walk.length; i++) if (walk[i]) cells.push(i);
    this.cells = cells;
    this.people = [];
    for (let k = 0; k < count; k++) {
      const c = cells[Math.floor(Math.random() * cells.length)];
      const x = (c % W) + X0, z = Math.floor(c / W) + X0;
      this.people.push({ x, z, path: null, seg: 0, d: 0, speed: 1 + Math.random() * 0.7, heading: Math.random() * 6, hop: -1, wait: Math.random() * 3, seed: Math.random() * 10 });
    }
    this.#write(0);
  }

  #m = new THREE.Matrix4();
  #q = new THREE.Quaternion();
  #p = new THREE.Vector3();
  #s = new THREE.Vector3(1, 1, 1);
  #up = new THREE.Vector3(0, 1, 0);

  #newPath(p) {
    for (let tries = 0; tries < 4; tries++) {
      const tx = Math.round(p.x + (Math.random() - 0.5) * 44), tz = Math.round(p.z + (Math.random() - 0.5) * 44);
      if (!inside(tx, tz) || !this.walk[idx(tx, tz)]) continue;
      const cells = bfs(this.walk, [Math.round(p.x), Math.round(p.z)], [tx, tz], 7000);
      if (cells && cells.length > 2) {
        p.path = corners(cells);
        p.seg = 0;
        p.d = 0;
        return;
      }
    }
    p.wait = 1;
  }

  update(dt, t) {
    for (const p of this.people) {
      if (!this.still) {
        if (p.wait > 0) p.wait -= dt;
        else if (!p.path) this.#newPath(p);
        else {
          const a = p.path[p.seg], b = p.path[p.seg + 1];
          const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          p.d += p.speed * dt;
          if (p.d >= len) {
            p.seg++;
            p.d = 0;
            if (p.seg >= p.path.length - 1) {
              p.path = null;
              p.wait = 0.5 + Math.random() * 3;
            }
          }
          const k = Math.min(1, p.d / len);
          p.x = a.x + (b.x - a.x) * k;
          p.z = a.z + (b.z - a.z) * k;
          let target = Math.atan2(b.x - a.x, b.z - a.z), d = target - p.heading;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          p.heading += d * Math.min(1, dt * 10);
        }
      }
      if (p.hop >= 0) {
        p.hop += dt;
        if (p.hop > 0.6) p.hop = -1;
      }
    }
    this.#write(t);
    if (this.bubble) {
      const p = this.people[this.bubbleFor];
      this.bubble.position.set(p.x, 1.8, p.z);
    }
  }

  #write(t) {
    this.people.forEach((p, i) => {
      const moving = p.path && !this.still;
      const bob = moving ? Math.abs(Math.sin((t + p.seed) * 10)) * 0.05 : 0;
      const hop = p.hop >= 0 ? Math.sin((Math.PI * p.hop) / 0.6) * 0.9 : 0;
      this.#q.setFromAxisAngle(this.#up, p.heading + (p.hop >= 0 ? (p.hop / 0.6) * Math.PI * 2 : 0));
      this.#p.set(p.x, 0.2 + bob + hop, p.z);
      this.#m.compose(this.#p, this.#q, this.#s);
      this.mesh.setMatrixAt(i, this.#m);
      this.clothes.setMatrixAt(i, this.#m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.clothes.instanceMatrix.needsUpdate = true;
  }

  position(i) { return this.people[i]; }

  poke(i, scene) {
    const p = this.people[i];
    if (p.hop >= 0) return;
    p.hop = 0;
    if (!this.bubble) {
      const el = document.createElement('span');
      el.className = 'bubble';
      this.bubbleEl = el;
      this.bubble = new CSS2DObject(el);
      scene.add(this.bubble);
    }
    this.bubbleEl.textContent = LINES[Math.floor(Math.random() * LINES.length)];
    this.bubbleEl.style.animation = 'none';
    void this.bubbleEl.offsetWidth;
    this.bubbleEl.style.animation = '';
    this.bubble.visible = true;
    this.bubbleFor = i;
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => { this.bubble.visible = false; }, 1600);
  }

  recolor(pal) { this.geo.recolor(pal); }
}
