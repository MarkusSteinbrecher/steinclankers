import * as THREE from 'three';
import { resolve } from './voxels.js';
import { rng } from './layout.js';

// Low-poly trees, all instanced: round street/park trees and conifers for the forests.
export class Trees {
  constructor() { this.items = []; }

  add(x, z, y = 0.2, s = 1, conifer = false) {
    const k = this.items.length;
    this.items.push({ x, z, y, s: s * (0.85 + ((k * 37) % 10) / 33), key: `c${(k * 7) % 4}`, conifer });
  }

  build(scene, pal) {
    const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const roundGeo = new THREE.IcosahedronGeometry(0.72, 1);
    const coneGeo = new THREE.ConeGeometry(0.75, 2.2, 7);
    const std = () => new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    const round = this.items.filter((t) => !t.conifer), cones = this.items.filter((t) => t.conifer);
    this.trunks = new THREE.InstancedMesh(trunkGeo, std(), this.items.length);
    this.round = new THREE.InstancedMesh(roundGeo, std(), Math.max(1, round.length));
    this.cones = new THREE.InstancedMesh(coneGeo, std(), Math.max(1, cones.length));
    const m = new THREE.Matrix4();
    this.items.forEach((t, i) => {
      m.makeScale(t.s, t.s * (t.conifer ? 0.5 : 0.9), t.s).setPosition(t.x, t.y, t.z);
      this.trunks.setMatrixAt(i, m);
    });
    round.forEach((t, i) => {
      m.makeScale(t.s, t.s * 1.05, t.s).setPosition(t.x, t.y + t.s * 1.35, t.z);
      this.round.setMatrixAt(i, m);
    });
    cones.forEach((t, i) => {
      m.makeScale(t.s, t.s, t.s).setPosition(t.x, t.y + t.s * 1.5, t.z);
      this.cones.setMatrixAt(i, m);
    });
    this.roundItems = round;
    this.coneItems = cones;
    for (const mesh of [this.trunks, this.round, this.cones]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    this.recolor(pal);
  }

  recolor(pal) {
    this.trunks.material.color.copy(pal.trunk);
    const c = new THREE.Color();
    this.roundItems.forEach((t, i) => this.round.setColorAt(i, c.copy(resolve(pal, t.key))));
    this.coneItems.forEach((t, i) => this.cones.setColorAt(i, c.copy(resolve(pal, t.key)).multiplyScalar(0.85)));
    for (const mesh of [this.round, this.cones]) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

// Beyond the ring road: grass, a mountain range at the back, a lake with a sailboat, forests.
export class Landscape {
  constructor(scene, pal, trees, still) {
    this.still = still;
    this.keyed = [];
    const R = rng(77);
    this.group = new THREE.Group();
    scene.add(this.group);

    // Mountains along the far edge (up-screen is -x/-z).
    for (let k = 0; k < 11; k++) {
      const t = (k - 5) * 19 + (R() - 0.5) * 8;
      const x = -112 + t + (R() - 0.5) * 14, z = -112 - t + (R() - 0.5) * 14;
      const h = 22 + R() * 26, r = 18 + R() * 12;
      this.#mountain(x, z, r, h, R);
    }
    // Lake to the right (+x / -z).
    this.lake = { x: 108, z: -24, rx: 26, rz: 17 };
    const shape = new THREE.Shape();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const wob = 1 + Math.sin(a * 3) * 0.08 + Math.sin(a * 5 + 1) * 0.05;
      const px = Math.cos(a) * this.lake.rx * wob, pz = Math.sin(a) * this.lake.rz * wob;
      if (i === 0) shape.moveTo(px, pz); else shape.lineTo(px, pz);
    }
    const lakeGeo = new THREE.ShapeGeometry(shape, 8);
    lakeGeo.rotateX(-Math.PI / 2);
    const shore = this.#mesh(lakeGeo, 'shore', this.lake.x, 0.02, this.lake.z);
    shore.scale.set(1.1, 1, 1.12);
    this.#mesh(lakeGeo, 'water', this.lake.x, 0.05, this.lake.z);
    // Sailboat
    this.boat = new THREE.Group();
    const hull = new THREE.BoxGeometry(2.2, 0.4, 0.8);
    this.#part(this.boat, hull, 'concrete', 0, 0.2, 0);
    this.#part(this.boat, new THREE.BoxGeometry(0.08, 2.4, 0.08), 'trunk', 0.1, 1.5, 0);
    const sail = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.15, 0.5, 0), new THREE.Vector3(0.15, 2.6, 0), new THREE.Vector3(1.2, 0.5, 0)]);
    sail.computeVertexNormals();
    const sailMesh = this.#part(this.boat, sail, 'sail', 0, 0.1, 0);
    sailMesh.material.side = THREE.DoubleSide;
    this.boat.position.set(this.lake.x, 0.06, this.lake.z);
    this.group.add(this.boat);

