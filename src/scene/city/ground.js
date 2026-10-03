import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { P, BMIN, BMAX, X0, X1 } from './layout.js';
import { VoxelBatch, resolve } from './voxels.js';

// Ground: endless grass, the city's asphalt base, block slabs (sidewalk ring + lot surface)
// and the few places that are still contribution-graph cells (plazas, the HQ mosaic).
export class Ground {
  constructor(scene, pal) {
    this.scene = scene;
    this.pal = pal;
    this.surface = new Map();
    this.cells = [];
  }

  setSurface(bx, bz, key) { this.surface.set(`${bx},${bz}`, key); }

  // A contribution-graph cell: level 0-4, height, size, owner (station or null).
  addCell(x, z, lvl, h, size = 1, owner = null) {
    this.cells.push({ x, z, lvl, h, size, owner, delay: Math.hypot(x, z) * 0.02 });
  }

  build() {
    // Grass to the horizon, with a speckle texture so it doesn't read as a flat fill.
    const plane = new THREE.PlaneGeometry(2000, 2000);
    plane.rotateX(-Math.PI / 2);
    const uv = plane.attributes.uv, pos = plane.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 9, pos.getZ(i) / 9);
    this.grass = new THREE.Mesh(plane, new THREE.MeshStandardMaterial({ roughness: 1 }));
    this.grass.receiveShadow = true;
    this.grass.userData.ground = true;
    this.scene.add(this.grass);

    const box = new THREE.BoxGeometry(1, 1, 1);
    this.slabs = new VoxelBatch(box, new THREE.MeshStandardMaterial({ roughness: 0.95 }));
    // Asphalt under the whole city: whatever is not a block is street.
    this.slabs.add((X0 + X1) / 2, 0, (X0 + X1) / 2, X1 - X0 + 1, 0.06, X1 - X0 + 1, 'asphalt');
    for (let bz = BMIN; bz <= BMAX; bz++) {
      for (let bx = BMIN; bx <= BMAX; bx++) {
        const cx = bx * P - 0.5, cz = bz * P - 0.5;
        this.slabs.add(cx, 0, cz, 15.9, 0.2, 15.9, 'sidewalk');
        this.slabs.add(cx, 0, cz, 13.9, 0.22, 13.9, this.surface.get(`${bx},${bz}`) || 'paving');
      }
    }
    const slabMesh = this.slabs.build(this.pal);
    slabMesh.receiveShadow = true;
    slabMesh.userData.ground = true;
    this.scene.add(slabMesh);

    const geo = new RoundedBoxGeometry(0.9, 1, 0.9, 2, 0.1);
    geo.translate(0, 0.5, 0);
    this.cellMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), Math.max(1, this.cells.length));
    this.cellMesh.castShadow = this.cellMesh.receiveShadow = true;
    this.cellMesh.userData.cells = this;
    this.scene.add(this.cellMesh);
    this.recolor(this.pal);
    this.reveal(99);
  }

  #grassTexture(pal) {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    ctx.fillStyle = `#${pal.grass.getHexString()}`;
    ctx.fillRect(0, 0, s, s);
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = `#${pal.grassDark.getHexString()}`;
    for (let k = 0; k < 900; k++) ctx.fillRect(r() * s, r() * s, 2 + r() * 3, 2 + r() * 3);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  }

  recolor(pal) {
    this.pal = pal;
    this.grass.material.map?.dispose();
    this.grass.material.map = this.#grassTexture(pal);
    this.grass.material.needsUpdate = true;
    this.slabs.recolor(pal);
    const c = new THREE.Color();
    this.cells.forEach((cell, i) => this.cellMesh.setColorAt(i, c.copy(pal.levels[cell.lvl])));
    if (this.cellMesh.instanceColor) this.cellMesh.instanceColor.needsUpdate = true;
  }

  // Cells rise from the HQ outwards; returns true when all are up.
  reveal(t) {
    const m = new THREE.Matrix4();
    let done = true;
    this.cells.forEach((cell, i) => {
      const k = Math.min(1, Math.max(0, (t - cell.delay) / 0.45));
      if (k < 1) done = false;
      const g = 1 - Math.pow(1 - k, 3);
      m.makeScale(cell.size, Math.max(0.001, cell.h * g), cell.size).setPosition(cell.x, 0.2, cell.z);
      this.cellMesh.setMatrixAt(i, m);
    });
    this.cellMesh.instanceMatrix.needsUpdate = true;
    return done;
  }

  ownerOf(instanceId) { return this.cells[instanceId]?.owner || null; }
}

export { resolve };
