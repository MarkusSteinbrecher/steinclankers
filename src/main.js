import data from './data/projects.json';
import { currentTheme } from './scene/palette.js';
import { el, graph, statusBadge, lastCommit, num, links, sumRange } from './ui/render.js';

const $ = (s) => document.querySelector(s);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const order = [...data.projects.map((p) => p.id), 'lab', 'hq', ...(data.cafe ? ['cafe'] : [])];
const byId = Object.fromEntries([...data.projects, { ...data.lab, id: 'lab', kind: 'lab', status: 'active' }, { ...data.hq, id: 'hq', kind: 'hq', status: 'active' }, ...(data.cafe ? [{ ...data.cafe, id: 'cafe', kind: 'cafe', status: 'active' }] : [])].map((p) => [p.id, p]));
let city = null;

// ---------- theme ----------
function applyThemeImages() {
  const t = currentTheme();
  document.querySelectorAll('img[data-light]').forEach((img) => { img.src = img.dataset[t]; });
  document.documentElement.dataset.theme = t;
}
const storedTheme = () => { try { return localStorage.getItem('theme'); } catch { return null; } };
const savedTheme = storedTheme();
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
applyThemeImages();
$('#theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
  applyThemeImages();
  city?.setTheme(next);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (storedTheme()) return;
  delete document.documentElement.dataset.theme;
  applyThemeImages();
  city?.setTheme(currentTheme());
});

// ---------- panel ----------
const panel = $('#panel');
function showPanel(st) {
  if (!st) {
    panel.hidden = true;
    city?.setViewShift(0, 0);
    if (location.hash.length > 1 && location.hash !== '#list') history.replaceState(null, '', '#city');
    return;
  }
  const p = byId[st.id];
  const isHq = p.kind === 'hq', isLab = p.kind === 'lab';
  $('#panel-title').textContent = p.name;
  $('#panel-blurb').textContent = p.blurb;
  if (p.kind === 'cafe') {
    $('#panel-badges').replaceChildren(el('span', { class: 'sd-badge', 'data-tone': 'accent', text: 'Coffee' }), el('span', { class: 'sd-badge', text: 'Supports rrradio' }));
    $('#panel-graph').replaceChildren();
    $('#panel-stats').replaceChildren();
    $('#panel-links').replaceChildren(el('a', { class: 'sd-button', 'data-variant': 'primary', href: p.site, target: '_blank', rel: 'noopener' }, 'Buy rrradio a coffee', el('span', { class: 'icon icon-external', 'aria-hidden': 'true' })));
    return openPanel(p);
  }
  $('#panel-badges').replaceChildren(...[
    ...(isHq ? [el('span', { class: 'sd-badge', 'data-tone': 'accent', text: 'Headquarters' })] : [statusBadge(p.status)]),
    p.kind && !isHq && !isLab ? el('span', { class: 'sd-badge', text: p.kind }) : null,
    isLab ? el('span', { class: 'sd-badge', text: `${p.count} projects behind the shutter` }) : null,
  ].filter(Boolean));
  const recent = isHq ? data.projects.reduce((a, q) => a + sumRange(q.counts, data), sumRange(data.lab.counts, data) + sumRange(p.counts, data)) : sumRange(p.counts, data);
  const total = isHq ? data.projects.reduce((a, q) => a + q.total, data.lab.total + p.total) : p.total;
  const counts = isHq ? p.counts.map((n, i) => data.projects.reduce((a, q) => a + q.counts[i], n + data.lab.counts[i])) : p.counts;
  $('#panel-graph').replaceChildren(graph(counts, data), el('div', { class: 'graph-caption', text: isHq ? `Every repo in the city, last ${data.weeks} weeks` : `Commits, last ${data.weeks} weeks` }));
  const row = (k, v) => [el('dt', { text: k }), el('dd', { text: v })];
  $('#panel-stats').replaceChildren(
    ...row(`Last ${data.weeks} weeks`, num(recent)),
    ...row('All time', num(total)),
    ...(isHq ? row('Stations', String(data.projects.length + 1)) : row('Last commit', lastCommit(p.last))),
  );
  $('#panel-links').replaceChildren(...links(p));
  openPanel(p);
}
function openPanel(p) {
  panel.hidden = false;
  if (location.hash !== `#${p.id}`) history.replaceState(null, '', `#${p.id}`);
  updateShift();
}
function updateShift() {
  if (!city || panel.hidden) return;
  if (innerWidth <= 640) city.setViewShift(0, (panel.offsetHeight - 56) / 2);
  else city.setViewShift((panel.offsetWidth + 24) / 2, 0);
}
addEventListener('resize', updateShift);
const step = (dir) => {
  const cur = city?.selected?.id;
  const i = order.indexOf(cur);
  city?.select(order[(i + dir + order.length) % order.length]);
};
$('#panel-prev').addEventListener('click', () => step(-1));
$('#panel-next').addEventListener('click', () => step(1));
$('#panel-close').addEventListener('click', () => city?.deselect());
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') city?.deselect();
  if (!panel.hidden && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest?.('input,textarea')) step(e.key === 'ArrowRight' ? 1 : -1);
});

