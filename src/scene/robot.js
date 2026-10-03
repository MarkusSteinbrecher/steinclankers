import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const GEO = {
  base: new RoundedBoxGeometry(0.72, 0.26, 0.62, 2, 0.08),
  body: new RoundedBoxGeometry(0.56, 0.42, 0.48, 2, 0.08),
  head: new RoundedBoxGeometry(0.8, 0.62, 0.66, 2, 0.12),
  eye: new RoundedBoxGeometry(0.14, 0.16, 0.06, 1, 0.03),
  ear: new RoundedBoxGeometry(0.1, 0.2, 0.2, 1, 0.03),
  stalk: new THREE.CylinderGeometry(0.025, 0.025, 0.26, 6),
  bulb: new THREE.SphereGeometry(0.075, 12, 8),
  cargo: new RoundedBoxGeometry(0.42, 0.42, 0.42, 2, 0.07),
  arm: new RoundedBoxGeometry(0.08, 0.08, 0.36, 1, 0.03),
};

const LINES = ['beep', 'boop', 'commit!', 'ship it', 'on it', 'lgtm', 'rebasing…', 'tests green', 'one more fix', 'hi!'];
const SPEED = 2.8;

export class Robot {
  constructor(mats, opts = {}) {
    this.mats = mats;
    this.mode = opts.mode || 'deliver';
    this.path = [];
    this.lengths = [];
    this.total = 0;
    this.dist = 0;
    this.phase = 'out';
    this.timer = 0;
    this.heading = 0;
    this.hopT = -1;
    this.station = opts.station || null;
    this.onDrop = opts.onDrop || (() => {});
    this.speed = SPEED * (0.85 + Math.random() * 0.3);
    this.seed = Math.random() * 100;

    const g = (this.group = new THREE.Group());
    g.scale.setScalar(1.35);
    const add = (geo, mat, x, y, z, parent = g) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    this.rig = new THREE.Group();
    g.add(this.rig);
    add(GEO.base, mats.rubber, 0, 0.13, 0, this.rig);
    add(GEO.body, mats.metal, 0, 0.45, 0, this.rig);
    this.head = new THREE.Group();
    this.head.position.set(0, 0.95, 0);
    this.rig.add(this.head);
    add(GEO.head, mats.head, 0, 0, 0, this.head);
    this.eyes = [add(GEO.eye, mats.eye, -0.17, 0.04, 0.33, this.head), add(GEO.eye, mats.eye, 0.17, 0.04, 0.33, this.head)];
    add(GEO.ear, mats.metalDark, -0.44, -0.02, 0, this.head);
    add(GEO.ear, mats.metalDark, 0.44, -0.02, 0, this.head);
    add(GEO.stalk, mats.metalDark, 0, 0.43, 0, this.head);
    this.bulb = add(GEO.bulb, mats.bulb, 0, 0.58, 0, this.head);
    this.arms = [add(GEO.arm, mats.metalDark, -0.24, 0.5, 0.28, this.rig), add(GEO.arm, mats.metalDark, 0.24, 0.5, 0.28, this.rig)];
    this.cargo = add(GEO.cargo, mats.cargo, 0, 0.56, 0.5, this.rig);

    // Every mesh points back at the robot so the raycaster can find it.
    g.traverse((o) => { o.userData.robot = this; });

    if (this.mode === 'sleep') this.#fallAsleep();
  }

  setPath(points, startAt = Math.random()) {
    this.path = points;
    this.lengths = [];
    this.total = 0;
    for (let i = 1; i < points.length; i++) {
      const l = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
      this.lengths.push(l);
      this.total += l;
    }
    this.dist = this.total * startAt;
    this.phase = Math.random() < 0.5 ? 'out' : 'back';
    this.cargo.visible = this.phase === 'out';
    const p = this.#pointAt(this.dist);
    this.group.position.set(p.x, 0, p.z);
    this.heading = Math.atan2(p.dx, p.dz) + (this.phase === 'back' ? Math.PI : 0);
  }

  park(x, z, heading) {
    this.mode = this.mode === 'sleep' ? 'sleep' : 'parked';
    this.group.position.set(x, 0, z);
    this.heading = heading;
    this.group.rotation.y = heading;
    this.cargo.visible = false;
  }