    // Forests: around the mountains, the lake, and a few patches on the plain.
    const clear = (x, z) => Math.abs(x) < 70 && Math.abs(z) < 70;
    const inLake = (x, z) => ((x - this.lake.x) / (this.lake.rx * 1.15)) ** 2 + ((z - this.lake.z) / (this.lake.rz * 1.15)) ** 2 < 1;
    const patch = (cx, cz, n, spread, conifer) => {
      for (let k = 0; k < n; k++) {
        const x = cx + (R() - 0.5) * spread, z = cz + (R() - 0.5) * spread;
        if (!clear(x, z) && !inLake(x, z)) trees.add(x, z, 0, 1 + R() * 0.8, conifer);
      }
    };
    for (let k = 0; k < 9; k++) patch(-90 + (k - 4) * 20, -90 - (k - 4) * 20, 26, 22, true);
    for (let a = 0; a < 6; a++) patch(this.lake.x + Math.cos(a) * 34, this.lake.z + Math.sin(a) * 26, 12, 14, a % 2 === 0);
    for (const [x, z] of [[-90, 40], [-80, 95], [40, 95], [95, 70], [20, -95], [-30, 100]]) patch(x, z, 22, 20, R() < 0.5);

    this.recolor(pal);
  }

  #mountain(x, z, r, h, R) {
    const geo = new THREE.ConeGeometry(r, h, 8, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > h / 2 - 0.01 || y < -h / 2 + 0.01) continue;
      pos.setX(i, pos.getX(i) * (0.85 + R() * 0.3));
      pos.setZ(i, pos.getZ(i) * (0.85 + R() * 0.3));
      pos.setY(i, y + (R() - 0.5) * h * 0.06);
    }
    geo.computeVertexNormals();
    geo.translate(0, h / 2, 0);
    const m = this.#mesh(geo, R() < 0.5 ? 'rock' : 'rockDark', x, 0, z);
    m.material.flatShading = true;
    m.castShadow = false;
    // Snow cap: the top quarter of a matching cone
    const cap = new THREE.ConeGeometry(r * 0.3, h * 0.3, 8, 1);
    cap.translate(0, h - h * 0.15 + 0.05, 0);
    const c = this.#mesh(cap, 'snow', x, 0, z);
    c.material.flatShading = true;
  }

  #mesh(geo, key, x, y, z) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.95 }));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.group.add(m);
    this.keyed.push({ m, key });
    return m;
  }

  #part(group, geo, key, x, y, z) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.8 }));
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    this.keyed.push({ m, key });
    return m;
  }

  recolor(pal) {
    for (const { m, key } of this.keyed) m.material.color.copy(resolve(pal, key));
  }

  update(dt, t) {
    const T = this.still ? 2 : t;
    const a = T * 0.05;
    const L = this.lake;
    this.boat.position.set(L.x + Math.cos(a) * L.rx * 0.55, 0.06 + Math.sin(T * 1.3) * 0.04, L.z + Math.sin(a) * L.rz * 0.55);
    this.boat.rotation.y = Math.atan2(-Math.cos(a) * L.rz, -Math.sin(a) * L.rx);
    this.boat.rotation.z = Math.sin(T * 0.9) * 0.05;
  }
}
