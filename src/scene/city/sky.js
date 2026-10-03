import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { resolve } from './voxels.js';

// Things in the air: a Stein&Clankers blimp, hot-air balloons and drone clankers.
export class Sky {
  constructor(scene, pal, rooftops, still) {
    this.scene = scene;
    this.still = still;
    this.keyed = [];
    this.rooftops = rooftops;

    // Blimp with a voxel ampersand on both flanks
    this.blimp = new THREE.Group();
    this.#part(this.blimp, new RoundedBoxGeometry(8, 2.6, 2.6, 4, 1.2), 'concrete', 0, 0, 0);
    this.#part(this.blimp, new RoundedBoxGeometry(8.05, 0.5, 2.65, 2, 0.24), 'l3', 0, -0.2, 0);
    for (const [x, y, z, w, h, d] of [[-3.9, 0.9, 0, 1.2, 1.4, 0.15], [-3.9, -0.9, 0, 1.2, 1.4, 0.15], [-3.9, 0, 0.9, 1.2, 0.15, 1.4], [-3.9, 0, -0.9, 1.2, 0.15, 1.4]]) {
      this.#part(this.blimp, new THREE.BoxGeometry(w, h, d), 'l4', x, y, z);
    }
    this.#part(this.blimp, new THREE.BoxGeometry(2, 0.6, 0.9), 'concreteDark', 0.4, -1.55, 0);
    const AMP = ['01000', '10100', '01000', '10101', '10010', '01101'];
    AMP.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== '1') return;
      for (const side of [1, -1]) this.#part(this.blimp, new THREE.BoxGeometry(0.26, 0.26, 0.05), 'l4', 0.9 + (c - 2) * 0.28, 0.85 - r * 0.28, side * 1.31, true);
    }));
    scene.add(this.blimp);

    // Balloons
    this.balloons = [0, 1].map((k) => {
      const g = new THREE.Group();
      [[k ? 'car1' : 'car0', 0], [k ? 'car3' : 'car2', 0.85], [k ? 'car1' : 'car0', 1.7]].forEach(([key, y], j) => this.#part(g, new RoundedBoxGeometry(2.4 - Math.abs(j - 1) * 0.5, 0.85, 2.4 - Math.abs(j - 1) * 0.5, 2, 0.3), key, 0, y + 1.6, 0));
      this.#part(g, new RoundedBoxGeometry(1.2, 0.5, 1.2, 2, 0.2), k ? 'car1' : 'car0', 0, 4.1, 0);
      this.#part(g, new THREE.BoxGeometry(0.6, 0.45, 0.6), 'trunk', 0, 0, 0);
      for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) this.#part(g, new THREE.BoxGeometry(0.03, 1.2, 0.03), 'trunk', x, 0.85, z);
      scene.add(g);
      return { g, r: 26 + k * 14, a: k * 2.5, y: 15 + k * 3, speed: 0.025 + k * 0.01 };
    });

    // Drones
    this.drones = Array.from({ length: 3 }, (_, k) => {
      const g = new THREE.Group();
      this.#part(g, new THREE.BoxGeometry(0.7, 0.18, 0.7), 'metal', 0, 0, 0);
      this.#part(g, new RoundedBoxGeometry(0.42, 0.34, 0.38, 2, 0.08), 'l2', 0, -0.24, 0);
      this.#part(g, new THREE.BoxGeometry(0.08, 0.1, 0.04), 'l4', -0.09, -0.22, 0.2, true);
      this.#part(g, new THREE.BoxGeometry(0.08, 0.1, 0.04), 'l4', 0.09, -0.22, 0.2, true);
      const rotors = [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([x, z]) => this.#part(g, new THREE.BoxGeometry(0.62, 0.03, 0.08), 'trunk', x, 0.14, z));
      scene.add(g);
      const start = rooftops[(k * 7) % rooftops.length] || { x: 0, y: 8, z: 0 };
      g.position.set(start.x, start.y + 1.2, start.z);
      return { g, rotors, from: g.position.clone(), to: g.position.clone(), t: 1, wait: k * 0.7 };
    });

    // Birds: a few flocks of flapping V shapes, two instanced wing meshes.
    const wing = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.14, 0, 0), new THREE.Vector3(0.14, 0, 0), new THREE.Vector3(-0.04, 0, 0.55)]);
    wing.computeVertexNormals();
    this.birdMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.flocks = [0, 1, 2].map((f) => ({ r: 30 + f * 18, y: 11 + f * 3, a: f * 2.1, speed: 0.07 - f * 0.012, dir: f % 2 ? -1 : 1 }));
    this.birds = [];
    this.flocks.forEach((fl, f) => { for (let k = 0; k < 7; k++) this.birds.push({ f, ox: -Math.ceil(k / 2) * 0.9, oz: (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.8, phase: k * 0.7 }); });
    this.wingL = new THREE.InstancedMesh(wing, this.birdMat, this.birds.length);
    this.wingR = new THREE.InstancedMesh(wing, this.birdMat, this.birds.length);
    scene.add(this.wingL, this.wingR);

    this.recolor(pal);
  }

  #m = new THREE.Matrix4();
  #q = new THREE.Quaternion();
  #e = new THREE.Euler();
  #v = new THREE.Vector3();
  #one = new THREE.Vector3(1, 1, 1);

  #updateBirds(t) {
    this.birds.forEach((b, i) => {
      const fl = this.flocks[b.f];
      const a = fl.a + t * fl.speed * fl.dir;
      const heading = Math.atan2(-Math.cos(a) * fl.dir, -Math.sin(a) * fl.dir); // +x forward along the circle
      const cx = Math.cos(a) * fl.r, cz = Math.sin(a) * fl.r * 0.8;
      const ch = Math.cos(heading), sh = Math.sin(heading);
      const x = cx + b.ox * ch + b.oz * sh, z = cz - b.ox * sh + b.oz * ch;
      const flap = Math.sin(t * 9 + b.phase) * 0.7;
      this.#v.set(x, fl.y + Math.sin(t + b.phase) * 0.3, z);
      this.#q.setFromEuler(this.#e.set(flap, heading, 0, 'YXZ'));
      this.wingL.setMatrixAt(i, this.#m.compose(this.#v, this.#q, this.#one.set(1, 1, 1)));
      this.#q.setFromEuler(this.#e.set(-flap, heading, 0, 'YXZ'));
      this.wingR.setMatrixAt(i, this.#m.compose(this.#v, this.#q, this.#one.set(1, 1, -1)));
    });
    this.wingL.instanceMatrix.needsUpdate = true;
    this.wingR.instanceMatrix.needsUpdate = true;
  }

  #part(group, geo, key, x, y, z, glow = false) {
    const mat = glow ? new THREE.MeshBasicMaterial() : new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = !glow;
    group.add(m);
    this.keyed.push({ m, key });
    return m;
  }

  recolor(pal) {
    for (const { m, key } of this.keyed) m.material.color.copy(resolve(pal, key));
    this.birdMat?.color.copy(pal.bird);
  }

  update(dt, t) {
    const T = this.still ? 0 : t;
    this.#updateBirds(T);
    const a = T * 0.035 + 0.6;
    this.blimp.position.set(Math.cos(a) * 44, 21 + Math.sin(T * 0.4) * 0.4, Math.sin(a) * 30);
    this.blimp.rotation.y = Math.atan2(-30 * Math.cos(a), -44 * Math.sin(a)); // nose (+x) along the tangent
    for (const b of this.balloons) {
      const ang = b.a + T * b.speed;
      b.g.position.set(Math.cos(ang) * b.r, b.y + Math.sin(T * 0.5 + b.a) * 0.8, Math.sin(ang) * b.r * 0.8);
    }
    for (const d of this.drones) {
      d.rotors.forEach((r, i) => { r.rotation.y = T * 40 + i; });
      if (this.still) continue;
      if (d.wait > 0) {
        d.wait -= dt;
        d.g.position.y = d.to.y + Math.sin(t * 3 + d.wait) * 0.05;
        continue;
      }
      if (d.t >= 1) {
        const r = this.rooftops[Math.floor(Math.random() * this.rooftops.length)];
        d.from.copy(d.g.position);
        d.to.set(r.x, r.y + 1.2, r.z);
        d.t = 0;
        d.len = d.from.distanceTo(d.to);
      }
      d.t = Math.min(1, d.t + (dt * 6) / Math.max(d.len, 1));
      const k = d.t < 0.5 ? 2 * d.t * d.t : 1 - Math.pow(-2 * d.t + 2, 2) / 2;
      d.g.position.lerpVectors(d.from, d.to, k);
      d.g.position.y += Math.sin(Math.PI * k) * 6;
      d.g.rotation.y = Math.atan2(d.to.x - d.from.x, d.to.z - d.from.z);
      d.g.rotation.x = Math.sin(Math.PI * k) * 0.25;
      if (d.t >= 1) d.wait = 1.5 + Math.random() * 3;
    }
  }
}

