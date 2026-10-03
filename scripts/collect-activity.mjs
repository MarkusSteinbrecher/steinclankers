// Reads projects.config.json, counts commits per day in each local repo over the
// last WEEKS weeks and writes src/data/projects.json for the site.
// Only dates are read: no messages, authors or file names leave the repos.
// Usage: node scripts/collect-activity.mjs [code-root]   (default ~/Code)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const WEEKS = 12;
const root = process.argv[2] || join(homedir(), 'Code');
const config = JSON.parse(readFileSync(new URL('../projects.config.json', import.meta.url)));
// Private repos live in a gitignored file so their names never reach the public repo.
const privateFile = new URL('../projects.private.json', import.meta.url);
const extra = existsSync(privateFile) ? JSON.parse(readFileSync(privateFile)).repos || {} : {};
const reposOf = (id, repos) => [...repos, ...(extra[id] || [])];

// The window ends on today and starts on the Monday WEEKS weeks back, so columns are weeks.
const today = new Date();
today.setHours(0, 0, 0, 0);
const start = new Date(today);
start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7);
const days = WEEKS * 7;
const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function activity(repos) {
  const counts = new Array(days).fill(0);
  let last = null;
  let total = 0;
  for (const name of repos) {
    const dir = join(root, name);
    if (!existsSync(join(dir, '.git'))) {
      console.warn(`  skip ${name}: no git repo at ${dir}`);
      continue;
    }
    let out = '';
    try {
      out = execFileSync('git', ['-C', dir, 'log', '--all', '--no-merges', '--format=%ad', '--date=short'], { encoding: 'utf8', maxBuffer: 64 << 20 });
    } catch {
      continue;
    }
    for (const date of out.split('\n').filter(Boolean)) {
      total++;
      if (!last || date > last) last = date;
      const d = new Date(`${date}T00:00:00`);
      const i = Math.round((d - start) / 86400000);
      if (i >= 0 && i < days) counts[i]++;
    }
  }
  return { counts, total, last };
}

const strip = ({ repos, ...rest }) => rest;
const result = {
  generated: localKey(today),
  start: localKey(start),
  weeks: WEEKS,
  hq: { ...strip(config.hq), ...activity(reposOf('hq', config.hq.repos)) },
  projects: config.projects.map((p) => {
    console.log(p.id);
    return { ...strip(p), ...activity(reposOf(p.id, p.repos)) };
  }),
  cafe: config.cafe,
  lab: { ...strip(config.lab), count: reposOf('lab', config.lab.repos).length, ...activity(reposOf('lab', config.lab.repos)) },
};

writeFileSync(new URL('../src/data/projects.json', import.meta.url), JSON.stringify(result, null, 1) + '\n');
console.log(`wrote src/data/projects.json (${result.projects.length} projects, window from ${result.start})`);
