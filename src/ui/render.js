import { level } from '../scene/palette.js';

const fmt = new Intl.NumberFormat('en');
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.flat().filter((k) => k != null));
  return n;
};

export function todayIndex(data) {
  return Math.round((new Date(`${data.generated}T00:00:00`) - new Date(`${data.start}T00:00:00`)) / 86400000);
}

export function sumRange(counts, data) {
  return counts.slice(0, todayIndex(data) + 1).reduce((a, b) => a + b, 0);
}

export function graph(counts, data) {
  const today = todayIndex(data);
  const g = el('div', { class: 'graph', role: 'img', 'aria-label': `${sumRange(counts, data)} commits in the last ${data.weeks} weeks` });
  counts.forEach((n, i) => g.append(el('i', { 'data-l': i > today ? '-' : String(level(n)), title: i > today ? null : `${n} commit${n === 1 ? '' : 's'}` })));
  return g;
}

export function statusBadge(status) {
  const active = status === 'active';
  return el('span', { class: 'sd-badge', 'data-tone': active ? 'good' : null }, el('span', { class: 'sd-badge__dot', 'aria-hidden': 'true' }), active ? 'Active' : 'Paused');
}

export const lastCommit = (d) => (d ? dateFmt.format(new Date(`${d}T00:00:00`)) : 'n/a');
export const num = (n) => fmt.format(n);

export function links(p, { size } = {}) {
  const out = [];
  if (p.site) out.push(el('a', { class: 'sd-button', 'data-variant': 'primary', 'data-size': size, href: p.site, target: '_blank', rel: 'noopener' }, 'Visit', el('span', { class: 'icon icon-external', 'aria-hidden': 'true' })));
  if (p.repo) out.push(el('a', { class: 'sd-button', 'data-size': size, href: p.repo, target: '_blank', rel: 'noopener' }, 'Source', el('span', { class: 'icon icon-external', 'aria-hidden': 'true' })));
  return out;
}
