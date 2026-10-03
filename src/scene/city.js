import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { palette, level } from './palette.js';
import { markGrid } from './glyphs.js';
import { Robot, robotMaterials } from './robot.js';
import { P, W, X0, CLS, STATION_BLOCKS, baseClass, bfs, corners } from './city/layout.js';
import { Ground } from './city/ground.js';
import { VoxelBatch, resolve } from './city/voxels.js';
import { furnish, LOT } from './city/furnish.js';
import { Trees, Landscape } from './city/scenery.js';
import { Traffic, Crowd } from './city/life.js';
import { Sky, Effects } from './city/sky.js';
import { signMesh, wordmarkCells } from './city/signs.js';
import { building, cafe, Parts, FH } from './city/buildings.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const PAN_LIMIT = 70;
const SUN = new THREE.Vector3(14, 60, 40);

// Clanker City: a small city with a street grid, ringed by grass, mountains and a lake.
// Every project has a building of its own (size from its lifetime commits) with its logo on
// the roof and the facade, and its real commit graph as contribution-graph cells in the plaza.
export class City {
  constructor({ container, data, theme, reducedMotion, onSelect, onDeliver }) {
    this.container = container;
    this.data = data;
    this.still = reducedMotion;
    this.onSelect = onSelect;
    this.onDeliver = onDeliver;
    this.pal = palette(theme);
    this.stations = [];
    this.robots = [];
    this.flights = [];
    this.bursts = [];
    this.timer = new THREE.Timer();
    this.selected = null;
    this.hovered = null;
    this.grown = reducedMotion;
    this.revealT = reducedMotion ? 99 : -1;
    this.camAnim = null;
    this.viewShift = { x: 0, y: 0, tx: 0, ty: 0 };
    this.home = { target: new THREE.Vector3(-8, 0, -8), zoom: 0.8 };

    this.#setupRenderer();
    this.#setupScene();
    this.#buildWorld();
    this.#bindPointer();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.renderer.setAnimationLoop(() => this.#tick());
  }

  // ---------- setup ----------
  #setupRenderer() {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    this.coarse = matchMedia('(pointer: coarse)').matches;
    r.setPixelRatio(Math.min(devicePixelRatio, this.coarse ? 1.5 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.domElement.setAttribute('aria-hidden', 'true');
    this.container.appendChild(r.domElement);
    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    this.container.appendChild(this.labels.domElement);
  }

  #setupScene() {
    this.scene = new THREE.Scene();
    const cam = (this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 800));
    this.camOffset = new THREE.Vector3(1, 1.2, 1).normalize().multiplyScalar(260);
    cam.position.copy(this.camOffset);
    cam.zoom = this.still ? this.home.zoom : 3.4;

    const c = (this.controls = new MapControls(cam, this.renderer.domElement));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minZoom = 0.38;
    c.maxZoom = 4;
    c.minPolarAngle = 0.5;
    c.maxPolarAngle = 1.05;
    c.zoomToCursor = true;
    c.target.set(0, 0, 0);
    c.update();
    c.addEventListener('start', () => { this.camAnim = null; });

