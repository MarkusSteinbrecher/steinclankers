import * as THREE from 'three';
import { GLYPHS } from '../glyphs.js';

// In-world company colours for the project signs (scene values, like real logos on buildings).
export const SIGN = {
  rrradio: { bg: '#3E3E39', fg: '#FFFF00' },
  archipelago: { bg: '#1F6FB2', fg: '#FFFFFF' },
  meinhermes: { bg: '#FFFFFF', fg: '#1F2328' },
  meinesteuer: { bg: '#FFFFFF', fg: '#1F2328' },
  rrrecipe: { bg: '#E86A1F', fg: '#FFFFFF' },
  steinerdesign: { bg: '#2A2E33', fg: '#FFFFFF' },
  'claude-mods': { bg: '#5B4FB8', fg: '#FFFFFF' },
  squash: { bg: '#E0457B', fg: '#FFFFFF' },
  lab: { bg: '#1F2328', fg: '#68D36F' },
  cafe: { bg: '#29ABE0', fg: '#FFFFFF' },
};
const PAUSED = { bg: '#9AA0A5', fg: '#FFFFFF' };

// Projects with a logo of their own draw it as the mark; the rest use their pixel glyph.
// Each mark draws into a box of height s and returns its width.
const RRR = ['.xx.xx.xx', '.x..x..x.', '.x..x..x.', 'xxxxxxxxx']; // rrradio's dot-matrix "rrr"
const MARKS = {
  rrradio(ctx, x, y, s, fg) {
    const cell = s / 6, top = y + s - 4 * cell;
    RRR.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.roundRect(x + c * cell + 1.5, top + r * cell + 1.5, cell - 3, cell - 3, 2);
      ctx.fill();
    }));
    return 9 * cell;
  },
  // Red diamond with a white core, from the meinHERMES favicon.
  meinhermes(ctx, x, y, s, fg, paused) {
    const k = s / 32;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.fillStyle = paused ? fg : '#EC3013';
    ctx.fill(new Path2D('M16 2 30 16 16 30 2 16Z'));
    ctx.fillStyle = paused ? PAUSED.bg : '#FFFFFF';
    ctx.fill(new Path2D('M16 10.6 21.4 16 16 21.4 10.6 16Z'));
    ctx.restore();
    return s;
  },
  // Red tile with a white S, from the meineSteuer favicon.
  meinesteuer(ctx, x, y, s, fg, paused) {
    const k = s / 32;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.fillStyle = paused ? fg : '#C8102E';
    ctx.beginPath();
    ctx.roundRect(0, 0, 32, 32, 3);
    ctx.fill();
    ctx.fillStyle = paused ? PAUSED.bg : '#FFFFFF';
    ctx.fill(new Path2D('M9 21.5c1.4 1.3 3.6 2 5.9 2 3.4 0 5.6-1.6 5.6-4.1 0-2.3-1.6-3.3-4.7-4l-1.6-.4c-1.7-.4-2.4-.9-2.4-1.8 0-1.1 1-1.8 2.7-1.8 1.6 0 3 .6 4.1 1.5l1.4-1.9c-1.4-1.2-3.3-1.9-5.5-1.9-3.2 0-5.4 1.7-5.4 4.2 0 2.2 1.4 3.4 4.5 4.1l1.7.4c1.8.4 2.5 1 2.5 1.9 0 1.2-1.2 1.9-3 1.9-1.9 0-3.5-.7-4.8-1.8z'));
    ctx.restore();
    return s;
  },
};

function glyphMark(glyph) {
  return (ctx, x, y, s, fg) => {
    const cell = s / 7;
    ctx.fillStyle = fg;
    GLYPHS[glyph].forEach((row, r) => [...row].forEach((ch, col) => {
      if (ch === '.') return;
      ctx.beginPath();
      ctx.roundRect(x + col * cell + 1, y + r * cell + 1, cell - 2, cell - 2, 2);
      ctx.fill();
    }));
    return s;
  };
}

export async function ensureFonts() {
  try {
    await document.fonts.load('640 96px "Hanken Grotesk"');
  } catch {}
}

// A logo sign: rounded panel, the project's mark (own logo or pixel glyph), then the name.
export function logoTexture(id, name, glyph, paused) {
  const { bg, fg } = paused ? PAUSED : SIGN[id] || PAUSED;
  const H = 160, pad = 36, icon = 84, gap = 28;
  const mark = MARKS[id] || glyphMark(glyph);
  const font = '640 92px "Hanken Grotesk", system-ui, sans-serif';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const markW = mark(probe, 0, 0, icon, fg, paused);
  const textW = Math.ceil(probe.measureText(name).width);
  const W = pad + markW + gap + textW + pad;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 22);
  ctx.fill();
  mark(ctx, pad, (H - icon) / 2, icon, fg, paused);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillText(name, pad + markW + gap, H / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { texture: tex, aspect: W / H };
}

export function signMesh(id, name, glyph, paused, height, maxWidth) {
  const { texture, aspect } = logoTexture(id, name, glyph, paused);
  const h = Math.min(height, maxWidth / aspect);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
  return m;
}

// The block wordmark from the logo generator (build_svgs.py), as cells: part s = STEIN, a = &, c = CLANKERS.
const FONT = {
  S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'],
  E: ['111', '100', '110', '100', '111'], I: ['1', '1', '1', '1', '1'],
  N: ['1001', '1101', '1011', '1001', '1001'], C: ['111', '100', '100', '100', '111'],
  L: ['100', '100', '100', '100', '111'], A: ['010', '101', '111', '101', '101'],
  K: ['101', '101', '110', '101', '101'], R: ['110', '101', '110', '101', '101'],
  '&': ['0100', '1010', '0100', '1011', '0110'],
};
export function wordmarkCells(text = 'STEIN&CLANKERS') {
  const cells = [];
  let col = 0;
  [...text].forEach((ch, i) => {
    const g = FONT[ch];
    const part = i < 5 ? 'stein' : i === 5 ? 'amp' : 'ink';
    for (let c = 0; c < g[0].length; c++) for (let r = 0; r < 5; r++) if (g[r][c] === '1') cells.push({ c: col + c, r, part });
    col += g[0].length + 1;
  });
  return { cells, width: col - 1 };
}
