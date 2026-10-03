import * as THREE from 'three';
import { GLYPHS } from '../glyphs.js';

// In-world company colours for the project signs (scene values, like real logos on buildings).
export const SIGN = {
  rrradio: { bg: '#F2B705', fg: '#1F2328' },
  archipelago: { bg: '#1F6FB2', fg: '#FFFFFF' },
  meinhermes: { bg: '#D52B1E', fg: '#FFFFFF' },
  meinesteuer: { bg: '#2E7D5B', fg: '#FFFFFF' },
  rrrecipe: { bg: '#E86A1F', fg: '#FFFFFF' },
  steinerdesign: { bg: '#2A2E33', fg: '#FFFFFF' },
  'claude-mods': { bg: '#5B4FB8', fg: '#FFFFFF' },
  insight: { bg: '#0F8C8C', fg: '#FFFFFF' },
  squash: { bg: '#E0457B', fg: '#FFFFFF' },
  lab: { bg: '#1F2328', fg: '#68D36F' },
};
const PAUSED = { bg: '#9AA0A5', fg: '#FFFFFF' };

export async function ensureFonts() {
  try {
    await document.fonts.load('640 96px "Hanken Grotesk"');
  } catch {}
}

// A logo sign: rounded panel, the project's pixel glyph as the mark, then the name.
export function logoTexture(id, name, glyph, paused) {
  const { bg, fg } = paused ? PAUSED : SIGN[id] || PAUSED;
  const H = 160, pad = 36, cell = 12, icon = cell * 7, gap = 28;
  const font = '640 92px "Hanken Grotesk", system-ui, sans-serif';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const textW = Math.ceil(probe.measureText(name).width);
  const W = pad + icon + gap + textW + pad;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 22);
  ctx.fill();
  ctx.fillStyle = fg;
  const top = (H - icon) / 2;
  GLYPHS[glyph].forEach((row, r) => [...row].forEach((ch, col) => {
    if (ch === '.') return;
    ctx.beginPath();
    ctx.roundRect(pad + col * cell + 1, top + r * cell + 1, cell - 2, cell - 2, 2);
    ctx.fill();
  }));
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillText(name, pad + icon + gap, H / 2 + 4);
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
