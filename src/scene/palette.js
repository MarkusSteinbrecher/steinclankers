import * as THREE from 'three';

// Logo brand values (stein-clankers-logo spec). The floor, the HQ mark and the glyphs use
// only these; machine greys are derived from level 0 so the factory reads as part of the graph.
const RAW = {
  light: {
    levels: ['#E7EAEC', '#A6E8A7', '#68CB6E', '#40A449', '#207029'],
    stein: '#898D91', ink: '#2A2E33',
    metal: '#D3D7DA', metalDark: '#AEB3B7', rubber: '#2A2E33',
    sleep: ['#E7EAEC', '#D6DADD', '#C5CACE', '#B4B9BE', '#9DA3A8'],
    asphalt: '#6E757C', sidewalk: '#D3D7DB', paving: '#E4E6E8', grass: '#9CCB6E', grassDark: '#86B95C', water: '#6FB3E0', lane: '#F4F6F7',
    concrete: '#F1F2F3', concreteDark: '#DADDE0', stone: '#D9CEB8', sand: '#E7DCC6', blueGrey: '#A9B9C7',
    glass: '#8FB2CC', glassDark: '#5F7F99', windowOn: '#C4DAE9', windowOff: '#6F8597', roof: '#B8BEC4', roofSlate: '#5B636B',
    trunk: '#7A5B3E', c0: '#5FA84B', c1: '#4A9140', c2: '#78B85A', c3: '#3F7F3A', bird: '#3A3F44', amp: '#40A449', lamp: '#FFF6D8', rock: '#7F8C7A', rockDark: '#6A7766', snow: '#F7F9FA', shore: '#E3D9B8', sail: '#FFFFFF',
    car0: '#E63B2E', car1: '#2F6FDE', car2: '#F2C230', car3: '#FFFFFF', car4: '#2A2E33', car5: '#A3ABB2', car6: '#3FA34D', car7: '#F28C28',
    rrDark: '#3E3E39', rrYellow: '#FFE600', mastRed: '#D9362B', beacon: '#FF3B30', onAir: '#FF3B30', brick: '#B85C3E', awning: '#E86A1F', mods: '#5B4FB8', led: '#57E36A', swissRed: '#DA291C', kofi: '#29ABE0', coffee: '#5A3A22',
    light: { hemiSky: '#FFFFFF', hemiGround: '#C9CED2', hemi: 1.6, sun: 2.2 },
  },
  dark: {
    levels: ['#22272C', '#234725', '#2F6D34', '#409D48', '#68D36F'],
    stein: '#898D91', ink: '#DADDE0',
    metal: '#3A4148', metalDark: '#2B3137', rubber: '#121518',
    sleep: ['#22272C', '#2B3137', '#343B42', '#3E464E', '#4B545D'],
    asphalt: '#191C20', sidewalk: '#33393F', paving: '#2B3036', grass: '#24391F', grassDark: '#1E321A', water: '#1D3B52', lane: '#7A838B',
    concrete: '#4A5158', concreteDark: '#3C4249', stone: '#4D4840', sand: '#544E44', blueGrey: '#3B4652',
    glass: '#263848', glassDark: '#1A2733', windowOn: '#FFD27A', windowOff: '#1C2630', roof: '#3A4047', roofSlate: '#2A2F35',
    trunk: '#3E3022', c0: '#2F5A2A', c1: '#284E25', c2: '#3A6A31', c3: '#22421F', bird: '#C9CED2', amp: '#68D36F', lamp: '#FFE6A6', rock: '#2C332C', rockDark: '#242A24', snow: '#7E8890', shore: '#3D3A30', sail: '#C9CED2',
    car0: '#A8322A', car1: '#2A55A8', car2: '#B8952A', car3: '#C9CED2', car4: '#15181B', car5: '#6E767D', car6: '#2F7A3A', car7: '#B36A22',
    rrDark: '#2C2C28', rrYellow: '#E6D000', mastRed: '#9A2E26', beacon: '#FF4D3D', onAir: '#FF4A3D', brick: '#5C3326', awning: '#9A4A1A', mods: '#4A40A0', led: '#68D36F', swissRed: '#A8231A', kofi: '#1F7FA8', coffee: '#3A2616',
    light: { hemiSky: '#DDE3E8', hemiGround: '#2B3137', hemi: 1.9, sun: 2.1 },
  },
};

const toColor = (v) => (Array.isArray(v) ? v.map(toColor) : typeof v === 'string' ? new THREE.Color(v) : v);

export function palette(theme) {
  const raw = RAW[theme];
  const out = {};
  for (const [k, v] of Object.entries(raw)) out[k] = k === 'light' ? v : toColor(v);
  out.accent = cssColor('--accent-solid');
  return out;
}

// Reads a SteinerDesign role (OKLCH) as sRGB by painting it on a 1px canvas.
export function cssColor(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'red';
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

export function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Commit count per day -> contribution level, GitHub style.
export const level = (n) => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4);