// Chimney smoke and fountain spray: small instanced cubes on short loops.
export class Effects {
  constructor(scene, pal, chimneys, fountains, still) {
    this.still = still;
    this.chimneys = chimneys;
    this.fountains = fountains;
    const geo = new RoundedBoxGeometry(1, 1, 1, 1, 0.15);
    this.smokeMat = new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.85 });
    this.waterMat = new THREE.MeshBasicMaterial();
    this.smoke = new THREE.InstancedMesh(geo, this.smokeMat, Math.max(1, chimneys.length * 8));
    this.water = new THREE.InstancedMesh(geo, this.waterMat, Math.max(1, fountains.length * 10));
    for (const m of [this.smoke, this.water]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    this.recolor(pal);
    this.update(0, 0);
  }

  recolor(pal) {
    this.smokeMat.color.copy(pal.sidewalk);
    this.waterMat.color.copy(pal.lane);
  }

  #m = new THREE.Matrix4();

  update(dt, t) {
    const T = this.still ? 1.3 : t;
    let n = 0;
    this.chimneys.forEach((c, ci) => {
      for (let k = 0; k < 8; k++) {
        const p = (T * 0.22 + k / 8 + ci * 0.37) % 1;
        const s = (0.4 + p * 1.3) * (c.s || 1);
        this.#m.makeScale(s, s, s).setPosition(c.x + (p * 2.5 + Math.sin(p * 6 + k) * 0.3) * (c.s || 1), c.y + p * 5 * (c.s || 1), c.z - p * 1.2 * (c.s || 1));
        this.smoke.setMatrixAt(n++, this.#m);
      }
    });
    this.smoke.instanceMatrix.needsUpdate = true;
    n = 0;
    this.fountains.forEach((f) => {
      for (let k = 0; k < 10; k++) {
        const p = (T * 0.8 + k / 10) % 1;
        const ang = k * 2.4;
        const r = p * 1.1;
        const s = 0.18 * (1 - p * 0.5);
        this.#m.makeScale(s, s, s).setPosition(f.x + Math.cos(ang) * r, f.y + Math.sin(Math.PI * p) * 1.1, f.z + Math.sin(ang) * r);
        this.water.setMatrixAt(n++, this.#m);
      }
    });
    this.water.instanceMatrix.needsUpdate = true;
  }
}