// ---------- list view ----------
function buildList() {
  $('#list-intro').textContent = data.hq.blurb;
  $('#list-note').textContent = `Plus ${data.lab.count} more in the lab, not public yet. Commit data from ${lastCommit(data.generated)}.`;
  if (data.cafe) $('#list-note').append(' ', el('a', { href: data.cafe.site, target: '_blank', rel: 'noopener' }, 'Buy rrradio a coffee'), '.');
  $('#project-list').replaceChildren(...data.projects.map((p) => el('li', { class: 'project-row' },
    el('div', { class: 'project-main' },
      el('div', { class: 'project-top' }, el('h2', { text: p.name }), statusBadge(p.status), el('span', { class: 'sd-badge', text: p.kind })),
      el('p', { text: p.blurb }),
      el('div', { class: 'sd-cluster project-links' }, ...[
        p.site && el('a', { href: p.site, target: '_blank', rel: 'noopener' }, new URL(p.site).host + new URL(p.site).pathname.replace(/\/$/, '')),
        p.repo && el('a', { href: p.repo, target: '_blank', rel: 'noopener' }, 'Source'),
      ]),
    ),
    el('div', {}, graph(p.counts, data), el('div', { class: 'graph-caption', text: `${num(sumRange(p.counts, data))} commits, last ${data.weeks} weeks` })),
  )));
}

// ---------- routing ----------
function route() {
  const h = location.hash.slice(1);
  const list = h === 'list' || !city;
  document.body.classList.toggle('view-list', list);
  $('#list').hidden = !list;
  document.querySelectorAll('[data-view]').forEach((a) => a.setAttribute('aria-current', (a.dataset.view === 'list') === list ? 'page' : 'false'));
  if (list) {
    city?.deselect();
    return;
  }
  if (byId[h]) city.select(h);
}
addEventListener('hashchange', route);

// ---------- boot ----------
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

buildList();
const intro = $('#intro');
const finishIntro = () => {
  if (intro.classList.contains('is-done')) return;
  intro.classList.add('is-done');
  city?.startReveal();
  setTimeout(() => route(), reducedMotion ? 0 : 1800);
};

if (webglOK()) {
  const [{ City }, { ensureFonts }] = await Promise.all([import('./scene/city.js'), import('./scene/city/signs.js')]);
  await ensureFonts();
  let delivered = 0;
  city = new City({
    container: $('#stage'),
    data,
    theme: currentTheme(),
    reducedMotion,
    onSelect: (st) => showPanel(st),
    onDeliver: () => { $('#delivered').textContent = num(++delivered); },
  });
  window.__city = city;
}

if (!city || reducedMotion || location.hash === '#list') {
  intro.classList.add('is-done');
  city?.startReveal();
  route();
} else {
  intro.addEventListener('click', finishIntro);
  addEventListener('keydown', finishIntro, { once: true });
  setTimeout(finishIntro, 3400);
}