    const L = this.pal.light;
    this.hemi = new THREE.HemisphereLight(L.hemiSky, L.hemiGround, L.hemi);
    this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, L.sun));
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(this.coarse ? 2048 : 4096);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 60, bottom: -60, near: 1, far: 220 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
  }

  // ---------- world ----------
  #buildWorld() {
    const d = this.data;
    this.todayIndex = Math.round((new Date(`${d.generated}T00:00:00`) - new Date(`${d.start}T00:00:00`)) / 86400000);
    this.ground = new Ground(this.scene, this.pal);
    this.city = new THREE.Group();
    this.scene.add(this.city);

    this.trees = new Trees();
    this.stationChimneys = [];
    this.#buildHQ();
    const entries = [...d.projects.map((p) => ({ ...p, kind: 'project' })), { ...d.lab, id: 'lab', status: 'active', glyph: 'flask', kind: 'lab' }];
    const maxTotal = Math.max(...entries.map((e) => e.total || 0));
    entries.forEach((e, n) => this.#buildStation(e, STATION_BLOCKS[n], maxTotal));
    if (d.cafe) this.#buildCafe(d.cafe);

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.solid = new VoxelBatch(boxGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }));
    this.glow = new VoxelBatch(boxGeo, new THREE.MeshBasicMaterial());
    const anchors = furnish(this.ground, this.solid, this.glow, this.trees, STATION_BLOCKS.slice(0, entries.length));
    anchors.chimneys.push(...this.stationChimneys);
    this.landscape = new Landscape(this.scene, this.pal, this.trees, this.still);
    const solidMesh = this.solid.build(this.pal);
    solidMesh.castShadow = solidMesh.receiveShadow = true;
    this.city.add(solidMesh, this.glow.build(this.pal));
    this.ground.build();
    this.trees.build(this.scene, this.pal);
    this.#paintWordmark();

    // Walkable = sidewalks + crosswalks.
    this.walk = new Uint8Array(W * W);
    for (let i = 0; i < W * W; i++) {
      const c = baseClass((i % W) + X0, Math.floor(i / W) + X0);
      this.walk[i] = c === CLS.sidewalk || c === CLS.crosswalk ? 1 : 0;
    }

    this.robotMats = robotMaterials(this.pal);
    this.#buildRobots();
    this.traffic = new Traffic(this.city, this.pal, anchors.parking, 40, this.still);
    this.crowd = new Crowd(this.city, this.pal, this.walk, 18, this.still);
    this.effects = new Effects(this.city, this.pal, anchors.chimneys, anchors.fountains, this.still);
    this.sky = new Sky(this.scene, this.pal, anchors.rooftops, this.still);
    this.burstGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    if (!this.still) {
      this.city.scale.y = 0.001;
      this.city.visible = false;
      this.ground.reveal(0);
      this.#skyVisible(false);
    }
  }

  #skyVisible(v) {
    this.sky.blimp.visible = v;
    this.sky.balloons.forEach((b) => { b.g.visible = v; });
    this.sky.drones.forEach((d) => { d.g.visible = v; });
    this.sky.wingL.visible = this.sky.wingR.visible = v;
  }

  // An office: glass box, white floor slabs, warm lit windows at night. Returns the roof height.
  #office(batch, glowBatch, w, d, floors, lit, rnd) {
    batch.add(0, LOT, 0, w - 0.4, floors * FH, d - 0.4, 'glass');
    for (let f = 0; f <= floors; f++) batch.add(0, LOT + f * FH - 0.08, 0, w, 0.16, d, 'concrete');
    for (let f = 0; f < floors; f++) {
      const y = LOT + f * FH + 0.16;
      for (let k = 0; k < w - 1; k++) {
        const x = -(w - 2) / 2 + k;
        if (rnd() < lit) glowBatch.add(x, y, (d - 0.4) / 2 + 0.01, 0.9, 0.56, 0.02, 'windowOn');
        if (rnd() < lit) glowBatch.add(x, y, -(d - 0.4) / 2 - 0.01, 0.9, 0.56, 0.02, 'windowOn');
      }
      for (let k = 0; k < d - 1; k++) {
        const z = -(d - 2) / 2 + k;
        if (rnd() < lit) glowBatch.add((w - 0.4) / 2 + 0.01, y, z, 0.02, 0.56, 0.9, 'windowOn');
        if (rnd() < lit) glowBatch.add(-(w - 0.4) / 2 - 0.01, y, z, 0.02, 0.56, 0.9, 'windowOn');
      }
    }
    batch.add(0, LOT, d / 2 + 0.35, 2.6, 0.1, 0.8, 'concrete');
    batch.add(0, LOT + 0.9, d / 2 + 0.35, 2.8, 0.1, 0.9, 'concreteDark');
    return LOT + floors * FH + 0.08;
  }

  #frame(group, w, d, z0 = 0) {
    this.frameMat ||= new THREE.MeshBasicMaterial({ color: this.pal.accent });
    const frame = new THREE.Group();
    const bar = (bw, bd, x, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.06, bd), this.frameMat);
      b.position.set(x, LOT + 0.04, z + z0);
      frame.add(b);
    };
    const hw = w / 2 + 0.5, hd = d / 2 + 0.5;
    bar(2 * hw + 0.14, 0.14, 0, -hd); bar(2 * hw + 0.14, 0.14, 0, hd); bar(0.14, 2 * hd, -hw, 0); bar(0.14, 2 * hd, hw, 0);
    frame.visible = false;
    group.add(frame);
    return frame;
  }

  #batches() {
    const box = new THREE.BoxGeometry(1, 1, 1);
    return [new VoxelBatch(box, new THREE.MeshStandardMaterial({ roughness: 0.8 })), new VoxelBatch(box, new THREE.MeshBasicMaterial())];
  }

  #buildHQ() {
    this.ground.setSurface(0, 0, 'paving');
    const hq = { ...this.data.hq, id: 'hq', kind: 'hq', status: 'active', cx: 0, cz: 0, bxC: -0.5, bzC: -4.25, robots: [] };
    const group = (hq.group = new THREE.Group());
    group.position.set(hq.bxC, 0, hq.bzC);
    this.city.add(group);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    [hq.solid, hq.glowB] = this.#batches();
    const roof = this.#office(hq.solid, hq.glowB, 13.6, 5.5, 6, 0.6, rnd);
    hq.solid.add(0, roof, 0, 13.4, 0.2, 5.3, 'roof');
    const sm = hq.solid.build(this.pal);
    sm.castShadow = sm.receiveShadow = true;
    group.add(sm, hq.glowB.build(this.pal));
    hq.roofTop = roof;

    // The block wordmark as 3D letters on the roof, like the giant letters in the Silicon Valley titles.
    const { cells, width } = wordmarkCells();
    const s = 0.32;
    const mesh = new THREE.InstancedMesh(new RoundedBoxGeometry(s * 0.92, s * 0.92, s * 0.9, 2, 0.04), new THREE.MeshStandardMaterial({ roughness: 0.6 }), cells.length);
    const m = new THREE.Matrix4();
    cells.forEach((cell, i) => {
      m.makeTranslation(-((width - 1) * s) / 2 + cell.c * s, roof + 0.25 + (4 - cell.r) * s + s / 2, 0);
      mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = true;
    const sign = new THREE.Group();
    sign.rotation.y = Math.PI / 4; // face the isometric camera, like a rooftop sign
    sign.add(mesh);
    const board = new THREE.Mesh(new THREE.BoxGeometry(width * s + 0.6, 5 * s + 0.5, 0.12), new THREE.MeshStandardMaterial({ roughness: 0.7 }));
    board.position.set(0, roof + 0.25 + 2.5 * s, -s * 0.6);
    board.castShadow = true;
    sign.add(board);
    for (const x of [-width * s * 0.35, 0, width * s * 0.35]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), board.material);
      leg.position.set(x, roof + 0.25, -s * 0.6);
      sign.add(leg);
    }
    group.add(sign);
    hq.board = board;
    hq.word = { mesh, cells };

    // The mark as a contribution-graph mosaic in the plaza.
    const mark = markGrid();
    for (let r = 0; r < 11; r++) for (let c = 0; c < 11; c++) {
      const l = mark[r][c];
      this.ground.addCell(-0.5 + (c - 5) * 0.6, 0.4 + r * 0.56, l, 0.04 + l * 0.12, 0.54, hq);
    }
    hq.frame = this.#frame(group, 13.6, 5.5);
    group.traverse((o) => { o.userData.station = hq; });
    this.#label(hq, 0, roof + 3, 0);
    this.hq = hq;
    this.stations.push(hq);
  }

  #buildStation(e, [bx, bz], maxTotal) {
    const cx = bx * P, cz = bz * P;
    // Size from lifetime commits, on a log scale: small side projects are low and narrow,
    // the biggest project gets the widest, tallest building.
    const t = Math.log10((e.total || 0) + 1) / Math.log10(maxTotal + 1);
    const w = Math.round(7 + t * 5), d = t > 0.6 ? 5 : 4, floors = Math.max(2, Math.round(2 + t * 9));
    const st = { ...e, cx, cz, bxC: cx - 0.5, bzC: cz - 4.75, w, d, floors, side: bx < 0 ? 1 : bx > 0 ? -1 : 1, robots: [], pulse: -1 };
    this.ground.setSurface(bx, bz, 'paving');
    const group = (st.group = new THREE.Group());
    group.position.set(st.bxC, 0, st.bzC);
    this.city.add(group);

    // Plaza: the project's real last-12-weeks commit graph. Weeks left to right, Monday at the back.
    for (let i = 0; i < this.data.weeks * 7; i++) {
      const x = cx - 6 + Math.floor(i / 7), z = cz - 1 + (i % 7);
      if (i > this.todayIndex) this.ground.addCell(x, z, 0, 0.04, 0.9, st);
      else {
        const l = level(e.counts[i]);
        this.ground.addCell(x, z, l, 0.06 + l * 0.22, 0.9, st);
      }
    }

    let seed = st.id.length * 97 + 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    [st.solid, st.glowB] = this.#batches();
    st.parts = new Parts(group);
    st.anim = [];
    const paused = st.status !== 'active';
    const z0 = -2.25 + d / 2; // building centre: the back wall stays on the same line for every size
    const res = building(st.id, {
      solid: st.solid, glow: st.glowB, parts: st.parts, trees: this.trees, rnd, w, d, floors, z0, paused,
      lit: paused ? 0.03 : 0.55, still: this.still, anim: st.anim, chimneys: paused ? [] : this.stationChimneys, wx: st.bxC, wz: st.bzC,
    });

    // Logo: a billboard on the roof (turned to the camera) and a sign on the side facade.
    const bb = res.billboard;
    const front = signMesh(st.id, st.name, st.glyph, paused, 1.5 + t * 0.9, bb.maxW);
    const fw = front.geometry.parameters.width, fhh = front.geometry.parameters.height;
    front.position.set(bb.x, bb.y + 0.6 + fhh / 2, bb.z);
    front.rotation.y = Math.PI / 8;
    for (const lx of [-fw * 0.3, fw * 0.3]) st.solid.add(bb.x + lx * Math.cos(Math.PI / 8), bb.y, bb.z - lx * Math.sin(Math.PI / 8), 0.12, 0.6, 0.12, 'concreteDark');
    const sd = res.side;
    const side = signMesh(st.id, st.name, st.glyph, paused, 1.0 + t * 0.4, sd.maxW);
    side.position.set(sd.x, sd.y, sd.z);
    side.rotation.y = Math.PI / 2;
    group.add(front, side);
    st.signs = [front, side];
    const sm = st.solid.build(this.pal);
    sm.castShadow = sm.receiveShadow = true;
    group.add(sm, st.glowB.build(this.pal));
    st.parts.recolor(this.pal);
    st.roofTop = res.roof;

    st.frame = this.#frame(group, w, d, z0);
    group.traverse((o) => { o.userData.station = st; });
    this.#label(st, 0, res.top, 0);
    this.stations.push(st);
  }

  // The coffee place in the HQ plaza, next to the mark mosaic. Clicking it opens the panel
  // with the Ko-fi link.
  #buildCafe(c) {
    const x = 4.9, z = 1.6;
    const st = { ...c, id: 'cafe', kind: 'cafe', status: 'active', bxC: x, bzC: z, robots: [], pulse: -1, focus: new THREE.Vector3(x, 1, z + 1.5) };
    const group = (st.group = new THREE.Group());
    group.position.set(x, 0, z);
    this.city.add(group);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    [st.solid, st.glowB] = this.#batches();
    st.parts = new Parts(group);
    const res = cafe({ solid: st.solid, glow: st.glowB, parts: st.parts, rnd });
    const sign = signMesh('cafe', st.name, 'cup', false, 0.8, 4.2);
    sign.position.set(0, res.roof + 1.5, -0.6);
    sign.rotation.y = Math.PI / 8;
    st.solid.add(-0.9, res.roof, -0.6, 0.08, 1.1, 0.08, 'metalDark');
    st.solid.add(0.9, res.roof, -0.6, 0.08, 1.1, 0.08, 'metalDark');
    group.add(sign);
    st.signs = [sign];
    const sm = st.solid.build(this.pal);
    sm.castShadow = sm.receiveShadow = true;
    group.add(sm, st.glowB.build(this.pal));
    st.parts.recolor(this.pal);
    st.roofTop = res.roof;
    st.frame = this.#frame(group, 3, 6, 1.2);
    group.traverse((o) => { o.userData.station = st; });
    this.#label(st, 0, res.top, 0);
    this.stations.push(st);
  }

  // Station labels are buttons for keyboard and screen-reader users; visually they only show on focus.
  #label(st, x, y, z) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'station-label';
    el.dataset.status = st.status;
    el.setAttribute('aria-pressed', 'false');
    el.innerHTML = `<span class="dot" aria-hidden="true"></span><span></span>`;
    el.lastChild.textContent = st.name;
    el.style.pointerEvents = 'auto';
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.select(st.id);
    });
    el.addEventListener('focus', () => this.#hover(st));
    el.addEventListener('blur', () => this.#hover(null));
    const obj = new CSS2DObject(el);
    obj.position.set(x, y, z);
    st.group.add(obj);
    st.labelEl = el;
  }

  // ---------- robots that carry commits ----------
  #buildRobots() {
    const ring = [];
    for (let v = -8; v <= 7; v++) ring.push([v, -8], [v, 7], [-8, v], [7, v]);
    for (const st of this.stations) {
      if (st.kind === 'hq' || st.kind === 'cafe') continue;
      const dropX = st.bxC + st.side * Math.min(st.w / 2 + 0.7, 6.6), dropZ = st.bzC;
      if (st.status !== 'active') {
        const r = new Robot(this.robotMats, { mode: 'sleep', station: st });
        r.park(st.bxC + st.side * 3, st.cz - 1.9, st.side > 0 ? 0.5 : -0.5);
        this.#addRobot(r, st);
        continue;
      }
      const from = Math.max(0, this.todayIndex - 27);
      const recent = st.counts.slice(from, this.todayIndex + 1).reduce((a, b) => a + b, 0);
      const count = Math.min(3, 1 + Math.floor(recent / 15));
      const door = [st.side > 0 ? st.cx + 7 : st.cx - 8, st.cz - 5];
      const start = ring.reduce((best, c) => (Math.abs(c[0] - door[0]) + Math.abs(c[1] - door[1]) < Math.abs(best[0] - door[0]) + Math.abs(best[1] - door[1]) ? c : best));
      const cells = bfs(this.walk, start, door);
      const base = cells ? corners(cells) : [{ x: start[0], z: start[1] }, { x: door[0], z: door[1] }];
      base.push({ x: door[0], z: dropZ }, { x: dropX, z: dropZ });
      for (let k = 0; k < count; k++) {
        const j = (k - (count - 1) / 2) * 0.28;
        const r = new Robot(this.robotMats, { station: st, onDrop: (bot) => this.#deliver(bot) });
        if (this.still) r.park(dropX + st.side * 0.4 * k, dropZ + j * 3, st.side > 0 ? -Math.PI / 2 : Math.PI / 2);
        else r.setPath(base.map((p) => ({ x: p.x + j, z: p.z + j })), k / count);
        this.#addRobot(r, st);
      }
    }
    for (let k = 0; k < 2; k++) {
      const r = new Robot(this.robotMats, { mode: 'patrol', station: this.hq });
      const loop = [{ x: -8, z: -8 }, { x: 7, z: -8 }, { x: 7, z: 7 }, { x: -8, z: 7 }, { x: -8, z: -8 }];
      if (k) loop.reverse();
      if (this.still) r.park(k ? 7 : -8, 0, 0);
      else r.setPath(loop, k * 0.5);
      r.cargo.visible = false;
      this.#addRobot(r, this.hq);
    }
  }

  #addRobot(r, st) {
    this.city.add(r.group);
    this.robots.push(r);
    st.robots.push(r);
  }

  #deliver(bot) {
    const st = bot.station;
    const from = bot.group.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    const to = new THREE.Vector3(st.bxC, st.roofTop + 0.4, st.bzC);
    const cube = new THREE.Mesh(bot.cargo.geometry, this.robotMats.cargo);
    cube.castShadow = true;
    cube.position.copy(from);
    this.scene.add(cube);
    this.flights.push({ cube, from, to, t: 0, st });
  }

  #burst(x, z) {
    for (let k = 0; k < 10; k++) {
      const m = new THREE.Mesh(this.burstGeo, this.robotMats.cargo);
      m.position.set(x, 0.4, z);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 2;
      this.bursts.push({ m, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 4 + Math.random() * 3, t: 0 });
    }
  }

  // ---------- interaction ----------
  #bindPointer() {
    const el = this.renderer.domElement;
    this.ray = new THREE.Raycaster();
    this.ptr = new THREE.Vector2();
    let down = null;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      this.container.classList.add('is-grabbing');
    });
    el.addEventListener('pointerup', (e) => {
      this.container.classList.remove('is-grabbing');
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || e.button !== 0) return;
      this.#click(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons || this.moveRaf) return;
      this.moveRaf = requestAnimationFrame(() => {
        this.moveRaf = 0;
        const hit = this.#pick(e);
        this.#hover(hit?.station || null);
        this.container.classList.toggle('is-pointer', !!(hit && (hit.station || hit.robot || hit.person !== undefined)));
      });
    });
    el.addEventListener('pointerleave', () => this.#hover(null));
  }

  #pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const targets = [this.city, this.ground.cellMesh, this.ground.grass, ...this.scene.children.filter((o) => o.userData.ground)];
    for (const h of this.ray.intersectObjects(targets, true)) {
      const u = h.object.userData;
      if (u.robot) return { robot: u.robot };
      if (u.crowd) return { person: h.instanceId };
      if (u.station) return { station: u.station };
      if (u.cells) {
        const owner = this.ground.ownerOf(h.instanceId);
        if (owner) return { station: owner };
      }
      return { point: h.point };
    }
    return null;
  }

  #click(e) {
    const hit = this.#pick(e);
    if (!hit) return;
    if (hit.robot) hit.robot.poke();
    else if (hit.person !== undefined) this.crowd.poke(hit.person, this.scene);
    else if (hit.station) this.select(hit.station.id);
    else if (hit.point && !this.still) this.#burst(hit.point.x, hit.point.z);
  }

  #hover(st) {
    if (this.hovered === st) return;
    this.hovered = st;
    for (const s of this.stations) if (s.frame) s.frame.visible = s === st || s === this.selected;
  }

  select(id) {
    const st = this.stations.find((s) => s.id === id) || null;
    this.selected?.labelEl.setAttribute('aria-pressed', 'false');
    this.selected = st;
    for (const s of this.stations) if (s.frame) s.frame.visible = s === st || s === this.hovered;
    if (st) {
      st.labelEl.setAttribute('aria-pressed', 'true');
      const target = st.focus || (st.kind === 'hq' ? new THREE.Vector3(-0.5, 2, -1) : new THREE.Vector3(st.bxC, st.floors * 0.4, st.cz - 1.5));
      this.#flyTo(target, st.kind === 'cafe' ? 2.6 : st.kind === 'hq' ? 1.8 : 1.9);
      st.robots.forEach((r, i) => setTimeout(() => r.poke(), 300 + i * 160));
    }
    this.onSelect?.(st);
  }

  deselect() {
    if (!this.selected) return;
    this.selected.labelEl.setAttribute('aria-pressed', 'false');
    this.selected = null;
    for (const s of this.stations) if (s.frame) s.frame.visible = s === this.hovered;
    this.#flyTo(this.home.target, this.home.zoom);
    this.onSelect?.(null);
  }

  setViewShift(x, y) {
    this.viewShift.tx = x;
    this.viewShift.ty = y;
  }

  #flyTo(target, zoom, dur = 1.1) {
    this.camAnim = {
      t: 0,
      dur: this.still ? 0.001 : dur,
      fromT: this.controls.target.clone(),
      toT: target.clone(),
      fromZ: this.camera.zoom,
      toZ: zoom,
      offset: this.camera.position.clone().sub(this.controls.target),
    };
  }

  startReveal() {
    if (this.still) return this.#flyTo(this.home.target, this.home.zoom);
    this.revealT = 0;
    this.#flyTo(this.home.target, this.home.zoom, 2.8);
  }

  #paintWordmark() {
    const c = new THREE.Color();
    this.hq.word.cells.forEach((cell, i) => this.hq.word.mesh.setColorAt(i, c.copy(resolve(this.pal, cell.part))));
    this.hq.word.mesh.instanceColor.needsUpdate = true;
    this.hq.board.material.color.copy(this.pal.concrete);
  }

  setTheme(theme) {
    this.pal = palette(theme);
    const L = this.pal.light;
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    this.hemi.intensity = L.hemi;
    this.sun.intensity = L.sun;
    this.frameMat.color.copy(this.pal.accent);
    this.robotMats.apply(this.pal);
    this.ground.recolor(this.pal);
    this.solid.recolor(this.pal);
    this.glow.recolor(this.pal);
    this.trees.recolor(this.pal);
    this.landscape.recolor(this.pal);
    for (const st of this.stations) {
      st.solid.recolor(this.pal);
      st.glowB.recolor(this.pal);
      st.parts?.recolor(this.pal);
    }
    this.#paintWordmark();
    this.traffic.recolor(this.pal);
    this.crowd.recolor(this.pal);
    this.sky.recolor(this.pal);
    this.effects.recolor(this.pal);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.size = { w, h };
    const aspect = w / h;
    const half = Math.max(24, 20 / aspect);
    this.half = half;
    this.home.zoom = aspect < 0.8 ? 1.15 : 0.8;
    Object.assign(this.camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
  }

  // ---------- loop ----------
  #tick() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();

    if (this.camAnim) {
      const a = this.camAnim;
      a.t += dt / a.dur;
      const k = ease(Math.min(1, a.t));
      this.controls.target.lerpVectors(a.fromT, a.toT, k);
      this.camera.position.copy(this.controls.target).add(a.offset);
      this.camera.zoom = a.fromZ + (a.toZ - a.fromZ) * k;
      this.camera.updateProjectionMatrix();
      if (a.t >= 1) this.camAnim = null;
    }
    const tg = this.controls.target;
    const cx = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, tg.x)), cz = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, tg.z));
    if (cx !== tg.x || cz !== tg.z) {
      this.camera.position.x += cx - tg.x;
      this.camera.position.z += cz - tg.z;
      tg.x = cx;
      tg.z = cz;
    }
    this.controls.update();
    this.sun.target.position.set(tg.x, 0, tg.z);
    this.sun.position.set(tg.x + SUN.x, SUN.y, tg.z + SUN.z);

    const vs = this.viewShift;
    const kk = Math.min(1, dt * 6);
    vs.x += (vs.tx - vs.x) * kk;
    vs.y += (vs.ty - vs.y) * kk;
    if (this.size) {
      if (Math.abs(vs.x) > 0.5 || Math.abs(vs.y) > 0.5) this.camera.setViewOffset(this.size.w, this.size.h, vs.x, vs.y, this.size.w, this.size.h);
      else this.camera.clearViewOffset();
    }

    // Reveal: plaza cells rise, then the city pops up, then the sky fills.
    if (!this.grown && this.revealT >= 0) {
      this.revealT += dt;
      const done = this.ground.reveal(this.revealT);
      const k = Math.min(1, Math.max(0, (this.revealT - 0.3) / 1.3));
      this.city.visible = k > 0;
      this.city.scale.y = Math.max(0.001, backOut(k));
      if (this.revealT > 1.4) this.#skyVisible(true);
      if (done && k >= 1) {
        this.grown = true;
        this.city.scale.y = 1;
      }
    }

    for (const st of this.stations) st.anim?.forEach((f) => f(dt, t));
    for (const r of this.robots) r.update(dt, t);
    this.traffic.update(dt);
    this.crowd.update(dt, t);
    this.sky.update(dt, t);
    this.effects.update(dt, t);
    this.landscape.update(dt, t);

    for (let k = this.bursts.length - 1; k >= 0; k--) {
      const b = this.bursts[k];
      b.t += dt;
      b.vy -= 14 * dt;
      b.m.position.x += b.vx * dt;
      b.m.position.z += b.vz * dt;
      b.m.position.y = Math.max(0.3, b.m.position.y + b.vy * dt);
      b.m.rotation.x += dt * 6;
      b.m.scale.setScalar(Math.max(0.01, 1 - b.t / 1.2));
      if (b.t > 1.2) {
        this.scene.remove(b.m);
        this.bursts.splice(k, 1);
      }
    }

    for (let k = this.flights.length - 1; k >= 0; k--) {
      const f = this.flights[k];
      f.t += dt / 0.8;
      const tt = Math.min(1, f.t);
      f.cube.position.lerpVectors(f.from, f.to, tt);
      f.cube.position.y += Math.sin(Math.PI * tt) * 3;
      f.cube.scale.setScalar(1 - tt * 0.6);
      if (f.t >= 1) {
        this.scene.remove(f.cube);
        this.flights.splice(k, 1);
        f.st.pulse = 0;
        this.onDeliver?.(f.st);
      }
    }
    // A delivered commit makes the logo signs bounce.
    for (const st of this.stations) {
      if (!st.signs || st.pulse < 0) continue;
      st.pulse += dt;
      const s = 1 + Math.sin(Math.min(1, st.pulse / 0.4) * Math.PI) * 0.08;
      st.signs.forEach((m) => m.scale.setScalar(s));
      if (st.pulse > 0.4) st.pulse = -1;
    }

    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.renderer.dispose();
  }
}
