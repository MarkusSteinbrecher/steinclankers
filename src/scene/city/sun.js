import * as THREE from 'three';

// Where the sun is over Zurich right now. Low-precision solar position (good to a fraction
// of a degree), enough to light a toy city.
export const ZURICH = { lat: 47.3769, lon: 8.5417 };
const RAD = Math.PI / 180;

export function sunPosition(date, { lat, lon } = ZURICH) {
  const d = date.getTime() / 86400000 - 10957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = 18.697374558 + 24.06570982441908 * d; // hours
  const H = (gmst * 15 + lon) * RAD - ra;
  const la = lat * RAD;
  const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(H)); // from north, clockwise
  return { alt, az };
}

// Scene axes: north is -z, east is +x (the camera looks toward the north-west).
export function skyDirection(alt, az, out = new THREE.Vector3()) {
  return out.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
}

// 0 = full day, 1 = full night; civil twilight (sun between +6 and -6 degrees) blends.
export function nightFromAlt(alt) {
  const t = Math.min(1, Math.max(0, (6 - alt / RAD) / 12));
  return t * t * (3 - 2 * t);
}

export const MOON = { alt: 38 * RAD, az: 200 * RAD };
export const DEFAULT_SUN = { alt: 50 * RAD, az: 160 * RAD };