  #pointAt(d) {
    const pts = this.path;
    if (this.mode === 'patrol') d = ((d % this.total) + this.total) % this.total;
    for (let i = 0; i < this.lengths.length; i++) {
      const l = this.lengths[i];
      if (d <= l || i === this.lengths.length - 1) {
        const a = pts[i], b = pts[i + 1];
        const t = l ? Math.min(Math.max(d / l, 0), 1) : 0;
        return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / (l || 1), dz: (b.z - a.z) / (l || 1) };
      }
      d -= l;
    }
    return { x: pts[0].x, z: pts[0].z, dx: 0, dz: 1 };
  }

  get moving() {
    return (this.mode === 'deliver' && (this.phase === 'out' || this.phase === 'back')) || this.mode === 'patrol';
  }

  update(dt, t) {
    const g = this.group;
    let bob = 0;

    if (this.mode === 'deliver') {
      if (this.phase === 'out' || this.phase === 'back') {
        const dir = this.phase === 'out' ? 1 : -1;
        this.dist += dir * this.speed * dt;
        if (this.phase === 'out' && this.dist >= this.total) {
          this.dist = this.total;
          this.phase = 'drop';
          this.timer = 0.7;
          this.cargo.visible = false;
          this.onDrop(this);
        } else if (this.phase === 'back' && this.dist <= 0) {
          this.dist = 0;
          this.phase = 'load';
          this.timer = 0.9;
        }
        const p = this.#pointAt(this.dist);
        g.position.x = p.x;
        g.position.z = p.z;
        this.#turnTo(Math.atan2(p.dx * dir, p.dz * dir), dt);
        bob = Math.abs(Math.sin((t + this.seed) * 9)) * 0.05;
      } else {
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.phase === 'drop') this.phase = 'back';
          else {
            this.phase = 'out';
            this.cargo.visible = true;
            this.cargo.scale.setScalar(0.01);
          }
        }
      }
    } else if (this.mode === 'patrol') {
      this.dist += this.speed * 0.6 * dt;
      const p = this.#pointAt(this.dist);
      g.position.x = p.x;
      g.position.z = p.z;
      this.#turnTo(Math.atan2(p.dx, p.dz), dt);
      bob = Math.abs(Math.sin((t + this.seed) * 7)) * 0.04;
    } else if (this.mode === 'sleep') {
      this.head.rotation.x = 0.32 + Math.sin(t * 1.3 + this.seed) * 0.06;
    }

    // Cargo grows back after a load; bulb blinks.
    if (this.cargo.visible && this.cargo.scale.x < 1) this.cargo.scale.setScalar(Math.min(1, this.cargo.scale.x + dt * 4));
    this.arms.forEach((a) => { a.rotation.x = this.cargo.visible ? 0 : 0.6; });
    if (this.mode !== 'sleep') this.bulb.scale.setScalar(Math.sin((t + this.seed) * 4) > 0.6 ? 1.25 : 1);

    // Click hop
    let hop = 0;
    if (this.hopT >= 0) {
      this.hopT += dt;
      const k = this.hopT / 0.7;
      if (k >= 1) {
        this.hopT = -1;
        this.rig.rotation.y = 0;
      } else {
        hop = Math.sin(Math.PI * k) * 1.3;
        this.rig.rotation.y = k * Math.PI * 2;
      }
    }
    g.position.y = 0.2 + bob + hop;
    g.rotation.y = this.heading;
  }

  #turnTo(target, dt) {
    let d = target - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * Math.min(1, dt * 10);
  }

  poke() {
    if (this.hopT >= 0) return;
    this.hopT = 0;
    if (this.mode === 'sleep') this.say('zzz… five more minutes');
    else this.say(LINES[Math.floor(Math.random() * LINES.length)]);
  }

  say(text) {
    if (this.bubble) this.group.remove(this.bubble);
    const el = document.createElement('span');
    el.className = 'bubble';
    el.textContent = text;
    this.bubble = new CSS2DObject(el);
    this.bubble.position.set(0, 1.7, 0);
    this.group.add(this.bubble);
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      this.group.remove(this.bubble);
      this.bubble = null;
    }, 1600);
  }

  #fallAsleep() {
    this.eyes.forEach((e) => e.scale.set(1, 0.18, 1));
    this.bulb.material = this.mats.bulbOff;
    this.cargo.visible = false;
    const el = document.createElement('span');
    el.className = 'zzz';
    el.innerHTML = '<i>z</i><i>z</i><i>z</i>';
    el.setAttribute('aria-hidden', 'true');
    const z = new CSS2DObject(el);
    z.position.set(0.3, 1.5, 0);
    this.group.add(z);
  }
}

export function robotMaterials(pal) {
  const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, ...extra });
  const mats = {
    metal: std(pal.metal),
    metalDark: std(pal.metalDark),
    rubber: std(pal.rubber, { roughness: 0.95 }),
    head: std(pal.levels[2]),
    eye: std(pal.levels[4], { emissive: pal.levels[4], emissiveIntensity: 0.35 }),
    bulb: std(pal.levels[4], { emissive: pal.levels[4], emissiveIntensity: 0.9 }),
    bulbOff: std(pal.metalDark),
    cargo: std(pal.levels[3]),
  };
  mats.apply = (p) => {
    mats.metal.color.copy(p.metal);
    mats.metalDark.color.copy(p.metalDark);
    mats.rubber.color.copy(p.rubber);
    mats.head.color.copy(p.levels[2]);
    mats.eye.color.copy(p.levels[4]);
    mats.eye.emissive.copy(p.levels[4]);
    mats.bulb.color.copy(p.levels[4]);
    mats.bulb.emissive.copy(p.levels[4]);
    mats.bulbOff.color.copy(p.metalDark);
    mats.cargo.color.copy(p.levels[3]);
  };
  return mats;
}
